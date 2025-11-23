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
    small: { size: 50, fontSize: 11, borderWidth: 2, iconScale: 0.55 },
    medium: { size: 65, fontSize: 14, borderWidth: 3, iconScale: 0.75 },
    large: { size: 80, fontSize: 18, borderWidth: 4, iconScale: 0.95 },
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
        <View style={[styles.walkingIcon, { transform: [{ scale }] }]}>
          <View style={[styles.head, { backgroundColor: green }]} />
          <View style={[styles.body, { backgroundColor: green }]} />
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
  walkingIcon: {
    width: 28,
    height: 34,
    position: 'relative',
    marginTop: -12,
  },
  head: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 0,
    left: 10,
  },
  body: {
    width: 3,
    height: 13,
    position: 'absolute',
    top: 9,
    left: 12.5,
  },
  armLeft: {
    width: 2.5,
    height: 10,
    position: 'absolute',
    top: 11,
    left: 4,
    transform: [{ rotate: '-45deg' }],
  },
  armRight: {
    width: 2.5,
    height: 9,
    position: 'absolute',
    top: 12,
    right: 5,
    transform: [{ rotate: '50deg' }],
  },
  legLeft: {
    width: 2.5,
    height: 12,
    position: 'absolute',
    bottom: 0,
    left: 5.5,
    transform: [{ rotate: '40deg' }],
  },
  legRight: {
    width: 2.5,
    height: 14,
    position: 'absolute',
    bottom: 0,
    right: 5.5,
    transform: [{ rotate: '-35deg' }],
  },
  score: {
    fontWeight: '700',
    marginTop: 6,
  },
});
