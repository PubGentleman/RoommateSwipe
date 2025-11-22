import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Animated, ActivityIndicator } from 'react-native';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xxl;

export const GroupsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinedNotification, setShowJoinedNotification] = useState(false);
  const [joinedGroupName, setJoinedGroupName] = useState('');

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
      const otherGroups = groups.filter(g => !g.members.includes(user.id));
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

  const handleJoinGroup = async (group: Group) => {
    if (!user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const updatedMembers = [...group.members, user.id];
    const updatedGroup = { ...group, members: updatedMembers };
    
    await StorageService.addOrUpdateGroup(updatedGroup);
    
    scheduleOnRN(setJoinedGroupName, group.name);
    scheduleOnRN(setShowJoinedNotification, true);
    setTimeout(() => {
      scheduleOnRN(setShowJoinedNotification, false);
      loadGroups();
    }, 2000);
  };

  const handleSwipeAction = async (action: 'join' | 'skip') => {
    if (!currentGroup) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (action === 'join') {
      await handleJoinGroup(currentGroup);
    }

    const direction = action === 'join' ? 1 : -1;
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
        scheduleOnRN(handleSwipeAction, event.translationX > 0 ? 'join' : 'skip');
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

  const renderMyGroup = (group: Group) => {
    const spotsLeft = group.maxMembers - group.members.length;
    
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
            <ThemedText style={[Typography.h4]}>{group.name}</ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              {group.members.length}/{group.maxMembers} members
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
      {myGroups.length > 0 ? (
        <View style={styles.myGroupsSection}>
          <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, paddingHorizontal: Spacing.lg }]}>
            My Groups
          </ThemedText>
          <View style={styles.myGroupsList}>
            {myGroups.map(group => renderMyGroup(group))}
          </View>
        </View>
      ) : null}

      <View style={styles.swipeSection}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg }]}>
          {myGroups.length > 0 ? 'Discover Groups' : 'Browse Groups'}
        </ThemedText>

        {currentGroup ? (
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
                onPress={() => handleSwipeAction('join')}
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
                  Join
                </ThemedText>
                <Feather name="arrow-right" size={16} color={theme.textSecondary} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="users" size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              No More Groups
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              You've seen all available groups.{'\n'}Check back later for new groups!
            </ThemedText>
          </View>
        )}
      </View>

      {showJoinedNotification ? (
        <View style={[styles.matchOverlay, { backgroundColor: theme.primary }]}>
          <Feather name="check-circle" size={64} color="#FFFFFF" />
          <ThemedText style={[Typography.hero, { color: '#FFFFFF', fontSize: 36, marginTop: Spacing.lg }]}>
            You're In!
          </ThemedText>
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.md, textAlign: 'center' }]}>
            You joined {joinedGroupName}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myGroupsSection: {
    marginBottom: Spacing.xl,
  },
  myGroupsList: {
    paddingHorizontal: Spacing.lg,
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
  swipeSection: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: Spacing.xl,
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
