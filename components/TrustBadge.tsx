import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import type { TrustScore } from '../types/models';
import { getTrustLevelLabel } from '../utils/trustScore';

interface Props {
  trustScore: TrustScore;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  showScore?: boolean;
}

export function TrustBadge({ trustScore, size = 'medium', onPress, showScore = false }: Props) {
  const iconSize = size === 'small' ? 12 : size === 'large' ? 20 : 16;
  const fontSize = size === 'small' ? 10 : size === 'large' ? 14 : 12;

  const iconName: any = trustScore.level === 'fully_trusted' ? 'shield'
    : trustScore.level === 'trusted' ? 'shield'
    : trustScore.level === 'verified' ? 'check-circle'
    : trustScore.level === 'basic' ? 'check'
    : 'alert-circle';

  const content = (
    <View style={[styles.badge, { backgroundColor: trustScore.badgeColor + '15' }]}>
      <Feather name={iconName} size={iconSize} color={trustScore.badgeColor} />
      <ThemedText style={[styles.label, { fontSize, color: trustScore.badgeColor }]}>
        {getTrustLevelLabel(trustScore.level)}
      </ThemedText>
      {showScore ? (
        <ThemedText style={[styles.score, { fontSize: fontSize - 2, color: trustScore.badgeColor }]}>
          {trustScore.overall}
        </ThemedText>
      ) : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
  score: {
    fontWeight: '700',
    marginLeft: 2,
  },
});
