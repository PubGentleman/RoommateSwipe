import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
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
    small: { size: 50, fontSize: 11, borderWidth: 2, iconSize: 18 },
    medium: { size: 65, fontSize: 14, borderWidth: 3, iconSize: 24 },
    large: { size: 80, fontSize: 18, borderWidth: 4, iconSize: 30 },
  };

  const dim = dimensions[size];
  const scoreColor = getScoreColor(score);
  const green = '#4CAF50';
  
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
        <Image
          source={require('../assets/images/walking-person-green.png')}
          style={[styles.icon, { width: dim.iconSize, height: dim.iconSize }]}
          resizeMode="contain"
        />
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
    marginTop: -8,
  },
  score: {
    fontWeight: '700',
    marginTop: 2,
  },
});
