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
    small: { size: 50, fontSize: 11, borderWidth: 2, iconScale: 0.6 },
    medium: { size: 65, fontSize: 14, borderWidth: 3, iconScale: 0.8 },
    large: { size: 80, fontSize: 18, borderWidth: 4, iconScale: 1 },
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
        <View style={[styles.icon, { transform: [{ scale }] }]}>
          <View style={[styles.head, { backgroundColor: green }]} />
          <View style={[styles.body, { backgroundColor: green }]} />
          <View style={[styles.leftArm, { backgroundColor: green }]} />
          <View style={[styles.rightArm, { backgroundColor: green }]} />
          <View style={[styles.leftLeg, { backgroundColor: green }]} />
          <View style={[styles.rightLeg, { backgroundColor: green }]} />
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
  icon: {
    width: 24,
    height: 30,
    alignItems: 'center',
    marginTop: -8,
  },
  head: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  body: {
    width: 2,
    height: 12,
    marginBottom: 0,
  },
  leftArm: {
    position: 'absolute',
    top: 10,
    left: 7,
    width: 8,
    height: 2,
    transform: [{ rotate: '-45deg' }],
  },
  rightArm: {
    position: 'absolute',
    top: 10,
    right: 7,
    width: 8,
    height: 2,
    transform: [{ rotate: '45deg' }],
  },
  leftLeg: {
    position: 'absolute',
    bottom: 0,
    left: 7,
    width: 2,
    height: 10,
    transform: [{ rotate: '-20deg' }],
  },
  rightLeg: {
    position: 'absolute',
    bottom: 0,
    right: 7,
    width: 2,
    height: 10,
    transform: [{ rotate: '20deg' }],
  },
  score: {
    fontWeight: '700',
    marginTop: 2,
  },
});
