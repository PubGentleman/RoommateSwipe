import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { Typography, Spacing } from '../constants/theme';
import type { VerificationStatus } from '../types/models';

interface VerificationBadgeProps {
  verification?: VerificationStatus;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
}

export function getVerificationLevel(verification?: VerificationStatus): number {
  if (!verification) return 0;
  let count = 0;
  if (verification.phone?.verified) count++;
  if (verification.government_id?.verified) count++;
  if (verification.social_media?.verified) count++;
  return count;
}

export function getVerificationLabel(level: number): string {
  if (level >= 3) return 'Fully Verified';
  if (level === 2) return 'Verified';
  if (level === 1) return 'Partially Verified';
  return 'Not Verified';
}

export function VerificationBadge({ verification, size = 'medium', showLabel = false, onPress }: VerificationBadgeProps) {
  const level = getVerificationLevel(verification);

  if (level === 0) return null;

  const iconSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;
  const badgeColor = level >= 3 ? '#2563EB' : level === 2 ? '#2563EB' : '#6B7280';

  const badge = (
    <View style={[styles.container, size === 'small' ? styles.containerSmall : size === 'large' ? styles.containerLarge : styles.containerMedium]}>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Feather name="check-circle" size={iconSize} color="#FFFFFF" />
        {showLabel ? (
          <ThemedText style={[
            size === 'small' ? Typography.small : Typography.caption,
            { color: '#FFFFFF', marginLeft: Spacing.xs, fontWeight: '600' }
          ]}>
            {getVerificationLabel(level)}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{badge}</Pressable>;
  }

  return badge;
}

export function VerificationBadgeInline({ verification, size = 'small' }: { verification?: VerificationStatus; size?: 'small' | 'medium' }) {
  const level = getVerificationLevel(verification);
  if (level === 0) return null;

  const iconSize = size === 'small' ? 14 : 16;
  const badgeColor = level >= 2 ? '#2563EB' : '#6B7280';

  return (
    <View style={styles.inlineBadge}>
      <Feather name="check-circle" size={iconSize} color={badgeColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  containerSmall: {},
  containerMedium: {},
  containerLarge: {},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inlineBadge: {
    marginLeft: 4,
  },
});
