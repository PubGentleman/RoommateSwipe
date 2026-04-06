import React from 'react';
import {
  View, Pressable, ScrollView, Modal, StyleSheet, Dimensions,
} from 'react-native';
import { Feather } from './VectorIcons';
import { ThemedText } from './ThemedText';
import { RENTER_PLAN_LIMITS } from '../constants/renterPlanLimits';
import { PLAN_LIMITS } from '../constants/planLimits';
import { Spacing, BorderRadius } from '../constants/theme';

interface Props {
  role: 'renter' | 'host';
  currentPlan: string;
  highlightPlan: string;
  onClose: () => void;
  onSelectPlan: (plan: string) => void;
}

const RENTER_FEATURES: { key: string; label: string; format: (v: any) => string }[] = [
  { key: 'dailySwipes', label: 'Daily Swipes', format: (v: number) => v === -1 ? 'Unlimited' : `${v}` },
  { key: 'maxGroups', label: 'Groups', format: (v: number) => v === -1 ? 'Unlimited' : `${v}` },
  { key: 'hasAdvancedFilters', label: 'Advanced Filters', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'canSeeWhoLiked', label: 'See Who Liked You', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'hasMatchBreakdown', label: 'Match Breakdown', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'hasProfileBoost', label: 'Profile Boost', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'hasReadReceipts', label: 'Read Receipts', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'hasAIGroupSuggestions', label: 'AI Group Suggestions', format: (v: boolean) => v ? 'Yes' : '--' },
];

const HOST_FEATURES: { key: string; label: string; format: (v: any) => string }[] = [
  { key: 'maxListings', label: 'Listings', format: (v: number) => v === -1 ? 'Unlimited' : `${v}` },
  { key: 'proactiveOutreachPerDay', label: 'Daily Outreach', format: (v: number) => `${v}` },
  { key: 'hasAnalytics', label: 'Analytics', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'hasBoosts', label: 'Boosts', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'freeBoostsPerMonth', label: 'Free Boosts/Mo', format: (v: number) => `${v}` },
  { key: 'hasVerifiedBadge', label: 'Verified Badge', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'hasCompanyBranding', label: 'Company Branding', format: (v: boolean) => v ? 'Yes' : '--' },
  { key: 'piCallsPerMonth', label: 'AI Calls/Mo', format: (v: number) => `${v}` },
];

function normalizeHostPlan(plan: string): string {
  return plan.replace(/^(agent_|company_)/, '');
}

export default function InlinePlanCompare({ role, currentPlan, highlightPlan, onClose, onSelectPlan }: Props) {
  const isRenter = role === 'renter';
  const normalizedCurrent = isRenter ? currentPlan : normalizeHostPlan(currentPlan);
  const normalizedHighlight = isRenter ? highlightPlan : normalizeHostPlan(highlightPlan);
  const plans = isRenter
    ? [
        { key: 'free', label: 'Free', price: '$0', limits: RENTER_PLAN_LIMITS['free'] },
        { key: 'plus', label: 'Plus', price: '$14.99/mo', limits: RENTER_PLAN_LIMITS['plus'] },
        { key: 'elite', label: 'Elite', price: '$29.99/mo', limits: RENTER_PLAN_LIMITS['elite'] },
      ]
    : [
        { key: 'free', label: 'Free', price: '$0', limits: PLAN_LIMITS['free'] },
        { key: 'starter', label: 'Starter', price: '$19.99/mo', limits: PLAN_LIMITS['starter'] },
        { key: 'pro', label: 'Pro', price: '$49.99/mo', limits: PLAN_LIMITS['pro'] },
        { key: 'business', label: 'Business', price: '$99.99/mo', limits: PLAN_LIMITS['business'] },
      ];

  const features = isRenter ? RENTER_FEATURES : HOST_FEATURES;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>Compare Plans</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.headerRow}>
                <View style={styles.featureLabelCell} />
                {plans.map(plan => (
                  <View
                    key={plan.key}
                    style={[
                      styles.planHeaderCell,
                      plan.key === normalizedHighlight && styles.highlightedHeader,
                      plan.key === normalizedCurrent && styles.currentPlanHeader,
                    ]}
                  >
                    <ThemedText style={[
                      styles.planName,
                      plan.key === normalizedHighlight && styles.highlightedText,
                    ]}>
                      {plan.label}
                    </ThemedText>
                    <ThemedText style={styles.planPrice}>{plan.price}</ThemedText>
                    {plan.key === normalizedCurrent ? (
                      <ThemedText style={styles.currentLabel}>Current</ThemedText>
                    ) : null}
                  </View>
                ))}
              </View>

              {features.map((feature, i) => (
                <View key={feature.key} style={[styles.featureRow, i % 2 === 0 && styles.featureRowAlt]}>
                  <View style={styles.featureLabelCell}>
                    <ThemedText style={styles.featureLabel}>{feature.label}</ThemedText>
                  </View>
                  {plans.map(plan => {
                    const value = (plan.limits as Record<string, unknown>)?.[feature.key];
                    const formatted = feature.format(value);
                    const isYes = formatted === 'Yes';
                    const isDash = formatted === '--';
                    return (
                      <View
                        key={plan.key}
                        style={[
                          styles.featureValueCell,
                          plan.key === normalizedHighlight && styles.highlightedCell,
                        ]}
                      >
                        {isYes ? (
                          <Feather name="check-circle" size={18} color="#3ECF8E" />
                        ) : isDash ? (
                          <Feather name="x-circle" size={18} color="#444" />
                        ) : (
                          <ThemedText style={[
                            styles.featureValue,
                            plan.key === normalizedHighlight && styles.highlightedValue,
                          ]}>
                            {formatted}
                          </ThemedText>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}

              <View style={styles.ctaRow}>
                <View style={styles.featureLabelCell} />
                {plans.map(plan => (
                  <View key={plan.key} style={styles.ctaCell}>
                    {plan.key !== normalizedCurrent && plan.key !== 'free' ? (
                      <Pressable
                        style={[
                          styles.selectButton,
                          plan.key === normalizedHighlight && styles.highlightedButton,
                        ]}
                        onPress={() => onSelectPlan(plan.key)}
                      >
                        <ThemedText style={[
                          styles.selectButtonText,
                          plan.key === normalizedHighlight && styles.highlightedButtonText,
                        ]}>
                          {plan.key === normalizedHighlight ? 'Upgrade' : 'Select'}
                        </ThemedText>
                      </Pressable>
                    ) : plan.key === normalizedCurrent ? (
                      <ThemedText style={styles.currentPlanText}>Your Plan</ThemedText>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: Dimensions.get('window').height * 0.75,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginTop: 8, marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8 },
  featureLabelCell: { width: 130, paddingHorizontal: 12, justifyContent: 'center' },
  planHeaderCell: { width: 90, alignItems: 'center', paddingVertical: 8 },
  highlightedHeader: { backgroundColor: '#6C5CE715', borderRadius: 8 },
  currentPlanHeader: { borderWidth: 1, borderColor: '#6C5CE730', borderRadius: 8 },
  planName: { fontSize: 14, fontWeight: '700' },
  highlightedText: { color: '#6C5CE7' },
  planPrice: { fontSize: 11, color: '#999', marginTop: 2 },
  currentLabel: { fontSize: 9, color: '#3ECF8E', fontWeight: '600', marginTop: 2 },
  featureRow: { flexDirection: 'row', paddingVertical: 8 },
  featureRowAlt: { backgroundColor: '#14141480' },
  featureLabel: { fontSize: 12 },
  featureValueCell: { width: 90, alignItems: 'center', justifyContent: 'center' },
  highlightedCell: { backgroundColor: '#6C5CE708' },
  featureValue: { fontSize: 13, fontWeight: '600' },
  highlightedValue: { color: '#6C5CE7' },
  ctaRow: { flexDirection: 'row', paddingVertical: 12 },
  ctaCell: { width: 90, alignItems: 'center' },
  selectButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: '#6C5CE7',
  },
  highlightedButton: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  selectButtonText: { fontSize: 12, fontWeight: '600', color: '#6C5CE7' },
  highlightedButtonText: { color: '#FFFFFF' },
  currentPlanText: { fontSize: 11, color: '#3ECF8E', fontWeight: '600' },
});
