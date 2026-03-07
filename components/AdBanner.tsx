import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
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
});
