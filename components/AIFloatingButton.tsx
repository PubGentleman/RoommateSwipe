import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface AIFloatingButtonProps {
  onPress: () => void;
  top?: number;
}

export const AIFloatingButton = ({ onPress, top = 16 }: AIFloatingButtonProps) => {
  return (
    <Pressable
      style={[styles.container, { top }]}
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
        <Feather name="zap" size={20} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    boxShadow: '0 0 12px rgba(255,107,91,0.5)',
  },
  gradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
