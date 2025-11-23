import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions, ActivityIndicator, TextInput, ScrollView, Alert, Modal, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Group, RoommateProfile } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockRoommateProfiles } from '../../utils/mockData';
import { getGenderSymbol, calculateCompatibility } from '../../utils/matchingAlgorithm';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xxl;

type Tab = 'my-groups' | 'discover' | 'create';

export const GroupsScreen = () => {
  const { theme } = useTheme();
  const { user, purchaseUndoPass, hasActiveUndoPass } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLikedNotification, setShowLikedNotification] = useState(false);
  const [likedGroupName, setLikedGroupName] = useState('');
  const [lastSwipedGroup, setLastSwipedGroup] = useState<{ group: Group; action: 'like' | 'skip' } | null>(null);
  const [showUndoUpgradeModal, setShowUndoUpgradeModal] = useState(false);
  const [processingUndoPass, setProcessingUndoPass] = useState(false);
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [processingMessagePurchase, setProcessingMessagePurchase] = useState(false);
  const [messageTargetUserId, setMessageTargetUserId] = useState<string | null>(null);
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RoommateProfile | null>(null);
  const [avatarsExpanded, setAvatarsExpanded] = useState(false);
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupBudget, setGroupBudget] = useState('');
  const [groupApartmentPrice, setGroupApartmentPrice] = useState('');
  const [groupBedrooms, setGroupBedrooms] = useState('');
  const [groupLocation, setGroupLocation] = useState('');
  const [groupMaxMembers, setGroupMaxMembers] = useState('4');

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  useFocusEffect(
    React.useCallback(() => {
      loadGroups();
    }, [user])
  );

  const loadGroups = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const groups = await StorageService.getGroups();
      const userGroups = groups.filter(g => g.members.includes(user.id));
      const otherGroups = groups.filter(
        g => !g.members.includes(user.id) && !g.pendingMembers.includes(user.id)
      );
      setMyGroups(userGroups);
      setAllGroups(otherGroups);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentGroup = allGroups[currentIndex];

  const calculateGroupCompatibility = (group: Group): number => {
    if (!user) return 0;
    
    const memberProfiles = (group.members || [])
      .map(id => mockRoommateProfiles.find(p => p.id === id))
      .filter((p): p is RoommateProfile => p !== null && p !== undefined);
    
    if (memberProfiles.length === 0) return 0;
    
    const scores = memberProfiles.map(profile => calculateCompatibility(user, profile));
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return Math.round(averageScore);
  };

  const getCompatibilityColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 70) return '#2196F3'; // Blue
    if (score >= 60) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getCompatibilityLabel = (score: number): string => {
    if (score >= 80) return 'Great Match';
    if (score >= 70) return 'Good Match';
    if (score >= 60) return 'Fair Match';
    return 'Low Match';
  };

  const MemberAvatarStack = ({ group }: { group: Group }) => {
    const MAX_VISIBLE = 4;
    const AVATAR_SIZE = 80;
    const OVERLAP = 24;
    const EXPANDED_SPACING = 95;

    const memberProfiles = (group.members || [])
      .map(id => mockRoommateProfiles.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined)
      .slice(0, MAX_VISIBLE);

    const remainingCount = Math.max(0, (group.members || []).length - MAX_VISIBLE);

    const handleMemberPress = (profile: RoommateProfile) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMember(profile);
      setShowMemberProfile(true);
      setAvatarsExpanded(false);
    };

    const handleStackPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAvatarsExpanded(!avatarsExpanded);
    };

    return (
      <Pressable 
        onPress={handleStackPress}
        style={styles.avatarStackContainer}
      >
        {memberProfiles.map((profile, index) => {
          const baseLeft = index * (AVATAR_SIZE - OVERLAP);
          const expandedLeft = index * EXPANDED_SPACING;
          
          return (
            <Pressable
              key={profile.id}
              onPress={(e) => {
                e.stopPropagation();
                handleMemberPress(profile);
              }}
              style={[
                styles.avatarWrapper,
                {
                  left: avatarsExpanded ? expandedLeft : baseLeft,
                  zIndex: MAX_VISIBLE - index,
                }
              ]}
            >
              {profile.photos && profile.photos.length > 0 ? (
                <Image
                  source={{ uri: profile.photos[0] }}
                  style={[styles.avatar, { borderColor: theme.backgroundDefault }]}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primary, borderColor: theme.backgroundDefault }]}>
                  <Feather name="user" size={28} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          );
        })}
        
        {remainingCount > 0 ? (
          <View
            style={[
              styles.avatarWrapper,
              {
                left: avatarsExpanded 
                  ? memberProfiles.length * EXPANDED_SPACING 
                  : memberProfiles.length * (AVATAR_SIZE - OVERLAP),
                zIndex: 0,
              }
            ]}
          >
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.textSecondary, borderColor: theme.backgroundDefault }]}>
              <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                +{remainingCount}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const handleLikeGroup = async (group: Group) => {
    if (!user) return;

    const isPremium = user.subscription?.plan === 'plus' || user.subscription?.plan === 'elite';

    if (!isPremium) {
      try {
        const allExistingGroups = await StorageService.getGroups();
        const joinedGroups = allExistingGroups.filter(
          g => g.members.includes(user.id) && g.createdBy !== user.id
        );
        
        console.log('[GroupsScreen] User joined groups:', joinedGroups.length);
        
        if (joinedGroups.length >= 1) {
          console.log('[GroupsScreen] Group join limit reached, showing alert');
          Alert.alert(
            'Upgrade Required',
            'You can only join 1 group with the basic plan. Upgrade to Plus or Elite for unlimited group joining!',
            [
              { text: 'Maybe Later', style: 'cancel' },
              {
                text: 'View Plans',
                onPress: () => navigation.navigate('Profile', { screen: 'Payment' }),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.error('[GroupsScreen] Error checking join limits:', error);
        Alert.alert('Error', 'Failed to check join limits');
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await StorageService.likeGroup(group.id, user.id);
    
    // Delay showing notification until card animation completes
    setTimeout(() => {
      setLikedGroupName(group.name);
      setShowLikedNotification(true);
      
      // Hide notification after 0.8 seconds
      setTimeout(() => {
        setShowLikedNotification(false);
      }, 800);
    }, 300);
  };

  const handleSwipeAction = async (action: 'like' | 'skip') => {
    if (!currentGroup) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setLastSwipedGroup({ group: currentGroup, action });

    const direction = action === 'like' ? 1 : -1;
    const toX = direction * SCREEN_WIDTH * 1.5;

    // Animate card off screen
    translateX.value = withSpring(toX, { 
      damping: 15,
      stiffness: 120 
    });
    rotation.value = withSpring(direction * 15);

    // Handle like action after starting animation
    if (action === 'like') {
      await handleLikeGroup(currentGroup);
    }

    // Show next card faster
    const resetDelay = action === 'like' ? 1100 : 300;
    setTimeout(() => {
      translateX.value = 0;
      rotation.value = 0;
      // Advance to next card for both like and skip
      setCurrentIndex(currentIndex + 1);
    }, resetDelay);
  };

  const handleUndo = () => {
    if (!hasActiveUndoPass()) {
      setShowUndoUpgradeModal(true);
      return;
    }
    
    if (!lastSwipedGroup) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    undoLastSwipeAsync(lastSwipedGroup.group.id, lastSwipedGroup.action);
    
    setCurrentIndex(currentIndex - 1);
    setLastSwipedGroup(null);
  };

  const undoLastSwipeAsync = async (groupId: string, action: 'like' | 'skip') => {
    try {
      if (action === 'like') {
        await StorageService.unlikeGroup(groupId, user!.id);
      }
    } catch (error) {
      console.error('[GroupsScreen] Error undoing swipe:', error);
    }
  };

  const handlePurchaseUndoPass = async () => {
    setProcessingUndoPass(true);
    const result = await purchaseUndoPass();
    setProcessingUndoPass(false);
    
    if (result.success) {
      setShowUndoUpgradeModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (result.message.includes('payment method')) {
        navigation.navigate('Profile', { screen: 'Payment' });
        setShowUndoUpgradeModal(false);
      }
    }
  };

  const handleMessageGroupCreator = async (creatorId: string) => {
    const users = await StorageService.getUsers();
    const currentUser = users.find(u => u.id === user?.id);
    const userPlan = currentUser?.subscription?.plan || 'basic';
    const userStatus = currentUser?.subscription?.status || 'active';
    
    const isEliteMember = userPlan === 'elite' && userStatus === 'active';
    
    setMessageTargetUserId(creatorId);
    
    if (isEliteMember) {
      handleSendDirectMessage(creatorId);
    } else {
      setShowMessageModal(true);
    }
  };

  const handleSendDirectMessage = async (targetUserId: string) => {
    if (!user) return;
    
    const conversations = await StorageService.getConversations();
    const existingConversation = conversations.find(c =>
      c.participant.id === targetUserId
    );
    
    if (existingConversation) {
      navigation.navigate('Messages', { screen: 'Chat', params: { conversationId: existingConversation.id } });
    } else {
      // Get target user profile
      const roommateProfiles = await StorageService.getRoommateProfiles();
      const targetProfile = roommateProfiles.find(p => p.id === targetUserId);
      
      if (!targetProfile) return;
      
      const newConversation = {
        id: `conv-${targetUserId}-${Date.now()}`,
        participant: {
          id: targetProfile.id,
          name: targetProfile.name,
          photo: targetProfile.photos?.[0],
          online: false,
        },
        lastMessage: '',
        timestamp: new Date(),
        unread: 0,
        messages: [],
      };
      await StorageService.addOrUpdateConversation(newConversation);
      navigation.navigate('Messages', { screen: 'Chat', params: { conversationId: newConversation.id } });
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePurchaseMessageCredit = async () => {
    setProcessingMessagePurchase(true);
    
    // NOTE: This is a simulated payment flow for demonstration purposes.
    // In a production app, you would need to:
    // 1. Set up a backend API server (Express, etc.)
    // 2. Create a Stripe payment intent for $0.99
    // 3. Handle the payment confirmation
    // 4. Grant the message credit upon successful payment
    // 5. Track message credits in user data
    
    // Simulated payment processing (1 second delay)
    setTimeout(async () => {
      // In production, this would only execute after successful payment
      const users = await StorageService.getUsers();
      const currentUser = users.find(u => u.id === user?.id);
      if (currentUser) {
        // In production: increment message credits
        // currentUser.messageCredits = (currentUser.messageCredits || 0) + 1;
        // await StorageService.updateUser(currentUser);
      }
      
      setProcessingMessagePurchase(false);
      setShowMessageModal(false);
      if (messageTargetUserId) {
        await handleSendDirectMessage(messageTargetUserId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1000);
  };

  const handleUpgradeForMessaging = () => {
    setShowMessageModal(false);
    navigation.navigate('Profile', { screen: 'Payment' });
  };

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value = event.translationX;
      rotation.value = event.translationX / 20;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 120) {
        const action = event.translationX > 0 ? 'like' : 'skip';
        runOnJS(handleSwipeAction)(action);
      } else {
        translateX.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = `${rotation.value}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { rotate },
      ],
    };
  });

  const handleCreateGroup = async () => {
    if (!user) return;

    const isPremium = user.subscription?.plan === 'plus' || user.subscription?.plan === 'elite';

    if (!isPremium) {
      try {
        const allExistingGroups = await StorageService.getGroups();
        const userCreatedGroups = allExistingGroups.filter(g => g.createdBy === user.id);
        
        console.log('[GroupsScreen] User created groups:', userCreatedGroups.length);
        
        if (userCreatedGroups.length >= 1) {
          console.log('[GroupsScreen] Group creation limit reached, showing alert');
          Alert.alert(
            'Upgrade Required',
            'You can only create 1 group with the basic plan. Upgrade to Plus or Elite for unlimited group creation!',
            [
              { text: 'Maybe Later', style: 'cancel' },
              {
                text: 'View Plans',
                onPress: () => navigation.navigate('Profile', { screen: 'Payment' }),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.error('[GroupsScreen] Error checking group limits:', error);
        Alert.alert('Error', 'Failed to check group limits');
        return;
      }
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (!groupBudget.trim() || isNaN(parseInt(groupBudget))) {
      Alert.alert('Error', 'Please enter a valid budget');
      return;
    }

    if (!groupLocation.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    const maxMembers = parseInt(groupMaxMembers);
    if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 10) {
      Alert.alert('Error', 'Maximum members must be between 2 and 10');
      return;
    }

    const apartmentPrice = groupApartmentPrice.trim() ? parseInt(groupApartmentPrice) : undefined;
    const bedrooms = groupBedrooms.trim() ? parseInt(groupBedrooms) : undefined;

    // Validate apartment price is at least budget * bedrooms
    if (apartmentPrice !== undefined && bedrooms !== undefined) {
      const minPrice = parseInt(groupBudget) * bedrooms;
      if (apartmentPrice < minPrice) {
        Alert.alert(
          'Invalid Apartment Price',
          `The apartment price ($${apartmentPrice}) cannot be less than the minimum budget per person ($${groupBudget}) × bedrooms (${bedrooms}) = $${minPrice}`
        );
        return;
      }
    }

    const newGroup: Group = {
      id: Math.random().toString(36).substr(2, 9),
      name: groupName.trim(),
      description: groupDescription.trim() || undefined,
      members: [user.id],
      pendingMembers: [],
      budget: parseInt(groupBudget),
      apartmentPrice: apartmentPrice,
      bedrooms: bedrooms,
      preferredLocation: groupLocation.trim(),
      maxMembers: maxMembers,
      createdAt: new Date(),
      createdBy: user.id,
    };

    await StorageService.addOrUpdateGroup(newGroup);

    setGroupName('');
    setGroupDescription('');
    setGroupBudget('');
    setGroupApartmentPrice('');
    setGroupBedrooms('');
    setGroupLocation('');
    setGroupMaxMembers('4');

    await loadGroups();
    setActiveTab('my-groups');

    Alert.alert('Success', 'Your group has been created!');
  };

  const handleLeaveGroup = async (group: Group) => {
    if (!user) return;

    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await StorageService.leaveGroup(group.id, user.id);
            loadGroups();
          },
        },
      ]
    );
  };

  const handleRemoveMember = async (groupId: string, memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await StorageService.removeMemberFromGroup(groupId, memberId);
            loadGroups();
          },
        },
      ]
    );
  };

  const handleAcceptMember = async (groupId: string, userId: string, userName: string) => {
    const success = await StorageService.acceptGroupMember(groupId, userId);
    if (!success) {
      Alert.alert(
        'Cannot Accept',
        `${userName} has already joined another group. They must leave that group first before joining this one.`
      );
    }
    loadGroups();
  };

  const handleRejectMember = async (groupId: string, userId: string) => {
    await StorageService.rejectGroupMember(groupId, userId);
    loadGroups();
  };

  const renderMyGroup = (group: Group) => {
    const isCreator = group.createdBy === user?.id;
    const memberProfiles = (group.members || [])
      .map(id => mockRoommateProfiles.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined);
    const pendingProfiles = (group.pendingMembers || [])
      .map(id => mockRoommateProfiles.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined);

    return (
      <View
        key={group.id}
        style={[styles.myGroupCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={styles.groupHeader}>
          <View style={[styles.groupIcon, { backgroundColor: theme.primary }]}>
            <Feather name="users" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.groupInfo}>
            <ThemedText style={[Typography.h3]}>{group.name}</ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              {group.members.length}/{group.maxMembers} members
            </ThemedText>
          </View>
          {!isCreator ? (
            <Pressable
              style={[styles.leaveButton, { borderColor: theme.error }]}
              onPress={() => handleLeaveGroup(group)}
            >
              <ThemedText style={[Typography.small, { color: theme.error }]}>Leave</ThemedText>
            </Pressable>
          ) : null}
        </View>

        {group.description ? (
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            {group.description}
          </ThemedText>
        ) : null}

        <View style={{ flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Feather name="dollar-sign" size={16} color={theme.primary} />
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              Min ${group.budget}/mo
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Feather name="map-pin" size={16} color={theme.primary} />
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              {group.preferredLocation}
            </ThemedText>
          </View>
          {group.apartmentPrice ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <Feather name="home" size={16} color={theme.primary} />
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                ${group.apartmentPrice} total
              </ThemedText>
            </View>
          ) : null}
          {group.bedrooms ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <Feather name="grid" size={16} color={theme.primary} />
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                {group.bedrooms} bedrooms
              </ThemedText>
            </View>
          ) : null}
        </View>

        {memberProfiles.length > 0 ? (
          <View style={styles.membersSection}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Members
            </ThemedText>
            {memberProfiles.map(profile => (
              <View key={profile.id} style={styles.memberRow}>
                <ThemedText style={Typography.body}>
                  {profile.name || 'Unknown'}{profile.age ? `, ${profile.age}` : ''} {getGenderSymbol(profile.gender)}
                </ThemedText>
                {isCreator && profile.id !== user?.id ? (
                  <Pressable onPress={() => handleRemoveMember(group.id, profile.id, profile.name || 'Member')}>
                    <Feather name="x-circle" size={20} color={theme.error} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {pendingProfiles.length > 0 ? (
          <View style={styles.pendingSection}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Pending Requests ({pendingProfiles.length})
            </ThemedText>
            {pendingProfiles.map(profile => (
              <View key={profile.id} style={styles.pendingRow}>
                <ThemedText style={Typography.body}>
                  {profile.name || 'Unknown'}{profile.age ? `, ${profile.age}` : ''} {getGenderSymbol(profile.gender)}
                </ThemedText>
                <View style={styles.pendingActions}>
                  <Pressable
                    style={[styles.pendingButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleAcceptMember(group.id, profile.id, profile.name || 'Member')}
                  >
                    <Feather name="check" size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    style={[styles.pendingButton, { backgroundColor: theme.error }]}
                    onPress={() => handleRejectMember(group.id, profile.id)}
                  >
                    <Feather name="x" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    if (activeTab === 'my-groups') {
      if (myGroups.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Feather name="users" size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              No Groups Yet
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              Create a group or discover groups to join!
            </ThemedText>
          </View>
        );
      }

      return (
        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={styles.myGroupsList}
          showsVerticalScrollIndicator={false}
        >
          {myGroups.map(group => renderMyGroup(group))}
        </ScrollView>
      );
    }

    if (activeTab === 'discover') {
      if (!currentGroup) {
        return (
          <View style={styles.emptyState}>
            <Feather name="users" size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              No More Groups
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              You've seen all available groups.{'\n'}Check back later for new groups!
            </ThemedText>
          </View>
        );
      }

      return (
        <View style={styles.cardContainer}>
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: theme.backgroundDefault },
                animatedCardStyle,
              ]}
            >
              <Pressable onPress={() => setShowGroupDetail(true)} style={{ flex: 1 }}>
                <ScrollView 
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.cardContent}
                  showsVerticalScrollIndicator={false}
                >
                <View style={{ marginTop: Spacing.md, alignItems: 'center' }}>
                  <MemberAvatarStack group={currentGroup} />
                  
                  {(() => {
                    const compatibility = calculateGroupCompatibility(currentGroup);
                    const color = getCompatibilityColor(compatibility);
                    
                    return (
                      <View style={[styles.compatibilityBadge, { backgroundColor: color, marginTop: Spacing.sm }]}>
                        <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                          {compatibility}% Match
                        </ThemedText>
                      </View>
                    );
                  })()}
                </View>
                
                <ThemedText style={[Typography.h2, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>
                  {currentGroup.name}
                </ThemedText>
                
                <View style={styles.membersInfo}>
                  <Feather name="users" size={16} color={theme.textSecondary} />
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                    {currentGroup.members.length}/{currentGroup.maxMembers} members • {currentGroup.maxMembers - currentGroup.members.length} spots left
                  </ThemedText>
                </View>

                {currentGroup.description ? (
                  <ThemedText style={[Typography.body, { color: theme.text, marginTop: Spacing.lg, textAlign: 'center' }]}>
                    {currentGroup.description}
                  </ThemedText>
                ) : null}

                <View style={styles.cardDetails}>
                  <View style={styles.cardDetail}>
                    <Feather name="dollar-sign" size={20} color={theme.primary} />
                    <View style={styles.cardDetailText}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                        Min Budget
                      </ThemedText>
                      <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                        ${currentGroup.budget}/mo
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.cardDetail}>
                    <Feather name="map-pin" size={20} color={theme.primary} />
                    <View style={styles.cardDetailText}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                        Location
                      </ThemedText>
                      <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                        {currentGroup.preferredLocation}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                {(currentGroup.apartmentPrice || currentGroup.bedrooms) ? (
                  <View style={[styles.cardDetails, { marginTop: Spacing.md }]}>
                    {currentGroup.apartmentPrice ? (
                      <View style={styles.cardDetail}>
                        <Feather name="home" size={20} color={theme.primary} />
                        <View style={styles.cardDetailText}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                            Total Price
                          </ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                            ${currentGroup.apartmentPrice}
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                    {currentGroup.bedrooms ? (
                      <View style={styles.cardDetail}>
                        <Feather name="grid" size={20} color={theme.primary} />
                        <View style={styles.cardDetailText}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                            Bedrooms
                          </ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                            {currentGroup.bedrooms}
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {currentGroup.members.length > 0 ? (
                  <View style={styles.cardMembersSection}>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
                      Current Members
                    </ThemedText>
                    <View style={styles.cardMembersList}>
                      {currentGroup.members.map((memberId, index) => {
                        const profile = mockRoommateProfiles.find(p => p.id === memberId);
                        return profile ? (
                          <ThemedText key={memberId} style={[Typography.body, { color: theme.text, marginRight: index < currentGroup.members.length - 1 ? Spacing.sm : 0 }]}>
                            {profile.name.split(' ')[0]} {getGenderSymbol(profile.gender)}
                          </ThemedText>
                        ) : null;
                      })}
                    </View>
                  </View>
                ) : null}
                </ScrollView>
              </Pressable>
            </Animated.View>
          </GestureDetector>

          <View style={styles.actionButtons}>
            <Pressable
              style={[
                styles.actionButtonSmall, 
                { 
                  backgroundColor: '#FFFFFF', 
                  borderColor: lastSwipedGroup ? theme.warning : theme.textSecondary,
                  opacity: lastSwipedGroup ? 1 : 0.4,
                  borderWidth: 2,
                }
              ]}
              onPress={handleUndo}
            >
              <Feather name="rotate-ccw" size={24} color={lastSwipedGroup ? theme.warning : theme.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderColor: theme.error, borderWidth: 2 }]}
              onPress={() => handleSwipeAction('skip')}
            >
              <Feather name="x" size={32} color={theme.error} />
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => handleSwipeAction('like')}
            >
              <Feather name="heart" size={32} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.swipeHint}>
            <View style={styles.swipeHintItem}>
              <Feather name="arrow-left" size={16} color={theme.textSecondary} />
              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                Skip
              </ThemedText>
            </View>
            <View style={styles.swipeHintItem}>
              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginRight: Spacing.xs }]}>
                Like
              </ThemedText>
              <Feather name="arrow-right" size={16} color={theme.textSecondary} />
            </View>
          </View>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.createForm}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.lg }]}>
          Create a New Group
        </ThemedText>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Group Name *</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="e.g., Young Professionals"
            placeholderTextColor={theme.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Description</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="Tell others about your group..."
            placeholderTextColor={theme.textSecondary}
            value={groupDescription}
            onChangeText={setGroupDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>
            Minimum Monthly Budget (per person) {(groupApartmentPrice.trim() && groupBedrooms.trim()) ? '(Auto-calculated)' : '*'}
          </ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: (groupApartmentPrice.trim() && groupBedrooms.trim()) ? theme.backgroundSecondary : theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="e.g., 800"
            placeholderTextColor={theme.textSecondary}
            value={groupBudget}
            onChangeText={setGroupBudget}
            keyboardType="numeric"
            editable={!(groupApartmentPrice.trim() && groupBedrooms.trim())}
          />
          {(groupApartmentPrice.trim() && groupBedrooms.trim()) ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
              Automatically calculated from apartment price ÷ bedrooms
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Entire Apartment Price</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="e.g., 2500"
            placeholderTextColor={theme.textSecondary}
            value={groupApartmentPrice}
            onChangeText={(value) => {
              setGroupApartmentPrice(value);
              // Auto-calculate minimum budget per person
              if (value.trim() && !isNaN(parseInt(value)) && groupBedrooms.trim() && !isNaN(parseInt(groupBedrooms))) {
                const totalPrice = parseInt(value);
                const rooms = parseInt(groupBedrooms);
                const perPerson = Math.ceil(totalPrice / rooms);
                setGroupBudget(perPerson.toString());
              }
            }}
            keyboardType="numeric"
          />
          {groupApartmentPrice.trim() && groupBedrooms.trim() ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
              Minimum budget will be auto-calculated as ${groupApartmentPrice} ÷ {groupBedrooms} bedrooms
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Number of Bedrooms</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="e.g., 3"
            placeholderTextColor={theme.textSecondary}
            value={groupBedrooms}
            onChangeText={(value) => {
              setGroupBedrooms(value);
              // Auto-set max members to match bedrooms
              if (value.trim() && !isNaN(parseInt(value))) {
                setGroupMaxMembers(value);
                // Auto-calculate minimum budget if apartment price is set
                if (groupApartmentPrice.trim() && !isNaN(parseInt(groupApartmentPrice))) {
                  const totalPrice = parseInt(groupApartmentPrice);
                  const rooms = parseInt(value);
                  const perPerson = Math.ceil(totalPrice / rooms);
                  setGroupBudget(perPerson.toString());
                }
              }
            }}
            keyboardType="numeric"
          />
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            Maximum members will automatically match the number of bedrooms
          </ThemedText>
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Preferred Location *</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="e.g., Downtown"
            placeholderTextColor={theme.textSecondary}
            value={groupLocation}
            onChangeText={setGroupLocation}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>
            Maximum Members (2-10) {groupBedrooms.trim() ? '(Auto-set from bedrooms)' : '*'}
          </ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: groupBedrooms.trim() ? theme.backgroundSecondary : theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="4"
            placeholderTextColor={theme.textSecondary}
            value={groupMaxMembers}
            onChangeText={setGroupMaxMembers}
            keyboardType="numeric"
            editable={!groupBedrooms.trim()}
          />
          {groupBedrooms.trim() ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
              Automatically set to match number of bedrooms
            </ThemedText>
          ) : null}
        </View>

        <Pressable
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={handleCreateGroup}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
            Create Group
          </ThemedText>
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.tabBar}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'my-groups' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('my-groups')}
        >
          <ThemedText style={[
            Typography.body,
            { color: activeTab === 'my-groups' ? theme.primary : theme.textSecondary }
          ]}>
            My Groups
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === 'discover' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('discover')}
        >
          <ThemedText style={[
            Typography.body,
            { color: activeTab === 'discover' ? theme.primary : theme.textSecondary }
          ]}>
            Discover
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === 'create' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('create')}
        >
          <ThemedText style={[
            Typography.body,
            { color: activeTab === 'create' ? theme.primary : theme.textSecondary }
          ]}>
            Create
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {showLikedNotification ? (
        <View style={[styles.matchOverlay, { backgroundColor: theme.primary }]}>
          <Feather name="heart" size={64} color="#FFFFFF" />
          <ThemedText style={[Typography.hero, { color: '#FFFFFF', fontSize: 36, marginTop: Spacing.lg }]}>
            Request Sent!
          </ThemedText>
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.md, textAlign: 'center' }]}>
            Waiting for {likedGroupName} to accept you
          </ThemedText>
        </View>
      ) : null}

      <Modal
        visible={showUndoUpgradeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUndoUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.warning }]}>
              <Feather name="rotate-ccw" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Undo Swipe
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Take back your last swipe and get a second chance!
              </ThemedText>
              
              <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.lg }]}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                  24-Hour Undo Pass
                </ThemedText>
                <ThemedText style={[Typography.h1, { color: theme.warning, marginBottom: Spacing.xs }]}>
                  $1.99
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Undo swipes for 24 hours
                </ThemedText>
              </View>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Take back your last swipe
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    24-hour unlimited undo access
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.warning, opacity: processingUndoPass ? 0.7 : 1 }]}
                onPress={handlePurchaseUndoPass}
                disabled={processingUndoPass}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  {processingUndoPass ? 'Processing...' : 'Get 24hr Pass - $1.99'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.primary, marginTop: Spacing.md }]}
                onPress={() => {
                  setShowUndoUpgradeModal(false);
                  navigation.navigate('Settings');
                }}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade to Plus
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowUndoUpgradeModal(false)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Maybe Later
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGroupDetail && currentGroup != null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGroupDetail(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.detailHeader}>
              <ThemedText style={[Typography.h2]}>Group Details</ThemedText>
              <Pressable onPress={() => setShowGroupDetail(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
              {currentGroup ? (
                <>
                  <View style={[styles.detailSection, { alignItems: 'center' }]}>
                    <View style={[styles.groupIconLarge, { backgroundColor: theme.primary }]}>
                      <Feather name="users" size={32} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[Typography.h2, { marginTop: Spacing.md }]}>{currentGroup.name}</ThemedText>
                    <View style={styles.membersInfo}>
                      <Feather name="users" size={16} color={theme.textSecondary} />
                      <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                        {currentGroup.members.length}/{currentGroup.maxMembers} members • {currentGroup.maxMembers - currentGroup.members.length} spots left
                      </ThemedText>
                    </View>
                  </View>

                  {currentGroup.description ? (
                    <View style={styles.detailSection}>
                      <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>About</ThemedText>
                      <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                        {currentGroup.description}
                      </ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.detailSection}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Group Details</ThemedText>
                    <View style={styles.detailRow}>
                      <Feather name="dollar-sign" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Minimum Budget (per person)</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>${currentGroup.budget}/month</ThemedText>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Feather name="map-pin" size={20} color={theme.primary} />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Preferred Location</ThemedText>
                        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentGroup.preferredLocation}</ThemedText>
                      </View>
                    </View>
                    {currentGroup.apartmentPrice ? (
                      <View style={styles.detailRow}>
                        <Feather name="home" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Total Apartment Price</ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>${currentGroup.apartmentPrice}</ThemedText>
                        </View>
                      </View>
                    ) : null}
                    {currentGroup.bedrooms ? (
                      <View style={styles.detailRow}>
                        <Feather name="grid" size={20} color={theme.primary} />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Bedrooms</ThemedText>
                          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{currentGroup.bedrooms}</ThemedText>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.detailSection, { paddingBottom: Spacing.xxl }]}>
                    <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Members</ThemedText>
                    {currentGroup.members.map((memberId) => {
                      const profile = mockRoommateProfiles.find(p => p.id === memberId);
                      return profile ? (
                        <View key={memberId} style={styles.memberRow}>
                          <ThemedText style={Typography.body}>
                            {profile.name}{profile.age ? `, ${profile.age}` : ''} {getGenderSymbol(profile.gender)}
                          </ThemedText>
                        </View>
                      ) : null;
                    })}
                  </View>

                  <View style={[styles.detailSection, { paddingBottom: Spacing.xxl }]}>
                    <Pressable
                      style={[styles.detailActionButton, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        setShowGroupDetail(false);
                        handleMessageGroupCreator(currentGroup.createdBy);
                      }}
                    >
                      <Feather name="message-circle" size={20} color="#FFFFFF" />
                      <ThemedText style={[Typography.h3, { color: '#FFFFFF', marginLeft: Spacing.md }]}>
                        Message Group Creator
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMessageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.primary }]}>
              <Feather name="message-circle" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Send Direct Message
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Plus members can send messages without matching. Choose an option below to message this group creator.
              </ThemedText>
              
              <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.lg }]}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                  One-Time Message
                </ThemedText>
                <ThemedText style={[Typography.h1, { color: theme.primary, marginBottom: Spacing.xs }]}>
                  $0.99
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Send a single message to this person
                </ThemedText>
              </View>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Start a conversation instantly
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    No matching required
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.primary, opacity: processingMessagePurchase ? 0.7 : 1 }]}
                onPress={handlePurchaseMessageCredit}
                disabled={processingMessagePurchase}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  {processingMessagePurchase ? 'Processing...' : 'Send Message - $0.99'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.warning, marginTop: Spacing.md }]}
                onPress={handleUpgradeForMessaging}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade to Plus
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowMessageModal(false)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMemberProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMemberProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.memberProfileModal, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.memberProfileHeader}>
              <ThemedText style={[Typography.h2]}>Member Profile</ThemedText>
              <Pressable onPress={() => setShowMemberProfile(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            {selectedMember ? (
              <ScrollView style={styles.memberProfileContent} showsVerticalScrollIndicator={false}>
                {selectedMember.photos && selectedMember.photos.length > 0 ? (
                  <Image source={{ uri: selectedMember.photos[0] }} style={styles.memberProfileImage} />
                ) : null}
                
                <View style={styles.memberProfileSection}>
                  <ThemedText style={[Typography.h2]}>{selectedMember.name}, {selectedMember.age}</ThemedText>
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                    {selectedMember.occupation}
                  </ThemedText>
                </View>

                <View style={styles.memberProfileSection}>
                  <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>About</ThemedText>
                  <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                    {selectedMember.bio}
                  </ThemedText>
                </View>

                <View style={styles.memberProfileSection}>
                  <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Budget</ThemedText>
                  <ThemedText style={[Typography.h2, { color: theme.primary }]}>
                    ${selectedMember.budget}/month
                  </ThemedText>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myGroupsList: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  myGroupCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  leaveButton: {
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  membersSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  pendingSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pendingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xl,
  },
  card: {
    width: CARD_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
    borderRadius: BorderRadius.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  groupIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  cardDetail: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardDetailText: {
    alignItems: 'center',
  },
  cardMembersSection: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cardMembersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxl,
    marginTop: Spacing.xl,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  swipeHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: CARD_WIDTH,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  swipeHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  createForm: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  createButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  vipModalContainer: {
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    paddingBottom: Spacing.xl,
  },
  vipModalHeader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
  },
  vipModalContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  vipModalActions: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  vipModalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  vipModalButtonSecondary: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  vipFeaturesList: {
    gap: Spacing.md,
  },
  vipFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContainer: {
    height: '90%',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailContent: {
    flex: 1,
  },
  detailSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  detailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarStackContainer: {
    height: 95,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  avatarWrapper: {
    position: 'absolute',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberProfileModal: {
    height: '85%',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    overflow: 'hidden',
  },
  memberProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  memberProfileContent: {
    flex: 1,
  },
  memberProfileImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  memberProfileSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  compatibilityBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
});
