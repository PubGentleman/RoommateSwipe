import React, { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import {
  type UpgradePromptData,
  recordPromptShown,
} from '../services/upgradePromptService';

interface Props {
  data: UpgradePromptData;
  onUpgrade: () => void;
  onDismiss: () => void;
  variant?: 'banner' | 'card';
}

const URGENCY_ACCENTS = {
  low: '#6C5CE7',
  medium: '#f59e0b',
  high: '#ef4444',
};

export default function SmartUpgradePrompt({ data, onUpgrade, onDismiss, variant = 'card' }: Props) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(variant === 'banner' ? -80 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const accent = URGENCY_ACCENTS[data.urgency];

  useEffect(() => {
    recordPromptShown(data.context, false);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDismiss);
  };

  const handleUpgrade = () => {
    onUpgrade();
  };

  if (variant === 'banner') {
    return (
      <Animated.View style={[
        styles.banner,
        {
          backgroundColor: accent + '10',
          borderColor: accent + '30',
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}>
        <View style={styles.bannerContent}>
          <Feather name="zap" size={16} color={accent} />
          <ThemedText style={[Typography.caption, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>
            {data.title}
          </ThemedText>
          {data.stat ? (
            <ThemedText style={[Typography.caption, { color: accent, fontWeight: '700' }]}>
              {data.stat}
            </ThemedText>
          ) : null}
        </View>
        <Pressable onPress={handleUpgrade} style={[styles.bannerCta, { backgroundColor: accent }]}>
          <ThemedText style={[Typography.caption, { color: '#FFFFFF', fontWeight: '600' }]}>
            {data.ctaText}
          </ThemedText>
        </Pressable>
        {data.dismissible ? (
          <Pressable onPress={handleDismiss} style={styles.bannerClose}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[
      styles.card,
      {
        backgroundColor: accent + '10',
        borderColor: accent + '30',
        opacity: opacityAnim,
      },
    ]}>
      {data.dismissible ? (
        <Pressable onPress={handleDismiss} style={styles.cardClose}>
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <ThemedText style={[Typography.h3, { marginBottom: 4 }]}>{data.title}</ThemedText>
      <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.md, lineHeight: 20 }]}>
        {data.message}
      </ThemedText>

      {data.statProgress !== undefined ? (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[
              styles.progressBarFill,
              {
                width: `${Math.min(data.statProgress * 100, 100)}%` as any,
                backgroundColor: data.statProgress >= 1 ? '#ef4444' : data.statProgress >= 0.8 ? '#f59e0b' : '#22c55e',
              },
            ]} />
          </View>
          {data.stat ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4, textAlign: 'right' }]}>
              {data.stat}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.md, fontStyle: 'italic' }]}>
        {data.benefit}
      </ThemedText>

      <Pressable
        onPress={handleUpgrade}
        style={[styles.upgradeCta, { backgroundColor: accent }]}
      >
        <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '700' }]}>
          {data.ctaText}
        </ThemedText>
        <Feather name="arrow-right" size={16} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bannerCta: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.small,
    marginLeft: Spacing.sm,
  },
  bannerClose: {
    padding: 4,
    marginLeft: 4,
  },
  card: {
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  cardClose: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    padding: 4,
    zIndex: 1,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  upgradeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
});
