import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius } from '../constants/theme';
import InlinePlanCompare from './InlinePlanCompare';

interface FeatureGateProps {
  isUnlocked: boolean;
  requiredPlan: string;
  requiredPlanLabel: string;
  featureDescription: string;
  featureName: string;
  lockStyle?: 'blur' | 'overlay' | 'replace';
  onUpgrade: () => void;
  showPlanCompare?: boolean;
  role: 'renter' | 'host';
  currentPlan: string;
  children: React.ReactNode;
}

export default function FeatureGate({
  isUnlocked,
  requiredPlan,
  requiredPlanLabel,
  featureDescription,
  featureName,
  lockStyle = 'blur',
  onUpgrade,
  showPlanCompare = false,
  role,
  currentPlan,
  children,
}: FeatureGateProps) {
  const { theme } = useTheme();
  const [showCompare, setShowCompare] = useState(false);

  if (isUnlocked) return <>{children}</>;

  if (lockStyle === 'replace') {
    return (
      <View style={styles.replaceContainer}>
        <View style={[styles.lockIconCircle, { backgroundColor: '#6C5CE715' }]}>
          <Feather name="lock" size={28} color="#6C5CE7" />
        </View>
        <ThemedText style={styles.replaceTitle}>{featureName}</ThemedText>
        <ThemedText style={[styles.replaceDescription, { color: theme.textSecondary }]}>
          {featureDescription}
        </ThemedText>
        <View style={styles.planBadge}>
          <Feather name="star" size={12} color="#f59e0b" />
          <ThemedText style={styles.planBadgeText}>Requires {requiredPlanLabel}</ThemedText>
        </View>

        <Pressable style={styles.upgradeButton} onPress={onUpgrade}>
          <ThemedText style={styles.upgradeButtonText}>Upgrade to {requiredPlanLabel}</ThemedText>
        </Pressable>

        {showPlanCompare ? (
          <Pressable onPress={() => setShowCompare(true)}>
            <ThemedText style={styles.comparePlansLink}>Compare plans</ThemedText>
          </Pressable>
        ) : null}

        {showCompare ? (
          <InlinePlanCompare
            role={role}
            currentPlan={currentPlan}
            highlightPlan={requiredPlan}
            onClose={() => setShowCompare(false)}
            onSelectPlan={() => {
              setShowCompare(false);
              onUpgrade();
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.gateContainer}>
      <View style={styles.contentBehind} pointerEvents="none">
        {children}
      </View>

      {lockStyle === 'blur' ? (
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.overlayContent}>
            <View style={[styles.lockIconCircle, { backgroundColor: '#6C5CE715' }]}>
              <Feather name="lock" size={24} color="#6C5CE7" />
            </View>
            <ThemedText style={styles.overlayTitle}>{featureName}</ThemedText>
            <ThemedText style={[styles.overlayDescription, { color: theme.textSecondary }]}>
              {featureDescription}
            </ThemedText>
            <Pressable style={styles.overlayUpgradeButton} onPress={onUpgrade}>
              <ThemedText style={styles.overlayUpgradeText}>Unlock with {requiredPlanLabel}</ThemedText>
            </Pressable>
            {showPlanCompare ? (
              <Pressable onPress={() => setShowCompare(true)} style={{ marginTop: Spacing.sm }}>
                <ThemedText style={styles.comparePlansLink}>Compare plans</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </BlurView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <View style={styles.overlayContent}>
            <View style={[styles.lockIconCircle, { backgroundColor: '#6C5CE715' }]}>
              <Feather name="lock" size={24} color="#6C5CE7" />
            </View>
            <ThemedText style={styles.overlayTitle}>{featureName}</ThemedText>
            <ThemedText style={[styles.overlayDescription, { color: theme.textSecondary }]}>
              {featureDescription}
            </ThemedText>
            <Pressable style={styles.overlayUpgradeButton} onPress={onUpgrade}>
              <ThemedText style={styles.overlayUpgradeText}>Unlock with {requiredPlanLabel}</ThemedText>
            </Pressable>
            {showPlanCompare ? (
              <Pressable onPress={() => setShowCompare(true)} style={{ marginTop: Spacing.sm }}>
                <ThemedText style={styles.comparePlansLink}>Compare plans</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {showCompare ? (
        <InlinePlanCompare
          role={role}
          currentPlan={currentPlan}
          highlightPlan={requiredPlan}
          onClose={() => setShowCompare(false)}
          onSelectPlan={() => {
            setShowCompare(false);
            onUpgrade();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gateContainer: { position: 'relative', overflow: 'hidden', borderRadius: BorderRadius.medium },
  contentBehind: { opacity: 0.3 },
  dimOverlay: {
    backgroundColor: 'rgba(13,13,13,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: { alignItems: 'center', padding: Spacing.xl },
  lockIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  overlayTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  overlayDescription: {
    fontSize: 13, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 18,
  },
  overlayUpgradeButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.small,
  },
  overlayUpgradeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  replaceContainer: { alignItems: 'center', padding: Spacing.xl },
  replaceTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.md, marginBottom: 4 },
  replaceDescription: {
    fontSize: 14, textAlign: 'center', marginBottom: Spacing.md, lineHeight: 20,
  },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f59e0b15',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginBottom: Spacing.lg,
  },
  planBadgeText: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  upgradeButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: BorderRadius.small, marginBottom: Spacing.sm,
  },
  upgradeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  comparePlansLink: { color: '#6C5CE7', fontSize: 13, textDecorationLine: 'underline' },
});
