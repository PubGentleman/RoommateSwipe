import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Modal, Pressable,
  ActivityIndicator, Dimensions
} from 'react-native';
import { Feather } from './VectorIcons';
import {
  getRoommateBreakdown, CompatibilityBreakdown, BreakdownCategory
} from '../services/compatibilityBreakdownService';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const STATUS_COLORS: Record<string, string> = {
  excellent: '#3ECF8E',
  good: '#2ECC71',
  fair: '#F39C12',
  poor: '#E67E22',
  dealbreaker: '#ef4444',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUser: any;
  targetProfile: any;
  userId: string;
  isPremium: boolean;
  maxCategories?: number;
}

export default function CompatibilityBreakdownSheet({
  visible, onClose, currentUser, targetProfile, userId, isPremium,
  maxCategories,
}: Props) {
  const [breakdown, setBreakdown] = useState<CompatibilityBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && currentUser && targetProfile) {
      loadBreakdown();
    } else if (visible && (!currentUser || !targetProfile)) {
      setLoading(false);
      setBreakdown(null);
    }
  }, [visible, targetProfile?.id]);

  useEffect(() => {
    if (!visible) {
      setBreakdown(null);
      setLoading(true);
    }
  }, [visible]);

  const loadBreakdown = async () => {
    setLoading(true);
    try {
      const data = await getRoommateBreakdown(currentUser, targetProfile, userId, isPremium);
      setBreakdown(data);
    } catch (err) {
      console.error('Failed to load breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  const categoryLimit = isPremium ? undefined : (maxCategories ?? 3);

  const renderCategoryBar = (cat: BreakdownCategory) => (
    <View key={cat.key} style={styles.categoryRow}>
      <View style={styles.categoryHeader}>
        <Feather name={cat.icon as React.ComponentProps<typeof Feather>['name']} size={14} color={STATUS_COLORS[cat.status]} />
        <Text style={styles.categoryLabel}>{cat.label}</Text>
        <Text style={[styles.categoryScore, { color: STATUS_COLORS[cat.status] }]}>
          {cat.score}%
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, {
            width: `${cat.score}%`,
            backgroundColor: STATUS_COLORS[cat.status],
          }]}
        />
      </View>
      {isPremium ? (
        <Text style={styles.categoryDetail}>{cat.detail}</Text>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayTouchable} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6C5CE7" />
                <Text style={styles.loadingText}>Analyzing compatibility...</Text>
              </View>
            ) : breakdown ? (
              <>
                <View style={styles.overallSection}>
                  <View style={[styles.scoreCircle, { borderColor: breakdown.overallColor }]}>
                    <Text style={[styles.scoreNumber, { color: breakdown.overallColor }]}>
                      {breakdown.overallScore}
                    </Text>
                  </View>
                  <Text style={[styles.overallLabel, { color: breakdown.overallColor }]}>
                    {breakdown.overallLabel}
                  </Text>
                  <Text style={styles.targetName}>
                    with {targetProfile.full_name || targetProfile.name || 'this roommate'}
                  </Text>
                </View>

                {isPremium && breakdown.strengths.length > 0 ? (
                  <View style={styles.insightSection}>
                    <Text style={styles.insightTitle}>What's Great</Text>
                    {breakdown.strengths.map((s, i) => (
                      <View key={i} style={styles.insightRow}>
                        <View style={[styles.insightDot, { backgroundColor: '#3ECF8E' }]} />
                        <Feather name={s.icon as React.ComponentProps<typeof Feather>['name']} size={13} color="#3ECF8E" />
                        <Text style={styles.insightText}>{s.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {isPremium && breakdown.frictionPoints.length > 0 ? (
                  <View style={styles.insightSection}>
                    <Text style={styles.insightTitle}>Might Need Discussion</Text>
                    {breakdown.frictionPoints.map((f, i) => (
                      <View key={i} style={styles.insightRow}>
                        <View style={[styles.insightDot, {
                          backgroundColor: f.severity === 'critical' ? '#ef4444' : '#F39C12'
                        }]} />
                        <Feather name={f.icon as React.ComponentProps<typeof Feather>['name']} size={13} color={f.severity === 'critical' ? '#ef4444' : '#F39C12'} />
                        <Text style={styles.insightText}>{f.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.categoriesSection}>
                  <Text style={styles.categoriesTitle}>Detailed Breakdown</Text>
                  {(categoryLimit
                    ? breakdown.categories.slice(0, categoryLimit)
                    : breakdown.categories
                  ).map(renderCategoryBar)}

                  {!isPremium && breakdown.categories.length > (categoryLimit ?? 3) ? (
                    <View style={styles.lockedCategories}>
                      <Feather name="lock" size={16} color="#6C5CE7" />
                      <Text style={styles.lockedText}>
                        Upgrade to Plus to see all {breakdown.categories.length} categories
                      </Text>
                    </View>
                  ) : null}
                </View>

                {isPremium && breakdown.aiInsight ? (
                  <View style={styles.aiSection}>
                    <View style={styles.aiHeader}>
                      <Feather name="zap" size={14} color="#6C5CE7" />
                      <Text style={styles.aiTitle}>Pi's Take</Text>
                      <View style={[styles.confidenceBadge, {
                        backgroundColor: breakdown.aiInsight.confidence === 'strong' ? '#3ECF8E'
                          : breakdown.aiInsight.confidence === 'good' ? '#2ECC71'
                          : '#F39C12'
                      }]}>
                        <Text style={styles.confidenceText}>{breakdown.aiInsight.confidence}</Text>
                      </View>
                    </View>
                    <Text style={styles.aiSummary}>{breakdown.aiInsight.summary}</Text>
                    {breakdown.aiInsight.highlights.map((h, i) => (
                      <View key={`h-${i}`} style={styles.aiHighlight}>
                        <Feather name="check-circle" size={13} color="#3ECF8E" />
                        <Text style={styles.aiHighlightText}>{h}</Text>
                      </View>
                    ))}
                    {breakdown.aiInsight.warnings.map((w, i) => (
                      <View key={`w-${i}`} style={styles.aiHighlight}>
                        <Feather name="alert-circle" size={13} color="#F39C12" />
                        <Text style={styles.aiHighlightText}>{w}</Text>
                      </View>
                    ))}
                  </View>
                ) : !isPremium ? (
                  <View style={styles.aiLockedSection}>
                    <Feather name="lock" size={18} color="#6C5CE7" />
                    <Text style={styles.aiLockedText}>Upgrade to Plus to see Pi's compatibility analysis</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.errorText}>Unable to load compatibility data</Text>
            )}
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 30,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  scrollContent: { padding: 20 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: '#A0A0A0', marginTop: 12, fontSize: 14 },
  overallSection: { alignItems: 'center', marginBottom: 24 },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreNumber: { fontSize: 28, fontWeight: '800' },
  overallLabel: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  targetName: { color: '#A0A0A0', fontSize: 14 },
  insightSection: { marginBottom: 20 },
  insightTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  insightDot: { width: 6, height: 6, borderRadius: 3 },
  insightText: { color: '#ccc', fontSize: 13, flex: 1 },
  categoriesSection: { marginBottom: 20 },
  categoriesTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 },
  categoryRow: { marginBottom: 14 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  categoryLabel: { flex: 1, color: '#ccc', fontSize: 13 },
  categoryScore: { fontSize: 13, fontWeight: '700' },
  barTrack: {
    height: 6,
    backgroundColor: '#252525',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: { height: '100%', borderRadius: 3 },
  categoryDetail: { color: '#666', fontSize: 11 },
  lockedCategories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(108,92,231,0.1)',
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  lockedText: { color: '#6C5CE7', fontSize: 13, flex: 1 },
  aiSection: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiTitle: { color: '#6C5CE7', fontSize: 14, fontWeight: '700', flex: 1 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  confidenceText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  aiSummary: { color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  aiHighlight: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  aiHighlightText: { color: '#A0A0A0', fontSize: 12, flex: 1 },
  aiLockedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(108,92,231,0.1)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  aiLockedText: { color: '#6C5CE7', fontSize: 13, flex: 1 },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  closeText: { color: '#A0A0A0', fontSize: 15, fontWeight: '600' },
  errorText: { color: '#666', textAlign: 'center', paddingVertical: 40 },
});
