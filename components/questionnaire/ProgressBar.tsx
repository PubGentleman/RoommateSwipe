import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '../ThemedText';
import { Spacing, Typography } from '../../constants/theme';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps, showLabel = true }) => {
  const progress = (currentStep + 1) / totalSteps;

  const animatedWidth = useAnimatedStyle(() => ({
    width: withSpring(`${progress * 100}%`, { damping: 20, stiffness: 120 }),
  }));

  return (
    <View style={styles.container}>
      {showLabel ? (
        <View style={styles.header}>
          <ThemedText style={styles.label}>
            Step {currentStep + 1} of {totalSteps}
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrap, animatedWidth]}>
          <LinearGradient
            colors={['#ff6b5b', '#A855F7', '#6C5CE7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fillWrap: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: 2,
  },
});
