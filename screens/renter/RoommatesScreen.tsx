import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockRoommateProfiles } from '../../utils/mockData';
import { RoommateProfile } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xxl;

export const RoommatesScreen = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<RoommateProfile[]>(mockRoommateProfiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const currentProfile = profiles[currentIndex];

  const handleSwipeAction = (action: 'like' | 'nope' | 'superlike') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
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
      if (action === 'like' && Math.random() > 0.5) {
        scheduleOnRN(setShowMatch, true);
        setTimeout(() => scheduleOnRN(setShowMatch, false), 3000);
      }
      
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

  if (!currentProfile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="users" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h2, styles.emptyTitle]}>No More Profiles</ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Check back later for new potential roommates
          </ThemedText>
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
              <View style={[styles.compatibilityBadge, { backgroundColor: theme.success }]}>
                <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                  {currentProfile.compatibility}% Match
                </ThemedText>
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
  compatibilityBadge: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
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
