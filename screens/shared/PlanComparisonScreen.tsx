import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Dimensions } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { RENTER_PLAN_LIMITS, type RenterPlan } from '../../constants/renterPlanLimits';
import { PLAN_LIMITS } from '../../constants/planLimits';

const BG = '#0d0d0d';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const PURPLE = '#6C5CE7';
const GOLD = '#ffd700';

const { width: SCREEN_W } = Dimensions.get('window');
const COL_W = 80;
const LABEL_W = 110;

type RoleTab = 'renter' | 'host';
type BillingCycle = 'monthly' | '3month' | 'annual';

interface PlanColumn {
  key: string;
  label: string;
  prices: Record<BillingCycle, number>;
}

interface FeatureRow {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string';
}

interface FeatureSection {
  title: string;
  features: FeatureRow[];
}

const RENTER_PLANS: PlanColumn[] = [
  { key: 'free', label: 'Free', prices: { monthly: 0, '3month': 0, annual: 0 } },
  { key: 'plus', label: 'Plus', prices: { monthly: 14.99, '3month': 38.97, annual: 152.88 } },
  { key: 'elite', label: 'Elite', prices: { monthly: 29.99, '3month': 77.97, annual: 269.88 } },
];

const HOST_PLANS: PlanColumn[] = [
  { key: 'free', label: 'Free', prices: { monthly: 0, '3month': 0, annual: 0 } },
  { key: 'starter', label: 'Starter', prices: { monthly: 19.99, '3month': 53.97, annual: 191.88 } },
  { key: 'pro', label: 'Pro', prices: { monthly: 49.99, '3month': 134.97, annual: 479.88 } },
  { key: 'business', label: 'Business', prices: { monthly: 99.99, '3month': 269.97, annual: 959.88 } },
];

const RENTER_SECTIONS: FeatureSection[] = [
  {
    title: 'Matching',
    features: [
      { key: 'dailySwipes', label: 'Daily Swipes', type: 'number' },
      { key: 'canSeeWhoLiked', label: 'See Who Liked', type: 'boolean' },
      { key: 'hasMatchBreakdown', label: 'Match Breakdown', type: 'boolean' },
      { key: 'hasAdvancedFilters', label: 'Advanced Filters', type: 'boolean' },
      { key: 'hasTransitFiltering', label: 'Transit Filtering', type: 'boolean' },
    ],
  },
  {
    title: 'Groups',
    features: [
      { key: 'maxGroups', label: 'Max Groups', type: 'number' },
      { key: 'hasGroupVoting', label: 'Group Voting', type: 'boolean' },
      { key: 'hasAIGroupSuggestions', label: 'AI Group Ideas', type: 'boolean' },
    ],
  },
  {
    title: 'AI Features',
    features: [
      { key: 'piMessagesPerDay', label: 'PI Msgs/Day', type: 'number' },
      { key: 'piInsightLevel', label: 'Insight Level', type: 'string' },
      { key: 'hasPiDeckReranking', label: 'Deck Re-ranking', type: 'boolean' },
    ],
  },
  {
    title: 'Profile',
    features: [
      { key: 'hasProfileBoost', label: 'Profile Boost', type: 'boolean' },
      { key: 'hasPriorityInSearch', label: 'Priority Search', type: 'boolean' },
      { key: 'hasVerifiedBadge', label: 'Verified Badge', type: 'boolean' },
      { key: 'hasReadReceipts', label: 'Read Receipts', type: 'boolean' },
      { key: 'hasDedicatedSupport', label: 'Dedicated Support', type: 'boolean' },
    ],
  },
];

const HOST_SECTIONS: FeatureSection[] = [
  {
    title: 'Listings',
    features: [
      { key: 'maxListings', label: 'Max Listings', type: 'number' },
      { key: 'listingPlacement', label: 'Placement', type: 'string' },
    ],
  },
  {
    title: 'Outreach',
    features: [
      { key: 'proactiveOutreachPerDay', label: 'Outreach/Day', type: 'number' },
      { key: 'groupProfileAccess', label: 'Group Access', type: 'string' },
      { key: 'groupCooldownDays', label: 'Cooldown (days)', type: 'number' },
    ],
  },
  {
    title: 'Boosts',
    features: [
      { key: 'hasBoosts', label: 'Boosts', type: 'boolean' },
      { key: 'freeBoostsPerMonth', label: 'Free Boosts/Mo', type: 'number' },
      { key: 'simultaneousBoosts', label: 'Simultaneous', type: 'number' },
    ],
  },
  {
    title: 'Analytics & AI',
    features: [
      { key: 'analyticsLevel', label: 'Analytics', type: 'string' },
      { key: 'piCallsPerMonth', label: 'AI Calls/Mo', type: 'number' },
      { key: 'freeAutoClaimsPerMonth', label: 'Auto Claims/Mo', type: 'number' },
    ],
  },
  {
    title: 'Features',
    features: [
      { key: 'hasVerifiedBadge', label: 'Verified Badge', type: 'boolean' },
      { key: 'hasCompanyBranding', label: 'Branding', type: 'boolean' },
      { key: 'hasDedicatedSupport', label: 'Ded. Support', type: 'boolean' },
    ],
  },
];

function getValue(limits: any, key: string): any {
  const parts = key.split('.');
  let val = limits;
  for (const p of parts) {
    val = val?.[p];
  }
  return val;
}

function formatValue(val: any, type: string): { text: string; color: string; isCheck: boolean; isX: boolean } {
  if (type === 'boolean') {
    return val
      ? { text: '', color: GREEN, isCheck: true, isX: false }
      : { text: '', color: '#555', isCheck: false, isX: true };
  }
  if (type === 'number') {
    if (val === -1 || val === Infinity) return { text: '\u221E', color: GOLD, isCheck: false, isX: false };
    if (val === 0) return { text: '--', color: '#555', isCheck: false, isX: false };
    return { text: `${val}`, color: '#fff', isCheck: false, isX: false };
  }
  if (type === 'string') {
    if (!val || val === 'none') return { text: '--', color: '#555', isCheck: false, isX: false };
    const display = typeof val === 'string' ? val.charAt(0).toUpperCase() + val.slice(1) : String(val);
    return { text: display, color: '#fff', isCheck: false, isX: false };
  }
  return { text: String(val ?? '--'), color: '#fff', isCheck: false, isX: false };
}

export const PlanComparisonScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [roleTab, setRoleTab] = useState<RoleTab>('renter');
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const isRenter = roleTab === 'renter';
  const plans = isRenter ? RENTER_PLANS : HOST_PLANS;
  const sections = isRenter ? RENTER_SECTIONS : HOST_SECTIONS;
  const limitsSource = isRenter ? RENTER_PLAN_LIMITS : PLAN_LIMITS;

  const currentPlan = user?.subscription?.plan || 'free';
  const normalizedCurrent = currentPlan.replace(/^(agent_|company_)/, '');

  const getMonthlyPrice = (plan: PlanColumn) => {
    const total = plan.prices[billing];
    if (billing === '3month') return (total / 3).toFixed(2);
    if (billing === 'annual') return (total / 12).toFixed(2);
    return total.toFixed(2);
  };

  const savingsPercent = billing === 'annual' ? 20 : billing === '3month' ? 10 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Compare Plans</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.roleTabs}>
        {(['renter', 'host'] as RoleTab[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.roleTab, roleTab === tab && styles.roleTabActive]}
            onPress={() => setRoleTab(tab)}
          >
            <Text style={[styles.roleTabText, roleTab === tab && styles.roleTabTextActive]}>
              {tab === 'renter' ? 'Renter' : 'Host'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.billingRow}>
        {(['monthly', '3month', 'annual'] as BillingCycle[]).map(cycle => (
          <Pressable
            key={cycle}
            style={[styles.billingChip, billing === cycle && styles.billingChipActive]}
            onPress={() => setBilling(cycle)}
          >
            <Text style={[styles.billingChipText, billing === cycle && styles.billingChipTextActive]}>
              {cycle === 'monthly' ? 'Monthly' : cycle === '3month' ? '3-Month' : 'Annual'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.labelCell, { width: LABEL_W }]}>
                <Text style={styles.labelCellText}>Feature</Text>
              </View>
              {plans.map(plan => {
                const isCurrent = plan.key === normalizedCurrent;
                return (
                  <View key={plan.key} style={[styles.planHeaderCell, isCurrent && styles.currentCol]}>
                    <Text style={[styles.planHeaderName, isCurrent && { color: ACCENT }]}>{plan.label}</Text>
                    <Text style={styles.planHeaderPrice}>
                      {plan.prices.monthly === 0 ? '$0' : `$${getMonthlyPrice(plan)}/mo`}
                    </Text>
                    {isCurrent ? <Text style={styles.currentBadge}>Current</Text> : null}
                  </View>
                );
              })}
            </View>

            {sections.map(section => (
              <View key={section.title}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
                {section.features.map(feature => (
                  <View key={feature.key} style={styles.featureRow}>
                    <View style={[styles.labelCell, { width: LABEL_W }]}>
                      <Text style={styles.featureLabelText}>{feature.label}</Text>
                    </View>
                    {plans.map(plan => {
                      const limits = (limitsSource as any)[plan.key];
                      const val = limits ? getValue(limits, feature.key) : undefined;
                      const formatted = formatValue(val, feature.type);
                      const isCurrent = plan.key === normalizedCurrent;

                      return (
                        <View key={plan.key} style={[styles.valueCell, isCurrent && styles.currentCol]}>
                          {formatted.isCheck ? (
                            <Feather name="check-circle" size={16} color={GREEN} />
                          ) : formatted.isX ? (
                            <Feather name="x-circle" size={16} color="#444" />
                          ) : (
                            <Text style={[styles.valueText, { color: formatted.color }]}>{formatted.text}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        {savingsPercent > 0 ? (
          <View style={styles.savingsBanner}>
            <Feather name="tag" size={14} color={GREEN} />
            <Text style={styles.savingsText}>
              Save {savingsPercent}% with {billing === 'annual' ? 'annual' : '3-month'} billing
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.ctaButton}
          onPress={() => {
            if (isRenter) {
              navigation.navigate('Plans');
            } else {
              navigation.navigate('HostSubscription');
            }
          }}
        >
          <LinearGradient
            colors={[ACCENT, '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {normalizedCurrent === 'free' || normalizedCurrent === 'none' ? 'Upgrade Now' : 'Change Plan'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  roleTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleTabActive: { backgroundColor: ACCENT + '20' },
  roleTabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  roleTabTextActive: { color: ACCENT },
  billingRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  billingChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  billingChipActive: { backgroundColor: PURPLE + '20', borderColor: PURPLE },
  billingChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  billingChipTextActive: { color: PURPLE },
  tableHeaderRow: { flexDirection: 'row', paddingLeft: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  labelCell: { justifyContent: 'center', paddingVertical: 12, paddingRight: 8 },
  labelCellText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' },
  planHeaderCell: { width: COL_W, alignItems: 'center', paddingVertical: 12 },
  planHeaderName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  planHeaderPrice: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  currentBadge: { fontSize: 9, fontWeight: '700', color: GREEN, marginTop: 4, textTransform: 'uppercase' },
  currentCol: { backgroundColor: 'rgba(255,107,91,0.04)' },
  sectionHeaderRow: { paddingLeft: 16, paddingVertical: 8, backgroundColor: '#141414' },
  sectionHeaderText: { fontSize: 11, fontWeight: '700', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 },
  featureRow: { flexDirection: 'row', paddingLeft: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  featureLabelText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  valueCell: { width: COL_W, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  valueText: { fontSize: 12, fontWeight: '600' },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: GREEN + '10',
    borderWidth: 1,
    borderColor: GREEN + '20',
  },
  savingsText: { fontSize: 13, fontWeight: '600', color: GREEN },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  ctaButton: { borderRadius: 14, overflow: 'hidden' },
  ctaGradient: { paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
