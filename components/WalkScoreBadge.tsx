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
        <View style={[styles.pedestrian, { transform: [{ scale }] }]}>
          <View style={[styles.head, { backgroundColor: green }]} />
          <View style={[styles.torso, { backgroundColor: green }]} />
          <View style={[styles.leftArmUpper, { backgroundColor: green }]} />
          <View style={[styles.leftArmLower, { backgroundColor: green }]} />
          <View style={[styles.rightArm, { backgroundColor: green }]} />
          <View style={[styles.rightLegUpper, { backgroundColor: green }]} />
          <View style={[styles.rightLegLower, { backgroundColor: green }]} />
          <View style={[styles.leftLeg, { backgroundColor: green }]} />
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
  pedestrian: {
    width: 28,
    height: 36,
    position: 'relative',
    marginTop: -12,
  },
  head: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    position: 'absolute',
    top: 0,
    left: 10.5,
  },
  torso: {
    width: 2.5,
    height: 12,
    position: 'absolute',
    top: 8,
    left: 12.75,
  },
  leftArmUpper: {
    width: 7,
    height: 2.5,
    position: 'absolute',
    top: 10,
    left: 7,
    transform: [{ rotate: '-55deg' }],
  },
  leftArmLower: {
    width: 5,
    height: 2.5,
    position: 'absolute',
    top: 14,
    left: 3.5,
    transform: [{ rotate: '-25deg' }],
  },
  rightArm: {
    width: 8,
    height: 2.5,
    position: 'absolute',
    top: 11,
    right: 5,
    transform: [{ rotate: '45deg' }],
  },
  rightLegUpper: {
    width: 8,
    height: 2.5,
    position: 'absolute',
    bottom: 8,
    right: 7,
    transform: [{ rotate: '-50deg' }],
  },
  rightLegLower: {
    width: 7,
    height: 2.5,
    position: 'absolute',
    bottom: 1,
    right: 3.5,
    transform: [{ rotate: '-75deg' }],
  },
  leftLeg: {
    width: 11,
    height: 2.5,
    position: 'absolute',
    bottom: 3,
    left: 5.5,
    transform: [{ rotate: '35deg' }],
  },
  score: {
    fontWeight: '700',
    marginTop: 6,
  },
});
