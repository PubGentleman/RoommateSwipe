import React from 'react';
import { View, Pressable, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from './VectorIcons';
import { RhomeLogo } from './RhomeLogo';
import { ProgressBar } from './questionnaire/ProgressBar';

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
      <View style={styles.topRow}>
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
          <RhomeLogo variant="icon-only" size="sm" />
        </View>

        <View style={styles.centerSection} />

        <View style={styles.rightSection}>
          {rightAction || null}
        </View>
      </View>

      {step && totalSteps ? (
        <View style={styles.progressWrap}>
          <ProgressBar currentStep={step - 1} totalSteps={totalSteps} showLabel={false} />
        </View>
      ) : title ? (
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    textAlign: 'center',
    marginTop: 2,
  },
  progressWrap: {
    paddingHorizontal: 8,
    paddingTop: 2,
  },
});
