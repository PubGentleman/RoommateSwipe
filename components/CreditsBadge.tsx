import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';

interface Props {
  credits: number;
  onPress: () => void;
}

export function CreditsBadge({ credits, onPress }: Props) {
  const hasCredits = credits > 0;
  return (
    <Pressable
      style={[styles.badge, hasCredits ? styles.badgeActive : styles.badgeInactive]}
      onPress={onPress}
    >
      <Feather name="gift" size={12} color={hasCredits ? '#ff6b5b' : '#A0A0A0'} />
      <Text style={[styles.text, hasCredits ? styles.textActive : styles.textInactive]}>
        ${credits}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeActive: { backgroundColor: 'rgba(255,107,91,0.12)' },
  badgeInactive: { backgroundColor: 'rgba(160,160,160,0.08)' },
  text: { fontSize: 13, fontWeight: '700' },
  textActive: { color: '#ff6b5b' },
  textInactive: { color: '#A0A0A0' },
});
