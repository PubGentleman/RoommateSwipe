import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Animated, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Group } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockRoommateProfiles } from '../../utils/mockData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xxl;

type Tab = 'my-groups' | 'discover' | 'create';

export const GroupsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('my-groups');
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLikedNotification, setShowLikedNotification] = useState(false);
  const [likedGroupName, setLikedGroupName] = useState('');
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupBudget, setGroupBudget] = useState('');
  const [groupLocation, setGroupLocation] = useState('');
  const [groupMaxMembers, setGroupMaxMembers] = useState('4');

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

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

  const handleLikeGroup = async (group: Group) => {
    if (!user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await StorageService.likeGroup(group.id, user.id);
    
    scheduleOnRN(setLikedGroupName, group.name);
    scheduleOnRN(setShowLikedNotification, true);
    setTimeout(() => {
      scheduleOnRN(setShowLikedNotification, false);
      loadGroups();
    }, 2000);
  };

  const handleSwipeAction = async (action: 'like' | 'skip') => {
    if (!currentGroup) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (action === 'like') {
      await handleLikeGroup(currentGroup);
    }

    const direction = action === 'like' ? 1 : -1;
    const toX = direction * SCREEN_WIDTH * 1.5;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: toX,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }),
      Animated.spring(rotation, {
        toValue: direction * 15,
        useNativeDriver: true,
      }),
    ]).start(() => {
      translateX.setValue(0);
      rotation.setValue(0);
      if (action === 'skip') {
        scheduleOnRN(setCurrentIndex, currentIndex + 1);
      }
    });
  };

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.setValue(event.translationX);
      rotation.setValue(event.translationX / 20);
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 120) {
        scheduleOnRN(handleSwipeAction, event.translationX > 0 ? 'like' : 'skip');
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(rotation, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    });

  const rotate = rotation.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg'],
  });

  const handleCreateGroup = async () => {
    if (!user) return;

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

    const newGroup: Group = {
      id: Math.random().toString(36).substr(2, 9),
      name: groupName.trim(),
      description: groupDescription.trim() || undefined,
      members: [user.id],
      pendingMembers: [],
      budget: parseInt(groupBudget),
      preferredLocation: groupLocation.trim(),
      maxMembers: maxMembers,
      createdAt: new Date(),
      createdBy: user.id,
    };

    await StorageService.addOrUpdateGroup(newGroup);

    setGroupName('');
    setGroupDescription('');
    setGroupBudget('');
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

  const handleAcceptMember = async (groupId: string, userId: string) => {
    await StorageService.acceptGroupMember(groupId, userId);
    loadGroups();
  };

  const handleRejectMember = async (groupId: string, userId: string) => {
    await StorageService.rejectGroupMember(groupId, userId);
    loadGroups();
  };

  const renderMyGroup = (group: Group) => {
    const isCreator = group.createdBy === user?.id;
    const memberProfiles = group.members
      .map(id => mockRoommateProfiles.find(p => p.id === id))
      .filter(Boolean);
    const pendingProfiles = group.pendingMembers
      .map(id => mockRoommateProfiles.find(p => p.id === id))
      .filter(Boolean);

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

        {memberProfiles.length > 0 ? (
          <View style={styles.membersSection}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Members
            </ThemedText>
            {memberProfiles.map(profile => profile ? (
              <View key={profile.id} style={styles.memberRow}>
                <ThemedText style={Typography.body}>{profile.name}</ThemedText>
                {isCreator && profile.id !== user?.id ? (
                  <Pressable onPress={() => handleRemoveMember(group.id, profile.id, profile.name)}>
                    <Feather name="x-circle" size={20} color={theme.error} />
                  </Pressable>
                ) : null}
              </View>
            ) : null)}
          </View>
        ) : null}

        {pendingProfiles.length > 0 ? (
          <View style={styles.pendingSection}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Pending Requests ({pendingProfiles.length})
            </ThemedText>
            {pendingProfiles.map(profile => profile ? (
              <View key={profile.id} style={styles.pendingRow}>
                <ThemedText style={Typography.body}>{profile.name}</ThemedText>
                <View style={styles.pendingActions}>
                  <Pressable
                    style={[styles.pendingButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleAcceptMember(group.id, profile.id)}
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
            ) : null)}
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
                {
                  backgroundColor: theme.backgroundDefault,
                  transform: [
                    { translateX },
                    { rotate },
                  ],
                },
              ]}
            >
              <View style={styles.cardContent}>
                <View style={[styles.groupIconLarge, { backgroundColor: theme.primary }]}>
                  <Feather name="users" size={32} color="#FFFFFF" />
                </View>
                
                <ThemedText style={[Typography.h2, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
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
                        Budget
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
              </View>
            </Animated.View>
          </GestureDetector>

          <View style={styles.actionButtons}>
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
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Monthly Budget *</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="e.g., 2000"
            placeholderTextColor={theme.textSecondary}
            value={groupBudget}
            onChangeText={setGroupBudget}
            keyboardType="numeric"
          />
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
          <ThemedText style={[Typography.body, { marginBottom: Spacing.xs }]}>Maximum Members (2-10) *</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.backgroundDefault, 
              color: theme.text,
              borderColor: theme.border
            }]}
            placeholder="4"
            placeholderTextColor={theme.textSecondary}
            value={groupMaxMembers}
            onChangeText={setGroupMaxMembers}
            keyboardType="numeric"
          />
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
    justifyContent: 'center',
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
  actionButtons: {
    flexDirection: 'row',
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
});
