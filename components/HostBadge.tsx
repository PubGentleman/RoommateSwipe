import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { HostBadgeType, BADGE_CONFIG } from '../hooks/useHostBadge';

interface HostBadgeProps {
  badge: HostBadgeType;
  size?: 'small' | 'large';
}

export function HostBadge({ badge, size = 'small' }: HostBadgeProps) {
  if (!badge) return null;

  const config = BADGE_CONFIG[badge];

  if (size === 'small') {
    return (
      <View style={[
        styles.smallBadge,
        {
          backgroundColor: `${config.color}${Math.round(config.bgOpacity * 255).toString(16).padStart(2, '0')}`,
          borderColor: `${config.color}${Math.round(config.borderOpacity * 255).toString(16).padStart(2, '0')}`,
        }
      ]}>
        <Feather name={config.icon} size={10} color={config.color} />
        <Text style={[styles.smallText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.largeBadge,
      {
        backgroundColor: `${config.color}14`,
        borderColor: `${config.color}33`,
      }
    ]}>
      <Feather name={config.icon} size={16} color={config.color} />
      <View style={styles.largeBadgeText}>
        <Text style={[styles.largeTitle, { color: config.color }]}>
          {config.detailLabel}
        </Text>
        <Text style={[styles.largeSubtitle, { color: `${config.color}B3` }]}>
          {config.subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  smallText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  largeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  largeBadgeText: {
    flex: 1,
  },
  largeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  largeSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
