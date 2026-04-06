import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { Feather } from './VectorIcons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { Spacing, BorderRadius } from '../constants/theme';
import { getCachedOrGenerateInsight } from '../services/piMatchingService';
import { normalizeRenterPlan, getRenterPlanLimits } from '../constants/renterPlanLimits';
import type { PiMatchInsight } from '../types/models';
import { withTimeout } from '../utils/asyncHelpers';

interface Props {
  visible: boolean;
  profileId: string;
  profileName: string;
  compatibilityScore: number;
  onClose: () => void;
  onSendMessage?: (text: string) => void;
}

const PI_PURPLE = '#a855f7';

export const WhyThisMatchModal: React.FC<Props> = ({
  visible, profileId, profileName, compatibilityScore, onClose, onSendMessage,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [piInsight, setPiInsight] = useState<PiMatchInsight | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plan = normalizeRenterPlan(user?.subscription?.plan);
  const limits = getRenterPlanLimits(plan);

  useEffect(() => {
    if (visible && profileId) {
      setResult(null);
      setPiInsight(null);
      setError(null);
      fetchExplanation();
    }
  }, [visible, profileId]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const [explainResult, piResult] = await Promise.allSettled([
        withTimeout(
    supabase.functions.invoke('explain-match', {
          body: { matchedProfileId: profileId, targetProfileId: profileId },
        }),
    30000,
    'explain-match'
  ),
        getCachedOrGenerateInsight(profileId, compatibilityScore),
      ]);

      if (piResult.status === 'fulfilled' && piResult.value) {
        setPiInsight(piResult.value);
      }

      if (explainResult.status === 'fulfilled' && !explainResult.value.error) {
        setResult(explainResult.value.data);
      } else {
        setResult({
          headline: `${profileName} looks like an interesting potential match worth exploring.`,
          compatibilityScore: compatibilityScore || 50,
          topReasons: [
            'Both actively looking for a roommate on Rhome',
            'Profiles suggest potential compatibility based on shared criteria',
          ],
          concerns: [],
          conversationStarter: `Hey ${profileName}! I saw your profile — would love to chat about what you're looking for.`,
        });
      }
    } catch (e: any) {
      setResult({
        headline: `${profileName} looks like an interesting potential match worth exploring.`,
        compatibilityScore: compatibilityScore || 50,
        topReasons: [
          'Both actively looking for a roommate on Rhome',
          'Profiles suggest potential compatibility based on shared criteria',
        ],
        concerns: [],
        conversationStarter: `Hey ${profileName}! I saw your profile — would love to chat about what you're looking for.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const getVisibleHighlights = (): string[] => {
    if (!piInsight?.highlights?.length) return [];
    if (limits.piInsightLevel === 'full') return piInsight.highlights;
    if (limits.piInsightLevel === 'highlights') return piInsight.highlights.slice(0, 3);
    return [];
  };

  const getVisibleWarnings = (): string[] => {
    if (!piInsight?.warnings?.length) return [];
    if (limits.piInsightLevel === 'full') return piInsight.warnings;
    return [];
  };

  const confidenceLabel = (c: string) => {
    if (c === 'strong') return '\u03C0 Strong Match';
    if (c === 'good') return '\u03C0 Good Match';
    if (c === 'moderate') return '\u03C0 Worth Exploring';
    return '\u03C0 Early Signal';
  };

  const confidenceColor = (c: string) => {
    if (c === 'strong') return '#4CAF50';
    if (c === 'good') return '#8BC34A';
    if (c === 'moderate') return '#FF9800';
    return '#F44336';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.header}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.scoreRow}>
              <View style={[styles.scoreBadge, { backgroundColor: PI_PURPLE }]}>
                <ThemedText style={styles.scoreNumber}>{compatibilityScore}%</ThemedText>
                <ThemedText style={styles.scoreLabel}>Match</ThemedText>
              </View>
              <View style={styles.scoreMeta}>
                <ThemedText style={[styles.scoreTitle, { color: theme.text }]}>
                  Why {profileName}?
                </ThemedText>
                <View style={styles.piTagRow}>
                  <View style={[styles.piBadge, { backgroundColor: PI_PURPLE + '20' }]}>
                    <Feather name="cpu" size={11} color={PI_PURPLE} />
                    <ThemedText style={[styles.piBadgeText, { color: PI_PURPLE }]}>Pi Analysis</ThemedText>
                  </View>
                  {piInsight?.confidence && limits.piInsightLevel === 'full' ? (
                    <View style={[styles.confidencePill, { backgroundColor: confidenceColor(piInsight.confidence) + '20' }]}>
                      <Feather name="cpu" size={10} color={confidenceColor(piInsight.confidence)} />
                      <ThemedText style={[styles.confidenceText, { color: confidenceColor(piInsight.confidence) }]}>
                        {confidenceLabel(piInsight.confidence)}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={PI_PURPLE} size="large" />
                <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Pi is analyzing your compatibility...
                </ThemedText>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
                <Pressable style={[styles.retryButton, { backgroundColor: PI_PURPLE }]} onPress={fetchExplanation}>
                  <ThemedText style={styles.retryText}>Try Again</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {result && !loading ? (
              <>
                {piInsight?.summary ? (
                  <View style={[styles.piSummaryCard, { backgroundColor: PI_PURPLE + '10', borderLeftColor: PI_PURPLE }]}>
                    <View style={styles.piSummaryHeader}>
                      <Feather name="cpu" size={14} color={PI_PURPLE} />
                      <ThemedText style={[styles.piSummaryTitle, { color: PI_PURPLE }]}>Pi's Take</ThemedText>
                    </View>
                    <ThemedText style={[styles.headline, { color: theme.text }]}>
                      "{piInsight.summary}"
                    </ThemedText>
                    {limits.piInsightLevel === 'summary' ? (
                      <View style={[styles.upgradeBanner, { backgroundColor: PI_PURPLE + '10', borderColor: PI_PURPLE + '30', marginTop: Spacing.sm }]}>
                        <Feather name="lock" size={12} color={PI_PURPLE} />
                        <ThemedText style={[styles.upgradeText, { color: PI_PURPLE }]}>
                          Upgrade to Plus for detailed Pi insights
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={[styles.headlineCard, { backgroundColor: theme.background, borderLeftColor: PI_PURPLE }]}>
                    <ThemedText style={[styles.headline, { color: theme.text }]}>
                      "{result.headline}"
                    </ThemedText>
                  </View>
                )}

                {getVisibleHighlights().length > 0 ? (
                  <>
                    <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                      Pi's highlights
                    </ThemedText>
                    {getVisibleHighlights().map((h: string, i: number) => (
                      <View key={i} style={styles.reasonRow}>
                        <Feather name="check-circle" size={14} color="#4CAF50" />
                        <ThemedText style={[styles.reasonText, { color: theme.text }]}>{h}</ThemedText>
                      </View>
                    ))}
                    {limits.piInsightLevel === 'highlights' && (piInsight?.highlights?.length ?? 0) > 3 ? (
                      <View style={[styles.upgradeBanner, { backgroundColor: PI_PURPLE + '10', borderColor: PI_PURPLE + '30' }]}>
                        <Feather name="lock" size={12} color={PI_PURPLE} />
                        <ThemedText style={[styles.upgradeText, { color: PI_PURPLE }]}>
                          Upgrade to Elite for full Pi analysis
                        </ThemedText>
                      </View>
                    ) : null}
                  </>
                ) : !piInsight && limits.piInsightLevel === 'full' ? (
                  <>
                    <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                      Why you'd work well together
                    </ThemedText>
                    {result.topReasons?.map((reason: string, i: number) => (
                      <View key={i} style={styles.reasonRow}>
                        <View style={[styles.reasonDot, { backgroundColor: '#4CAF50' }]} />
                        <ThemedText style={[styles.reasonText, { color: theme.text }]}>{reason}</ThemedText>
                      </View>
                    ))}
                  </>
                ) : null}

                {getVisibleWarnings().length > 0 ? (
                  <>
                    <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                      Worth keeping in mind
                    </ThemedText>
                    {getVisibleWarnings().map((w: string, i: number) => (
                      <View key={i} style={styles.concernRow}>
                        <Feather name="alert-circle" size={16} color="#FF9800" />
                        <ThemedText style={[styles.concernText, { color: theme.text }]}>{w}</ThemedText>
                      </View>
                    ))}
                  </>
                ) : !piInsight && limits.piInsightLevel === 'full' && result.concerns?.length > 0 && result.concerns[0] ? (
                  <>
                    <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                      Worth keeping in mind
                    </ThemedText>
                    {result.concerns.map((concern: string, i: number) => (
                      <View key={i} style={styles.concernRow}>
                        <Feather name="alert-circle" size={16} color="#FF9800" />
                        <ThemedText style={[styles.concernText, { color: theme.text }]}>{concern}</ThemedText>
                      </View>
                    ))}
                  </>
                ) : null}

                {result.conversationStarter && onSendMessage ? (
                  <View style={[styles.starterCard, { backgroundColor: theme.background }]}>
                    <ThemedText style={[styles.starterLabel, { color: theme.textSecondary }]}>
                      Suggested opener
                    </ThemedText>
                    <ThemedText style={[styles.starterText, { color: theme.text }]}>
                      "{result.conversationStarter}"
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.useStarterButton, { backgroundColor: PI_PURPLE }]}
                      onPress={() => {
                        onSendMessage(result.conversationStarter);
                        onClose();
                      }}
                    >
                      <Feather name="send" size={14} color="#fff" />
                      <ThemedText style={styles.useStarterText}>Use this opener</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  scoreBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  scoreMeta: { flex: 1 },
  scoreTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  piTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  piBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  piBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  piSummaryCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
  },
  piSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  piSummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 30,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: BorderRadius.medium,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  headlineCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
  },
  headline: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  reasonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  reasonText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  upgradeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  concernRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  concernText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  starterCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  starterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  starterText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  useStarterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  useStarterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
