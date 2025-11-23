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
    medium: { size: 65, fontSize: 14, borderWidth: 3, iconScale: 0.65 },
    large: { size: 80, fontSize: 18, borderWidth: 4, iconScale: 0.8 },
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
        <View style={[styles.walker, { transform: [{ scale }] }]}>
          <View style={[styles.head, { backgroundColor: green }]} />
          
          <View style={[styles.body, { backgroundColor: green }]} />
          
          <View style={[styles.armBack, { backgroundColor: green }]} />
          
          <View style={[styles.armForwardUpper, { backgroundColor: green }]} />
          <View style={[styles.armForwardLower, { backgroundColor: green }]} />
          
          <View style={[styles.legBack, { backgroundColor: green }]} />
          
          <View style={[styles.legForwardUpper, { backgroundColor: green }]} />
          <View style={[styles.legForwardLower, { backgroundColor: green }]} />
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
  walker: {
    width: 32,
    height: 40,
    position: 'relative',
    marginTop: -14,
  },
  head: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 2,
    left: 12,
  },
  body: {
    width: 3,
    height: 14,
    position: 'absolute',
    top: 11,
    left: 14.5,
  },
  armBack: {
    width: 3,
    height: 11,
    position: 'absolute',
    top: 13,
    left: 18,
    transform: [{ rotate: '50deg' }],
  },
  armForwardUpper: {
    width: 3,
    height: 9,
    position: 'absolute',
    top: 13,
    left: 8,
    transform: [{ rotate: '-60deg' }],
  },
  armForwardLower: {
    width: 3,
    height: 7,
    position: 'absolute',
    top: 19,
    left: 4,
    transform: [{ rotate: '-30deg' }],
  },
  legBack: {
    width: 3,
    height: 13,
    position: 'absolute',
    bottom: 2,
    left: 9,
    transform: [{ rotate: '40deg' }],
  },
  legForwardUpper: {
    width: 3,
    height: 10,
    position: 'absolute',
    bottom: 10,
    left: 17,
    transform: [{ rotate: '-50deg' }],
  },
  legForwardLower: {
    width: 3,
    height: 9,
    position: 'absolute',
    bottom: 2,
    left: 19,
    transform: [{ rotate: '-70deg' }],
  },
  score: {
    fontWeight: '700',
    marginTop: 8,
  },
});
