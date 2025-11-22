import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { RoommateProfile, Match } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xxl;

export const RoommatesScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<RoommateProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [profileUsers, setProfileUsers] = useState<Map<string, any>>(new Map());

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const allProfiles = await StorageService.getRoommateProfiles();
      const allUsers = await StorageService.getUsers();
      const history = await StorageService.getSwipeHistory();
      setSwipedIds(history);
      
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      setProfileUsers(userMap);
      
      const unseen = allProfiles.filter(p => !history.has(p.id) && p.id !== user?.id);
      
      const sortedProfiles = unseen.sort((a, b) => {
        const userA = userMap.get(a.id);
        const userB = userMap.get(b.id);
        
        const now = new Date();
        const isActiveBoostA = userA?.boostData?.isBoosted && userA?.boostData?.boostExpiresAt
          ? new Date(userA.boostData.boostExpiresAt) > now
          : false;
        const isActiveBoostB = userB?.boostData?.isBoosted && userB?.boostData?.boostExpiresAt
          ? new Date(userB.boostData.boostExpiresAt) > now
          : false;
        
        const isBoostedA = isActiveBoostA ? 1 : 0;
        const isBoostedB = isActiveBoostB ? 1 : 0;
        if (isBoostedA !== isBoostedB) return isBoostedB - isBoostedA;
        
        const getPriority = (user: typeof userA) => {
          const plan = user?.subscription?.plan || 'free';
          if (plan === 'vip') return 3;
          if (plan === 'premium') return 2;
          return 1;
        };
        
        const priorityA = getPriority(userA);
        const priorityB = getPriority(userB);
        if (priorityA !== priorityB) return priorityB - priorityA;
        
        return (b.compatibility || 0) - (a.compatibility || 0);
      });
      
      setProfiles(sortedProfiles);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSwipeHistory = async () => {
    await StorageService.clearSwipeHistory();
    await loadProfiles();
  };

  const currentProfile = profiles[currentIndex];
  const currentProfileUser = currentProfile ? profileUsers.get(currentProfile.id) : null;
  
  const now = new Date();
  const isBoostActive = currentProfileUser?.boostData?.isBoosted && currentProfileUser?.boostData?.boostExpiresAt
    ? new Date(currentProfileUser.boostData.boostExpiresAt) > now
    : false;
  const isBoosted = isBoostActive;
  const subscriptionPlan = currentProfileUser?.subscription?.plan || 'free';

  const handleSwipeAction = async (action: 'like' | 'nope' | 'superlike') => {
    if (!currentProfile || !user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await StorageService.addToSwipeHistory(currentProfile.id);
    
    if (action === 'like' || action === 'superlike') {
      await StorageService.addLike(user.id, currentProfile.id);
      
      const isReciprocalMatch = await StorageService.checkReciprocalLike(user.id, currentProfile.id);
      if (isReciprocalMatch) {
        const match: Match = {
          id: `match_${Date.now()}`,
          userId1: user.id,
          userId2: currentProfile.id,
          matchedAt: new Date(),
        };
        await StorageService.addMatch(match);
        scheduleOnRN(setShowMatch, true);
        setTimeout(() => scheduleOnRN(setShowMatch, false), 3000);
      }
    }
    
    const direction = action === 'like' ? 1 : action === 'nope' ? -1 : 0;
    const toX = direction * SCREEN_WIDTH * 1.5;
    const toY = action === 'superlike' ? -SCREEN_HEIGHT : 0;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: toX,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }),
      Animated.spring(translateY, {
        toValue: toY,
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
      translateY.setValue(0);
      rotation.setValue(0);
      scheduleOnRN(setCurrentIndex, currentIndex + 1);
    });
  };

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.setValue(event.translationX);
      translateY.setValue(event.translationY);
      rotation.setValue(event.translationX / 20);
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 120) {
        scheduleOnRN(handleSwipeAction, event.translationX > 0 ? 'like' : 'nope');
      } else if (event.translationY < -120) {
        scheduleOnRN(handleSwipeAction, 'superlike');
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(rotation, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="loader" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h2, styles.emptyTitle]}>Loading...</ThemedText>
        </View>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="users" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h2, styles.emptyTitle]}>No More Profiles</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
            You've seen all available roommates
          </ThemedText>
          <Pressable
            style={[styles.resetButton, { backgroundColor: theme.primary }]}
            onPress={resetSwipeHistory}
          >
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Start Over
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const rotate = rotation.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
        <Pressable onPress={() => {}} style={styles.iconButton}>
          <Feather name="sliders" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.cardContainer}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.card,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                ],
              },
            ]}
          >
            <Image source={{ uri: currentProfile.photos[0] }} style={styles.cardImage} />
            <View style={styles.gradient}>
              <View style={styles.topBadges}>
                {isBoosted ? (
                  <View style={[styles.boostBadge, { backgroundColor: '#FFD700' }]}>
                    <Feather name="zap" size={14} color="#000000" />
                    <ThemedText style={[Typography.small, { color: '#000000', fontWeight: '700', marginLeft: 4 }]}>
                      BOOSTED
                    </ThemedText>
                  </View>
                ) : null}
                <View style={[styles.compatibilityBadge, { backgroundColor: theme.success }]}>
                  <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                    {currentProfile.compatibility}% Match
                  </ThemedText>
                </View>
              </View>
              <View style={styles.cardInfo}>
                <ThemedText style={[Typography.hero, { color: '#FFFFFF' }]}>
                  {currentProfile.name}, {currentProfile.age}
                </ThemedText>
                <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.sm }]}>
                  {currentProfile.occupation}
                </ThemedText>
                <ThemedText style={[Typography.caption, { color: '#FFFFFF', marginTop: Spacing.md }]} numberOfLines={3}>
                  {currentProfile.bio}
                </ThemedText>
                <View style={styles.badges}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="dollar-sign" size={14} color="#FFFFFF" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>
                      ${currentProfile.budget}/mo
                    </ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="map-pin" size={14} color="#FFFFFF" />
                    <ThemedText style={[Typography.small, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>
                      {currentProfile.preferences.location}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 100 }]}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderColor: theme.error }]}
          onPress={() => handleSwipeAction('nope')}
        >
          <Feather name="x" size={32} color={theme.error} />
        </Pressable>
        <Pressable
          style={[styles.actionButtonSmall, { backgroundColor: '#FFFFFF', borderColor: theme.info }]}
          onPress={() => handleSwipeAction('superlike')}
        >
          <Feather name="star" size={24} color={theme.info} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderColor: theme.success }]}
          onPress={() => handleSwipeAction('like')}
        >
          <Feather name="heart" size={32} color={theme.success} />
        </Pressable>
      </View>

      {showMatch ? (
        <View style={styles.matchOverlay}>
          <ThemedText style={[Typography.hero, { color: '#FFFFFF', fontSize: 48 }]}>
            It's a Match!
          </ThemedText>
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginTop: Spacing.lg }]}>
            You and {currentProfile.name} both liked each other
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  topBadges: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  compatibilityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  cardInfo: {
    gap: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  actionButton: {
    width: Spacing.swipeButtonSize,
    height: Spacing.swipeButtonSize,
    borderRadius: Spacing.swipeButtonSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonSmall: {
    width: Spacing.swipeButtonSmall,
    height: Spacing.swipeButtonSmall,
    borderRadius: Spacing.swipeButtonSmall / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,107,107,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
