import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from './VectorIcons';
import * as Haptics from 'expo-haptics';

interface AIFloatingButtonProps {
  onPress: () => void;
  top?: number;
  position?: 'floating' | 'inline';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const AIFloatingButton = ({ onPress, top = 16, position = 'floating', size = 'md', style }: AIFloatingButtonProps) => {
  const iconSize = size === 'sm' ? 14 : 16;

  const containerStyle = position === 'floating'
    ? [styles.floatingContainer, { top }, style]
    : [styles.inlineContainer, style];

  return (
    <Pressable
      style={containerStyle}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
    >
      <LinearGradient
        colors={['#ff6b5b', '#e83a2a']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Feather name="cpu" size={iconSize} color="#fff" />
        <Text style={styles.label}>AI</Text>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    borderRadius: 20,
    overflow: 'hidden',
  },
  inlineContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
