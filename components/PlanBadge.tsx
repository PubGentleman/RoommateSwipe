import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';

type PlanBadgeProps = {
  plan?: 'basic' | 'plus' | 'elite' | string;
  size?: number;
};

export const PlanBadge = ({ plan, size = 14 }: PlanBadgeProps) => {
  if (!plan || plan === 'basic') return null;

  if (plan === 'plus') {
    return (
      <View style={styles.badge}>
        <Feather name="award" size={size} color="#FFD700" />
      </View>
    );
  }

  if (plan === 'elite') {
    return (
      <View style={styles.badge}>
        <Feather name="shield" size={size} color="#FF4500" />
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  badge: {
    marginLeft: 4,
  },
});
