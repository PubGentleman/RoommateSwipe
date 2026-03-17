import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, TextInput, ScrollView, Alert, Modal, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Group, RoommateProfile, GroupType } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { getGroups as getGroupsFromSupabase, getMyGroups as getMyGroupsFromSupabase, getMyInquiryGroups as getMyInquiryGroupsFromSupabase, joinGroup as joinGroupSupabase, leaveGroup as leaveGroupSupabase, createGroup as createGroupSupabase, archiveGroup as archiveGroupSupabase } from '../../services/groupService';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGenderSymbol, calculateCompatibility } from '../../utils/matchingAlgorithm';
import { getCityFromNeighborhood } from '../../utils/locationData';
import { getVerificationLevel } from '../../components/VerificationBadge';
import { getZodiacSymbol } from '../../utils/zodiacUtils';
import { AdBanner } from '../../components/AdBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { useCityContext } from '../../contexts/CityContext';
import { CityPickerModal, CityPillButton } from '../../components/CityPickerModal';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';

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
  const { activeCity, recentCities, setActiveCity } = useCityContext();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);
  const [profileCache, setProfileCache] = useState<RoommateProfile[]>([]);
  const [inquiryGroups, setInquiryGroups] = useState<any[]>([]);
  const [showPastInquiries, setShowPastInquiries] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

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
      if (user) {
        StorageService.getPendingGroupInvites(user.id).then(setPendingInvites);
      }
    }, [user, activeCity])
  );

  const loadGroups = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const cachedProfiles = await StorageService.getRoommateProfiles();
      setProfileCache(cachedProfiles);
      let userGroups: Group[] = [];
      let otherGroups: Group[] = [];
      
      try {
        const [supabaseGroups, supabaseMyGroups, supabaseInquiryGroups] = await Promise.all([
          getGroupsFromSupabase(activeCity || undefined, 'roommate'),
          getMyGroupsFromSupabase('roommate'),
          getMyInquiryGroupsFromSupabase(),
        ]);
        const myGroupIds = new Set((supabaseMyGroups || []).map((g: any) => g.id));
        const mapGroup = (g: any): Group & { listingPhoto?: string } => ({
          id: g.id,
          type: g.type || 'roommate',
          name: g.name,
          description: g.description,
          members: [],
          pendingMembers: [],
          budget: g.budget_min || 0,
          budgetMin: g.budget_min,
          budgetMax: g.budget_max,
          city: g.city,
          state: g.state,
          moveInDate: g.move_in_date,
          photoUrl: g.photo_url,
          preferredLocation: g.city || '',
          maxMembers: g.max_members || 4,
          createdAt: new Date(g.created_at),
          createdBy: g.created_by,
          listingId: g.listing_id,
          hostId: g.host_id,
          listingAddress: g.listing_address,
          isArchived: g.is_archived || false,
          memberCount: g.members?.[0]?.count || 0,
          hostName: g.host?.full_name || g.creator?.full_name || 'Host',
          listingPhoto: g.listing?.photos?.[0] || undefined,
          inquiryStatus: g.inquiry_status || 'pending',
          addressRevealed: g.address_revealed || false,
        });
        userGroups = (supabaseMyGroups || []).map(mapGroup);
        otherGroups = (supabaseGroups || [])
          .filter((g: any) => !myGroupIds.has(g.id))
          .map(mapGroup);
        setInquiryGroups((supabaseInquiryGroups || []).map(mapGroup));
      } catch (supabaseError) {
        console.warn('[GroupsScreen] Supabase failed, falling back to StorageService:', supabaseError);
        const groups = await StorageService.getGroups();
        userGroups = groups.filter(g => g.members.includes(user.id));
        const filterCity = activeCity;
        otherGroups = groups.filter(g => {
          if (g.members.includes(user.id) || g.pendingMembers.includes(user.id)) return false;
          if (filterCity && g.preferredLocation) {
            const groupCity = getCityFromNeighborhood(g.preferredLocation);
            if (groupCity && groupCity !== filterCity) return false;
          }
          return true;
        });
      }
      
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
      .map(id => profileCache.find(p => p.id === id))
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
    const AVATAR_SIZE = 90;
    const OVERLAP = 28;
    const EXPANDED_SPACING = 110;

    const memberProfiles = (group.members || [])
      .map(id => profileCache.find(p => p.id === id))
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

    const totalMembers = memberProfiles.length + (remainingCount > 0 ? 1 : 0);
    const stackWidth = avatarsExpanded 
      ? totalMembers * EXPANDED_SPACING
      : AVATAR_SIZE + (totalMembers - 1) * (AVATAR_SIZE - OVERLAP);
    const centerOffset = (CARD_WIDTH - stackWidth) / 2;

    return (
      <Pressable 
        onPress={handleStackPress}
        style={styles.avatarStackContainer}
      >
        <View style={{ position: 'relative', width: stackWidth, height: AVATAR_SIZE }}>
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
                    <Feather name="user" size={32} color="#FFFFFF" />
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
        </View>
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
    
    try {
      await joinGroupSupabase(group.id);
    } catch (supabaseError) {
      console.warn('[GroupsScreen] Supabase joinGroup failed, falling back to StorageService:', supabaseError);
      await StorageService.likeGroup(group.id, user.id);
    }
    
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
    const exitDuration = 200;

    translateX.value = withTiming(toX, { duration: exitDuration });
    rotation.value = withTiming(direction * 15, { duration: exitDuration }, () => {
      translateX.value = 0;
      rotation.value = 0;
      runOnJS(setCurrentIndex)(currentIndex + 1);
    });

    if (action === 'like') {
      await handleLikeGroup(currentGroup);
    }
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
        try {
          await leaveGroupSupabase(groupId);
        } catch (supabaseError) {
          console.warn('[GroupsScreen] Supabase leaveGroup (undo) failed, falling back:', supabaseError);
          await StorageService.unlikeGroup(groupId, user!.id);
        }
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

  const openGroupDetail = () => {
    setShowGroupDetail(true);
  };

  const tap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(openGroupDetail)();
    });

  const pan = Gesture.Pan()
    .minDistance(10)
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

  const cardGesture = Gesture.Race(pan, tap);

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = `${rotation.value}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { rotate },
      ],
    };
  });

  const handleAcceptInvite = async (invite: any) => {
    try {
      const result = await StorageService.respondToGroupInvite(invite.id, true);
      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Joined!', `You have joined "${invite.groupName}".`);
        setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
        await loadGroups();
      }
    } catch {
      Alert.alert('Error', 'Could not accept invite. Try again.');
    }
  };

  const handleDeclineInvite = async (invite: any) => {
    try {
      await StorageService.respondToGroupInvite(invite.id, false);
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch {
      Alert.alert('Error', 'Could not decline invite. Try again.');
    }
  };

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
    if (isNaN(maxMembers) || maxMembers < 1 || maxMembers > 10) {
      Alert.alert('Error', 'Maximum members must be between 1 and 10');
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

    try {
      await createGroupSupabase({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        city: groupLocation.trim(),
        max_members: maxMembers,
        budget_min: parseInt(groupBudget),
        budget_max: apartmentPrice,
      });
    } catch (supabaseError) {
      console.warn('[GroupsScreen] Supabase createGroup failed, falling back to StorageService:', supabaseError);
      await StorageService.addOrUpdateGroup(newGroup);
    }

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
            try {
              await leaveGroupSupabase(group.id);
            } catch (supabaseError) {
              console.warn('[GroupsScreen] Supabase leaveGroup failed, falling back:', supabaseError);
              await StorageService.leaveGroup(group.id, user.id);
            }
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

  const handleArchiveInquiry = async (group: any) => {
    Alert.alert(
      'Archive Inquiry',
      `Archive the inquiry for "${group.listingAddress || group.name}"? The chat will become read-only.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveGroupSupabase(group.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadGroups();
            } catch (err) {
              console.error('Failed to archive inquiry:', err);
              Alert.alert('Error', 'Failed to archive inquiry');
            }
          },
        },
      ]
    );
  };

  const renderInquiryGroup = (group: any) => {
    return (
      <Pressable
        key={group.id}
        style={[styles.myGroupCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          navigation.navigate('Messages', {
            screen: 'Chat',
            params: { conversationId: `inquiry_${group.id}`, inquiryGroup: group },
          });
        }}
        onLongPress={() => {
          if (!group.isArchived) handleArchiveInquiry(group);
        }}
      >
        <View style={styles.groupHeader}>
          {(group as any).listingPhoto ? (
            <Image source={{ uri: (group as any).listingPhoto }} style={[styles.groupIcon, { borderRadius: 12 }]} />
          ) : (
            <View style={[styles.groupIcon, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
              <Feather name="home" size={20} color="#ff6b5b" />
            </View>
          )}
          <View style={styles.groupInfo}>
            <ThemedText style={[Typography.h3]} numberOfLines={1}>
              {group.addressRevealed
                ? (group.listingAddress || group.name)
                : (group.listingAddress?.split(',').slice(-2).join(',').trim() || group.name)}
            </ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              With {group.hostName || 'Host'} · {group.memberCount || 0} members
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {group.isArchived ? (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>Archived</ThemedText>
              </View>
            ) : group.inquiryStatus === 'accepted' ? (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
                <ThemedText style={[Typography.small, { color: '#ff6b5b' }]}>Address Unlocked 🔓</ThemedText>
              </View>
            ) : group.inquiryStatus === 'declined' ? (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <ThemedText style={[Typography.small, { color: '#ef4444' }]}>Declined</ThemedText>
              </View>
            ) : (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>Pending</ThemedText>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderMyGroup = (group: Group) => {
    const isCreator = group.createdBy === user?.id;
    const memberProfiles = (group.members || [])
      .map(id => profileCache.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined);
    const pendingProfiles = (group.pendingMembers || [])
      .map(id => profileCache.find(p => p.id === id))
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

        {group.members.length <= 1 ? (
          <View style={styles.soloGroupBanner}>
            <Feather name="user-plus" size={20} color="#ff6b5b" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ThemedText style={styles.soloGroupTitle}>Looking for Roommates</ThemedText>
              <ThemedText style={styles.soloGroupDesc}>
                Your group is visible to other renters. Share your group code to invite people directly.
              </ThemedText>
            </View>
          </View>
        ) : null}

        {memberProfiles.length > 0 ? (
          <View style={styles.membersSection}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Members
            </ThemedText>
            {memberProfiles.map(profile => (
              <View key={profile.id} style={styles.memberRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <ThemedText style={Typography.body}>
                    {profile.name || 'Unknown'}{profile.age ? `, ${profile.age}` : ''}{profile.zodiacSign ? ` ${getZodiacSymbol(profile.zodiacSign)}` : ''} {getGenderSymbol(profile.gender)}
                  </ThemedText>
                  {getVerificationLevel(profile.verification) >= 2 ? (
                    <Feather name="check-circle" size={14} color="#2563EB" style={{ marginLeft: 4 }} />
                  ) : null}
                </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <ThemedText style={Typography.body}>
                    {profile.name || 'Unknown'}{profile.age ? `, ${profile.age}` : ''}{profile.zodiacSign ? ` ${getZodiacSymbol(profile.zodiacSign)}` : ''} {getGenderSymbol(profile.gender)}
                  </ThemedText>
                  {getVerificationLevel(profile.verification) >= 2 ? (
                    <Feather name="check-circle" size={14} color="#2563EB" style={{ marginLeft: 4 }} />
                  ) : null}
                </View>
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
      const activeInquiries = inquiryGroups.filter(g => !g.isArchived);
      const archivedInquiries = inquiryGroups.filter(g => g.isArchived);

      return (
        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={styles.myGroupsList}
          showsVerticalScrollIndicator={false}
        >
          {pendingInvites.length > 0 ? (
            <View style={styles.invitesSection}>
              <View style={styles.sectionHeader}>
                <Feather name="mail" size={16} color="#ff6b5b" />
                <ThemedText style={[Typography.h3, { marginLeft: 8 }]}>Group Invites</ThemedText>
              </View>
              {pendingInvites.map(invite => (
                <View key={invite.id} style={styles.inviteCard}>
                  <View style={styles.inviteInfo}>
                    <Feather name="users" size={16} color="#ff6b5b" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <ThemedText style={styles.inviteGroupName}>{invite.groupName}</ThemedText>
                      <ThemedText style={styles.inviteFrom}>Invited by {invite.invitedByName}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.inviteActions}>
                    <Pressable
                      style={styles.inviteAccept}
                      onPress={() => handleAcceptInvite(invite)}
                    >
                      <Text style={styles.inviteAcceptText}>Join</Text>
                    </Pressable>
                    <Pressable
                      style={styles.inviteDecline}
                      onPress={() => handleDeclineInvite(invite)}
                    >
                      <Text style={styles.inviteDeclineText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Feather name="users" size={16} color="#ff6b5b" />
            <ThemedText style={[Typography.h3, { marginLeft: 8 }]}>My Roommate Groups</ThemedText>
          </View>
          {myGroups.length === 0 ? (
            <View style={[styles.emptyState, { paddingVertical: 30 }]}>
              <Feather name="users" size={40} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                No groups yet — create or discover one!
              </ThemedText>
            </View>
          ) : (
            myGroups.map(group => renderMyGroup(group))
          )}

          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Feather name="home" size={16} color="#ff6b5b" />
            <ThemedText style={[Typography.h3, { marginLeft: 8 }]}>Listing Inquiries</ThemedText>
          </View>
          {activeInquiries.length === 0 ? (
            <View style={[styles.emptyState, { paddingVertical: 30 }]}>
              <Feather name="home" size={40} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                No listing inquiries yet
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                Tap "Inquire Together" on any listing to start one
              </ThemedText>
            </View>
          ) : (
            activeInquiries.map(group => renderInquiryGroup(group))
          )}

          {archivedInquiries.length > 0 ? (
            <>
              <Pressable
                style={[styles.sectionHeader, { marginTop: 24 }]}
                onPress={() => setShowPastInquiries(!showPastInquiries)}
              >
                <Feather name="archive" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { marginLeft: 8, color: theme.textSecondary }]}>
                  Past Inquiries ({archivedInquiries.length})
                </ThemedText>
                <Feather
                  name={showPastInquiries ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.textSecondary}
                  style={{ marginLeft: 'auto' }}
                />
              </Pressable>
              {showPastInquiries ? archivedInquiries.map(group => renderInquiryGroup(group)) : null}
            </>
          ) : null}
        </ScrollView>
      );
    }

    if (activeTab === 'discover') {
      if (!currentGroup) {
        return (
          <View style={styles.emptyState}>
            <Feather name="users" size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              {activeCity ? `No Groups in ${activeCity}` : 'No More Groups'}
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              {activeCity
                ? 'Try browsing All Cities or switch to a different city'
                : "You've seen all available groups.\nCheck back later for new groups!"}
            </ThemedText>
          </View>
        );
      }

      const compatibility = calculateGroupCompatibility(currentGroup);
      const spotsLeft = currentGroup.maxMembers - currentGroup.members.length;
      const memberProfiles = currentGroup.members
        .map(id => profileCache.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);

      return (
        <View style={styles.cardContainer}>
          <GestureDetector gesture={cardGesture}>
            <Animated.View style={[styles.card, animatedCardStyle]}>
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={styles.cardContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.dkAvatarCluster}>
                  {memberProfiles.slice(0, 2).map((profile, i) => {
                    const gradients: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d']];
                    return (
                      <Pressable
                        key={profile.id}
                        onPress={() => { setSelectedMember(profile); setShowMemberProfile(true); }}
                        style={[styles.dkAvatar, i > 0 && { marginLeft: -18 }, { zIndex: 3 - i }]}
                      >
                        {profile.photos?.[0] ? (
                          <Image source={{ uri: profile.photos[0] }} style={styles.dkAvatarImg} />
                        ) : (
                          <LinearGradient colors={gradients[i % 3]} style={styles.dkAvatarImg}>
                            <Text style={styles.dkAvatarLetter}>{profile.name[0]}</Text>
                          </LinearGradient>
                        )}
                      </Pressable>
                    );
                  })}
                  {spotsLeft > 0 ? (
                    <View style={[styles.dkAvatar, styles.dkAvatarEmpty, { marginLeft: -18, zIndex: 0 }]}>
                      <Text style={styles.dkAvatarPlus}>+</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.dkMatchBadge}>
                  <Feather name="heart" size={12} color="#ff8070" />
                  <Text style={styles.dkMatchBadgeText}>{compatibility}% Group Match</Text>
                </View>

                <Text style={styles.dkGroupName}>{currentGroup.name}</Text>

                <View style={styles.dkMembersCount}>
                  <Feather name="users" size={13} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.dkMembersCountText}>
                    {currentGroup.members.length} of {currentGroup.maxMembers} members filled
                  </Text>
                  {spotsLeft > 0 ? (
                    <View style={styles.dkSpotPill}>
                      <Text style={styles.dkSpotPillText}>{spotsLeft} left</Text>
                    </View>
                  ) : null}
                </View>

                {currentGroup.description ? (
                  <Text style={styles.dkGroupDesc}>{currentGroup.description}</Text>
                ) : null}

                <View style={styles.dkStatsRow}>
                  <View style={styles.dkStatCard}>
                    <View style={styles.dkStatIcon}>
                      <Feather name="dollar-sign" size={16} color="#ff6b5b" />
                    </View>
                    <View>
                      <Text style={styles.dkStatLabel}>BUDGET</Text>
                      <Text style={styles.dkStatValue}>${currentGroup.budget?.toLocaleString()}/mo</Text>
                    </View>
                  </View>
                  <View style={styles.dkStatCard}>
                    <View style={styles.dkStatIcon}>
                      <Feather name="map-pin" size={16} color="#ff6b5b" />
                    </View>
                    <View>
                      <Text style={styles.dkStatLabel}>LOCATION</Text>
                      <Text style={styles.dkStatValue} numberOfLines={1}>{currentGroup.preferredLocation}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.dkDivider} />

                {memberProfiles.length > 0 ? (
                  <View style={styles.dkMembersSection}>
                    <Text style={styles.dkMembersLabel}>CURRENT MEMBERS</Text>
                    <View style={styles.dkMembersList}>
                      {memberProfiles.map((profile, i) => {
                        const gradients: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d']];
                        return (
                          <Pressable
                            key={profile.id}
                            style={styles.dkMemberChip}
                            onPress={() => { setSelectedMember(profile); setShowMemberProfile(true); }}
                          >
                            {profile.photos?.[0] ? (
                              <Image source={{ uri: profile.photos[0] }} style={styles.dkMemberAvatar} />
                            ) : (
                              <LinearGradient colors={gradients[i % 3]} style={styles.dkMemberAvatar}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{profile.name[0]}</Text>
                              </LinearGradient>
                            )}
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.dkMemberName}>{profile.name.split(' ')[0]}</Text>
                                {getVerificationLevel(profile.verification) >= 2 ? (
                                  <Feather name="check-circle" size={12} color="#2563EB" style={{ marginLeft: 3 }} />
                                ) : null}
                              </View>
                              <Text style={styles.dkMemberMeta}>
                                {profile.occupation?.split(' ')[0] || 'Member'} {getGenderSymbol(profile.gender)}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </Animated.View>
          </GestureDetector>

          <View style={styles.dkAdCard}>
            <View style={styles.dkAdLeft}>
              <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.dkAdLogo}>
                <Feather name="home" size={16} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={styles.dkAdSponsored}>SPONSORED</Text>
                <Text style={styles.dkAdTitle}>List your room on Roomdr</Text>
                <Text style={styles.dkAdSub}>Reach 50k+ renters in your area</Text>
              </View>
            </View>
            <Pressable style={styles.dkAdBtn}>
              <Text style={styles.dkAdBtnText}>View</Text>
            </Pressable>
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.dkActBtn, styles.dkActSm, styles.dkActUndo, { opacity: lastSwipedGroup ? 1 : 0.4 }]}
              onPress={handleUndo}
            >
              <Feather name="rotate-ccw" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <Pressable
              style={[styles.dkActBtn, styles.dkActLg, styles.dkActPass]}
              onPress={() => handleSwipeAction('skip')}
            >
              <Feather name="x" size={26} color="#ff4d4d" />
            </Pressable>
            <Pressable
              style={[styles.dkActBtn, styles.dkActXl, styles.dkActJoin]}
              onPress={() => handleSwipeAction('like')}
            >
              <Feather name="heart" size={30} color="#2ecc71" />
            </Pressable>
          </View>

          <View style={styles.swipeHint}>
            <View style={styles.swipeHintItem}>
              <Feather name="arrow-left" size={12} color="rgba(255,255,255,0.2)" />
              <Text style={styles.dkHintText}>Skip</Text>
            </View>
            <View style={styles.swipeHintItem}>
              <Text style={styles.dkHintText}>Request to Join</Text>
              <Feather name="arrow-right" size={12} color="rgba(255,255,255,0.2)" />
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
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
          Create a New Group
        </ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.lg, lineHeight: 18 }]}>
          Start solo and invite roommates later, or create a group with people you already know.
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
            Maximum Members (1-10) {groupBedrooms.trim() ? '(Auto-set from bedrooms)' : ''}
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
    <View style={[styles.container, { backgroundColor: '#111111', paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}>
      <View style={styles.groupsTopNav}>
        <Pressable onPress={() => setShowAISheet(true)} style={styles.groupsAiBtn}>
          <View style={styles.groupsAiBtnInner}>
            <Feather name="cpu" size={18} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {(['my-groups', 'discover', 'create'] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'my-groups' ? 'My Groups' : tab === 'discover' ? 'Discover' : 'Create';
          return (
            <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
              {isActive ? (
                <LinearGradient
                  colors={['#ff6b5b', '#e83a2a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabIndicator}
                />
              ) : null}
            </Pressable>
          );
        })}
        <View style={styles.tabBarLine} />
      </View>

      {activeTab === 'discover' ? (
        <View style={styles.citySelectorRow}>
          <CityPillButton activeCity={activeCity} onPress={() => setShowCityPicker(true)} />
        </View>
      ) : null}

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
                      const profile = profileCache.find(p => p.id === memberId);
                      return profile ? (
                        <View key={memberId} style={styles.memberRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ThemedText style={Typography.body}>
                              {profile.name}{profile.age ? `, ${profile.age}` : ''}{profile.zodiacSign ? ` ${getZodiacSymbol(profile.zodiacSign)}` : ''} {getGenderSymbol(profile.gender)}
                            </ThemedText>
                            {getVerificationLevel(profile.verification) >= 2 ? (
                              <Feather name="check-circle" size={14} color="#2563EB" style={{ marginLeft: 4 }} />
                            ) : null}
                          </View>
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

      <CityPickerModal
        visible={showCityPicker}
        activeCity={activeCity}
        recentCities={recentCities}
        onCitySelect={(city) => { setActiveCity(city); setShowCityPicker(false); }}
        onClose={() => setShowCityPicker(false)}
      />

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
                  <ThemedText style={[Typography.h2]}>{selectedMember.name}, {selectedMember.age}{selectedMember.zodiacSign ? ` ${getZodiacSymbol(selectedMember.zodiacSign)}` : ''}</ThemedText>
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

      <RoomdrAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="groups"
        contextData={activeTab === 'discover' && allGroups[currentIndex] ? {
          groups: {
            currentGroup: allGroups[currentIndex],
            groupCompatibility: calculateGroupCompatibility(allGroups[currentIndex]),
            memberProfiles: allGroups[currentIndex].members
              .map(id => profileCache.find(p => p.id === id))
              .filter((p): p is RoommateProfile => !!p),
            openSpots: allGroups[currentIndex].maxMembers - allGroups[currentIndex].members.length,
          },
        } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  groupsTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  groupsAiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  groupsAiBtnInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff4d4d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    position: 'relative',
  },
  tabBarLine: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2.5,
    borderRadius: 2,
    zIndex: 1,
  },
  citySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: Spacing.sm,
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
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  dkAvatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dkAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
  },
  dkAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkAvatarLetter: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  dkAvatarEmpty: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkAvatarPlus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
  },
  dkMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.35)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  dkMatchBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff8070',
  },
  dkGroupName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  dkMembersCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dkMembersCountText: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  dkSpotPill: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  dkSpotPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2ecc71',
  },
  dkGroupDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
    maxWidth: 280,
  },
  dkStatsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 18,
  },
  dkStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 12,
  },
  dkStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dkStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  dkDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  dkMembersSection: {
    width: '100%',
  },
  dkMembersLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  dkMembersList: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  dkMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 6,
  },
  dkMemberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkMemberName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 14,
  },
  dkMemberMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  dkAdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 10,
    paddingHorizontal: 14,
  },
  dkAdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dkAdLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkAdSponsored: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.5,
  },
  dkAdTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  dkAdSub: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.35)',
  },
  dkAdBtn: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  dkAdBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 6,
  },
  dkActBtn: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  dkActSm: { width: 46, height: 46 },
  dkActLg: { width: 62, height: 62 },
  dkActXl: { width: 70, height: 70 },
  dkActUndo: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dkActPass: {
    borderColor: '#ff4d4d',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  dkActJoin: {
    borderColor: '#2ecc71',
    backgroundColor: 'rgba(46,204,113,0.1)',
  },
  swipeHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 6,
  },
  swipeHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dkHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.2)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#111111',
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
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  avatarWrapper: {
    position: 'absolute',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  inquiryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  soloGroupBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 12,
    padding: 14,
    marginTop: Spacing.md,
    marginBottom: 16,
  },
  soloGroupTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  soloGroupDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  invitesSection: {
    marginBottom: 20,
  },
  inviteCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inviteGroupName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  inviteFrom: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteAccept: {
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteAcceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  inviteDecline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteDeclineText: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    fontSize: 13,
  },
});
