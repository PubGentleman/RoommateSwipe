import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';

interface WalkScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
}

const getScoreColor = (score: number): string => {
  if (score >= 90) return '#22C55E';
  if (score >= 80) return '#84CC16';
  if (score >= 70) return '#EAB308';
  if (score >= 50) return '#F97316';
  if (score >= 25) return '#EF4444';
  return '#DC2626';
};

export const WalkScoreBadge = ({ score, size = 'medium' }: WalkScoreBadgeProps) => {
  const { theme } = useTheme();

  const dimensions = {
    small: { size: 50, fontSize: 11, borderWidth: 2, iconScale: 0.5 },
    medium: { size: 65, fontSize: 14, borderWidth: 3, iconScale: 0.7 },
    large: { size: 80, fontSize: 18, borderWidth: 4, iconScale: 0.85 },
  };

  const dim = dimensions[size];
  const scoreColor = getScoreColor(score);
  const green = '#4CAF50';

  const scale = dim.iconScale;
  
  return (
    <View style={[styles.container, { width: dim.size, height: dim.size }]}>
      <View
        style={[
          styles.circle,
          {
            width: dim.size,
            height: dim.size,
            borderWidth: dim.borderWidth,
            borderColor: green,
            borderRadius: dim.size / 2,
          },
        ]}
      >
        <View style={[styles.pedestrianIcon, { transform: [{ scale }] }]}>
          <View style={[styles.head, { backgroundColor: green }]} />
          <View style={[styles.neckShoulder, { backgroundColor: green }]} />
          <View style={[styles.torso, { backgroundColor: green }]} />
          <View style={[styles.armLeft, { backgroundColor: green }]} />
          <View style={[styles.armRight, { backgroundColor: green }]} />
          <View style={[styles.legLeft, { backgroundColor: green }]} />
          <View style={[styles.legRight, { backgroundColor: green }]} />
        </View>
        <ThemedText
          style={[
            styles.score,
            {
              fontSize: dim.fontSize,
              color: scoreColor,
            },
          ]}
        >
          {score}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestrianIcon: {
    width: 36,
    height: 42,
    position: 'relative',
    marginTop: -14,
  },
  head: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: 0,
    left: 13,
  },
  neckShoulder: {
    width: 14,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 10,
    left: 11,
  },
  torso: {
    width: 10,
    height: 14,
    borderRadius: 5,
    position: 'absolute',
    top: 14,
    left: 13,
  },
  armLeft: {
    width: 14,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    top: 15,
    left: 1,
    transform: [{ rotate: '-35deg' }],
  },
  armRight: {
    width: 12,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    top: 16,
    right: 2,
    transform: [{ rotate: '30deg' }],
  },
  legLeft: {
    width: 14,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 4,
    left: 3,
    transform: [{ rotate: '35deg' }],
  },
  legRight: {
    width: 16,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 2,
    right: 1,
    transform: [{ rotate: '-40deg' }],
  },
  score: {
    fontWeight: '700',
    marginTop: 8,
  },
});
