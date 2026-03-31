import React from 'react';
import { View, Pressable, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from './VectorIcons';

interface OnboardingHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  step?: number;
  totalSteps?: number;
  rightAction?: React.ReactNode;
}

export default function OnboardingHeader({
  title,
  showBack = true,
  onBack,
  step,
  totalSteps,
  rightAction,
}: OnboardingHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : insets.top + 4 }]}>
      <View style={styles.leftSection}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={24} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.centerSection}>
        {step && totalSteps ? (
          <View style={styles.progressContainer}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < step ? styles.progressDotActive : styles.progressDotInactive,
                  i === step - 1 ? styles.progressDotCurrent : null,
                ]}
              />
            ))}
          </View>
        ) : title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : null}
      </View>

      <View style={styles.rightSection}>
        {rightAction || null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 48,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    backgroundColor: '#FF6B6B',
  },
  progressDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotCurrent: {
    width: 24,
    borderRadius: 4,
  },
});
