import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { HostPlanType } from '../types/models';

interface Props {
  plan: HostPlanType;
  showLabel?: boolean;
  isVerifiedAgent?: boolean;
}

const PLAN_CONFIG: Record<HostPlanType, { color: string; bg: string; label: string }> = {
  free: { color: '#888', bg: '#1A1A1A', label: 'Free' },
  none: { color: '#888', bg: '#1A1A1A', label: 'Free' },
  starter: { color: '#5b8cff', bg: 'rgba(91,140,255,0.15)', label: 'Starter' },
  pro: { color: '#a855f7', bg: 'rgba(168,85,247,0.15)', label: 'Pro' },
  business: { color: '#ffd700', bg: 'rgba(255,215,0,0.15)', label: 'Business' },
};

export const HostPlanBadge = ({ plan, showLabel = true, isVerifiedAgent }: Props) => {
  const config = PLAN_CONFIG[plan];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color }]}>
      {isVerifiedAgent ? (
        <Feather name="shield" size={10} color={config.color} style={{ marginRight: 3 }} />
      ) : null}
      {showLabel ? (
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
