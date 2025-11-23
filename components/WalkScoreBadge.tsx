import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';

interface WalkScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
}

export const WalkScoreBadge = ({ score, size = 'medium' }: WalkScoreBadgeProps) => {
  const { theme } = useTheme();

  const dimensions = {
    small: { width: 50, height: 50, fontSize: 20, labelSize: 8 },
    medium: { width: 65, height: 65, fontSize: 28, labelSize: 9 },
    large: { width: 80, height: 80, fontSize: 36, labelSize: 10 },
  };

  const dim = dimensions[size];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: dim.width,
            height: dim.height,
            backgroundColor: '#E8F0F7',
            borderColor: '#7DA3C6',
          },
        ]}
      >
        <ThemedText
          style={[
            styles.label,
            {
              fontSize: dim.labelSize,
              color: '#5B8AB8',
            },
          ]}
        >
          Walk Score
        </ThemedText>
        <ThemedText
          style={[
            styles.score,
            {
              fontSize: dim.fontSize,
              color: '#2C4A61',
            },
          ]}
        >
          {score}
        </ThemedText>
      </View>
      <View
        style={[
          styles.pointer,
          {
            borderTopColor: '#7DA3C6',
          },
        ]}
      />
      <View
        style={[
          styles.pointerInner,
          {
            borderTopColor: '#E8F0F7',
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: BorderRadius.medium,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  score: {
    fontWeight: '700',
    lineHeight: undefined,
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 6,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderLeftWidth: 5,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    marginTop: -2,
  },
  pointerInner: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 5,
    borderRightWidth: 4,
    borderBottomWidth: 0,
    borderLeftWidth: 4,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    marginTop: -5,
  },
});
