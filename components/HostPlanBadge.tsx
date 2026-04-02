import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

let FeatherIcon: React.ComponentType<{ name: string; size?: number; color?: string }> | null = null;
try {
  const VectorIcons = require('./VectorIcons');
  FeatherIcon = VectorIcons.Feather;
} catch {}

export const HostPlanBadge = ({ plan, showLabel = true, isVerifiedAgent }: Props) => {
  const config = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color }]}>
      {isVerifiedAgent ? (
        FeatherIcon && Platform.OS !== 'web' ? (
          <View style={{ marginRight: 3 }}>
            <FeatherIcon name="shield" size={10} color={config.color} />
          </View>
        ) : (
          <Text style={[styles.shieldText, { color: config.color }]}>&#x25C6;</Text>
        )
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
  shieldText: {
    fontSize: 8,
    marginRight: 3,
    fontWeight: '700',
  },
});
