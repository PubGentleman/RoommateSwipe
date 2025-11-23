import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';

interface WalkScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
}

export const WalkScoreBadge = ({ score, size = 'medium' }: WalkScoreBadgeProps) => {
  const { theme } = useTheme();

  const dimensions = {
    small: { size: 50, fontSize: 14 },
    medium: { size: 65, fontSize: 18 },
    large: { size: 80, fontSize: 22 },
  };

  const dim = dimensions[size];

  return (
    <View style={[styles.container, { width: dim.size, height: dim.size }]}>
      <Image
        source={require('../assets/images/walk-score-badge.png')}
        style={[styles.badge, { width: dim.size, height: dim.size }]}
        resizeMode="contain"
      />
      <ThemedText
        style={[
          styles.score,
          {
            fontSize: dim.fontSize,
            color: '#4A4A4A',
          },
        ]}
      >
        {score}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
  },
  score: {
    fontWeight: '700',
    position: 'absolute',
    bottom: '18%',
  },
});
