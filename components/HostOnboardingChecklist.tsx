import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Feather } from './VectorIcons';
import { HostChecklistStatus, dismissHostChecklist } from '../utils/hostOnboardingChecklist';

interface Props {
  status: HostChecklistStatus;
  userId: string;
  onAction: (screen: string, params?: Record<string, any>, navigateVia?: string) => void;
  onDismiss: () => void;
}

const HostOnboardingChecklist: React.FC<Props> = ({ status, userId, onAction, onDismiss }) => {
  const [expanded, setExpanded] = useState(true);
  const { steps, completedCount, totalSteps, currentStep, allComplete } = status;

  if (status.dismissed) return null;

  if (allComplete) {
    return (
      <Animated.View entering={FadeIn} style={styles.completedCard}>
        <View style={styles.completedContent}>
          <View style={styles.completedIcon}>
            <Feather name="check-circle" size={20} color="#3ECF8E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.completedTitle}>You're all set!</Text>
            <Text style={styles.completedSubtext}>Your listing is ready to receive inquiries</Text>
          </View>
          <Pressable onPress={() => { dismissHostChecklist(userId); onDismiss(); }}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.3)" />
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <Animated.View entering={FadeIn} layout={Layout} style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="home" size={18} color="#ff6b5b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Get Your First Listing Live</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.progressText}>{completedCount}/{totalSteps}</Text>
            </View>
          </View>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.3)" />
      </Pressable>

      {expanded ? (
        <View style={styles.stepsList}>
          {steps.map((step, i) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.checkbox, step.completed ? styles.checkboxDone : undefined]}>
                {step.completed ? (
                  <Feather name="check" size={12} color="#fff" />
                ) : (
                  <Text style={styles.checkboxNum}>{i + 1}</Text>
                )}
              </View>

              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, step.completed ? styles.stepTitleDone : undefined]}>
                  {step.title}
                </Text>
                {!step.completed ? (
                  <Text style={styles.stepDesc}>{step.description}</Text>
                ) : null}
              </View>
            </View>
          ))}

          {currentStep?.action ? (
            <View style={styles.actionSection}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => onAction(currentStep.action!.screen, currentStep.action!.params, currentStep.action!.navigateVia)}
              >
                <Text style={styles.actionBtnText}>{currentStep.action.label}</Text>
                <Feather name="arrow-right" size={14} color="#fff" />
              </Pressable>

              {currentStep.tip ? (
                <View style={styles.tipRow}>
                  <Feather name="info" size={12} color="rgba(255,255,255,0.25)" />
                  <Text style={styles.tipText}>{currentStep.tip}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={styles.dismissBtn}
            onPress={() => { dismissHostChecklist(userId); onDismiss(); }}
          >
            <Text style={styles.dismissText}>I'll figure it out myself</Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#161616',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: '#ff6b5b',
  },
  progressText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  stepsList: { paddingHorizontal: 16, paddingBottom: 16 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxDone: {
    backgroundColor: '#3ECF8E',
    borderColor: '#3ECF8E',
  },
  checkboxNum: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  stepContent: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  stepTitleDone: { color: 'rgba(255,255,255,0.35)', textDecorationLine: 'line-through' },
  stepDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  actionSection: { marginTop: 8, gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#ff6b5b', borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', flex: 1 },
  dismissBtn: { alignItems: 'center', marginTop: 12 },
  dismissText: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
  completedCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(62,207,142,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(62,207,142,0.15)',
  },
  completedContent: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  completedIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(62,207,142,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  completedTitle: { fontSize: 15, fontWeight: '700', color: '#3ECF8E' },
  completedSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
});

export default HostOnboardingChecklist;
