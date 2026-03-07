import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../constants/theme';

type AdSize = 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard';

const AD_DIMENSIONS: Record<AdSize, { width: number; height: number }> = {
  banner: { width: 320, height: 50 },
  largeBanner: { width: 320, height: 100 },
  mediumRectangle: { width: 300, height: 250 },
  fullBanner: { width: 468, height: 60 },
  leaderboard: { width: 728, height: 90 },
};

interface AdBannerProps {
  size?: AdSize;
  style?: any;
}

export const AdBanner = ({ size = 'banner', style }: AdBannerProps) => {
  const { theme } = useTheme();
  const { isBasicUser } = useAuth();

  if (!isBasicUser()) return null;

  const dimensions = AD_DIMENSIONS[size];

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.adPlaceholder,
          {
            width: Math.min(dimensions.width, 340),
            height: dimensions.height,
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
          },
        ]}
      >
        <ThemedText style={[Typography.small, { color: theme.textSecondary, textAlign: 'center' }]}>
          Ad Space
        </ThemedText>
      </View>
    </View>
  );
};

type CreditType = 'rewinds' | 'superLikes' | 'boosts' | 'messages';

interface RewardedAdButtonProps {
  creditType: CreditType;
  style?: any;
  compact?: boolean;
}

const CREDIT_CONFIG: Record<CreditType, { icon: string; label: string; reward: string }> = {
  rewinds: { icon: 'rotate-ccw', label: 'Rewind', reward: '+1 Rewind' },
  superLikes: { icon: 'star', label: 'Super Like', reward: '+1 Super Like' },
  boosts: { icon: 'zap', label: 'Boost', reward: '+1 Boost' },
  messages: { icon: 'message-circle', label: 'Messages', reward: '+5 Messages' },
};

export const RewardedAdButton = ({ creditType, style, compact = false }: RewardedAdButtonProps) => {
  const { theme } = useTheme();
  const { isBasicUser, watchAdForCredit, getAdCredits } = useAuth();
  const [isWatching, setIsWatching] = useState(false);

  if (!isBasicUser()) return null;

  const config = CREDIT_CONFIG[creditType];
  const credits = getAdCredits();
  const currentCredits = credits[creditType];

  const handleWatchAd = async () => {
    setIsWatching(true);
    try {
      const result = await watchAdForCredit(creditType);
      if (result.success) {
        Alert.alert('Reward Earned!', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load ad. Please try again.');
    } finally {
      setIsWatching(false);
    }
  };

  if (compact) {
    return (
      <Pressable
        style={[styles.compactButton, { backgroundColor: theme.warning + '20', borderColor: theme.warning }, style]}
        onPress={handleWatchAd}
        disabled={isWatching}
      >
        {isWatching ? (
          <ActivityIndicator size="small" color={theme.warning} />
        ) : (
          <>
            <Feather name="play-circle" size={14} color={theme.warning} />
            <ThemedText style={[Typography.small, { color: theme.warning, fontWeight: '600', marginLeft: 4 }]}>
              Watch Ad {config.reward}
            </ThemedText>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.rewardButton, { backgroundColor: theme.warning + '15', borderColor: theme.warning }, style]}
      onPress={handleWatchAd}
      disabled={isWatching}
    >
      {isWatching ? (
        <View style={styles.watchingContainer}>
          <ActivityIndicator size="small" color={theme.warning} />
          <ThemedText style={[Typography.body, { color: theme.warning, marginLeft: Spacing.sm }]}>
            Watching Ad...
          </ThemedText>
        </View>
      ) : (
        <View style={styles.rewardContent}>
          <View style={styles.rewardLeft}>
            <View style={[styles.playIcon, { backgroundColor: theme.warning }]}>
              <Feather name="play" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.rewardText}>
              <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                Watch Ad for {config.reward}
              </ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                You have {currentCredits} {config.label}{currentCredits !== 1 ? 's' : ''} saved
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  adPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.small,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  rewardButton: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  rewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  watchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
});
