import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';
import {
  getRevenueSummary, RevenueSummary,
  getSpendingBreakdown, SpendingBreakdown,
  getRecentTransactions, Transaction,
  formatCents,
} from '../../services/revenueService';

const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const CARD_BG = '#1a1a1a';
const SCREEN_W = Dimensions.get('window').width;

const PERIODS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 365 },
];

const TX_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  subscription_payment: { icon: 'refresh-cw', color: '#6C5CE7', label: 'Subscription' },
  boost_purchase: { icon: 'zap', color: '#3ECF8E', label: 'Boost' },
  boost_credit_use: { icon: 'zap', color: '#3ECF8E', label: 'Boost Credit' },
  agent_verification: { icon: 'shield', color: '#3b82f6', label: 'Verification' },
  extra_claim_purchase: { icon: 'users', color: '#f59e0b', label: 'Extra Claim' },
  booking_confirmed: { icon: 'check-circle', color: '#22c55e', label: 'Booking' },
};

const CATEGORY_COLORS = {
  subscription: '#6C5CE7',
  boosts: '#3ECF8E',
  other: '#f59e0b',
};

export const RevenueOverviewScreen = () => {
  const navigation = useNavigation<any>();
  const { user, getHostPlan } = useAuth();
  const hostPlan = getHostPlan() as HostPlan;
  const planLimits = getPlanLimits(hostPlan);
  const canSeeBreakdown = planLimits.analyticsLevel !== 'none';
  const canSeeAdvanced = planLimits.analyticsLevel === 'advanced';

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [breakdown, setBreakdown] = useState<SpendingBreakdown | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadData();
  }, [period, user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [s, b, t] = await Promise.all([
        getRevenueSummary(user.id, period),
        getSpendingBreakdown(user.id, 6),
        getRecentTransactions(user.id, 10),
      ]);
      setSummary(s);
      setBreakdown(b);
      setTransactions(t);
    } catch (err) {
      console.error('Failed to load revenue data:', err);
    }
    setLoading(false);
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodRow}>
      {PERIODS.map(p => (
        <Pressable
          key={p.label}
          style={[styles.periodBtn, period === p.days && styles.periodBtnActive]}
          onPress={() => setPeriod(p.days)}
        >
          <Text style={[styles.periodLabel, period === p.days && styles.periodLabelActive]}>
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderSummaryCards = () => {
    if (!summary) return null;
    const trendColor = summary.spendTrend === 'up' ? '#ef4444' : summary.spendTrend === 'down' ? GREEN : '#888';
    const trendIcon = summary.spendTrend === 'up' ? 'trending-up' : summary.spendTrend === 'down' ? 'trending-down' : 'minus';
    return (
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Spent</Text>
          <Text style={styles.summaryValue}>{formatCents(summary.totalSpent)}</Text>
          <View style={styles.trendRow}>
            <Feather name={trendIcon} size={13} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {Math.abs(summary.spendTrendPercent)}% vs prev
            </Text>
          </View>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardRight]}>
          <Text style={styles.summaryLabel}>Booking Revenue</Text>
          <Text style={[styles.summaryValue, { color: GREEN }]}>
            {formatCents(summary.bookingRevenue)}
          </Text>
          <Text style={styles.summarySubtext}>Reference only</Text>
        </View>
      </View>
    );
  };

  const renderBreakdown = () => {
    if (!breakdown || breakdown.categories.length === 0) return null;
    if (!canSeeBreakdown) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <View style={styles.lockCard}>
            <Feather name="lock" size={20} color="#888" />
            <Text style={styles.lockText}>Upgrade to Starter or higher to see spending breakdown</Text>
            <Pressable style={styles.upgradeBtn} onPress={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('Dashboard', { screen: 'HostSubscription' });
              else navigation.navigate('HostSubscription');
            }}>
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spending Breakdown</Text>
        {breakdown.categories.map(cat => (
          <View key={cat.label} style={styles.breakdownRow}>
            <View style={styles.breakdownInfo}>
              <View style={[styles.catDot, { backgroundColor: cat.color }]} />
              <Text style={styles.breakdownLabel}>{cat.label}</Text>
              <Text style={styles.breakdownAmount}>{formatCents(cat.amountCents)}</Text>
              <Text style={styles.breakdownPercent}>{cat.percentage}%</Text>
            </View>
            <View style={styles.breakdownBarBg}>
              <View style={[styles.breakdownBarFill, {
                width: `${Math.max(cat.percentage, 2)}%`,
                backgroundColor: cat.color,
              }]} />
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderMonthlyTrend = () => {
    if (!breakdown || breakdown.monthlyTrend.length === 0) return null;
    if (!canSeeAdvanced) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Spending</Text>
          <View style={styles.lockCard}>
            <Feather name="lock" size={20} color="#888" />
            <Text style={styles.lockText}>Upgrade to Pro or higher to see monthly trend charts</Text>
            <Pressable style={styles.upgradeBtn} onPress={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('Dashboard', { screen: 'HostSubscription' });
              else navigation.navigate('HostSubscription');
            }}>
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    const trend = breakdown.monthlyTrend;
    const maxVal = Math.max(...trend.map(m => m.subscription + m.boosts + m.other), 1);
    const barAreaWidth = SCREEN_W - 80;
    const barWidth = Math.max(Math.floor(barAreaWidth / trend.length) - 8, 16);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Spending</Text>
        <View style={styles.chartContainer}>
          <View style={styles.barsRow}>
            {trend.map((m, i) => {
              const total = m.subscription + m.boosts + m.other;
              const h = Math.max((total / maxVal) * 140, 4);
              const subH = total > 0 ? (m.subscription / total) * h : 0;
              const boostH = total > 0 ? (m.boosts / total) * h : 0;
              const otherH = total > 0 ? (m.other / total) * h : 0;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={{ height: 140, justifyContent: 'flex-end' }}>
                    <View style={{ width: barWidth, borderRadius: 4, overflow: 'hidden' }}>
                      {otherH > 0 ? <View style={{ height: otherH, backgroundColor: CATEGORY_COLORS.other }} /> : null}
                      {boostH > 0 ? <View style={{ height: boostH, backgroundColor: CATEGORY_COLORS.boosts }} /> : null}
                      {subH > 0 ? <View style={{ height: subH, backgroundColor: CATEGORY_COLORS.subscription }} /> : null}
                    </View>
                  </View>
                  <Text style={styles.barLabel}>{m.month}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS.subscription }]} />
              <Text style={styles.legendText}>Sub</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS.boosts }]} />
              <Text style={styles.legendText}>Boosts</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS.other }]} />
              <Text style={styles.legendText}>Other</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderROI = () => {
    if (!summary) return null;
    if (!canSeeAdvanced) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROI Metrics</Text>
          <View style={styles.lockCard}>
            <Feather name="lock" size={20} color="#888" />
            <Text style={styles.lockText}>Upgrade to Pro to see ROI metrics</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ROI Metrics</Text>
        <View style={styles.roiRow}>
          <View style={styles.roiCard}>
            <Text style={styles.roiValue}>
              {summary.costPerInquiry ? formatCents(summary.costPerInquiry) : 'N/A'}
            </Text>
            <Text style={styles.roiLabel}>per inquiry</Text>
          </View>
          <View style={styles.roiCard}>
            <Text style={styles.roiValue}>
              {summary.costPerBooking ? formatCents(summary.costPerBooking) : 'N/A'}
            </Text>
            <Text style={styles.roiLabel}>per booking</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTransactions = () => {
    if (transactions.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {transactions.map(tx => {
          const cfg = TX_ICONS[tx.type] || { icon: 'dollar-sign', color: '#888', label: tx.type };
          const isRevenue = tx.amountCents < 0;
          return (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: cfg.color + '20' }]}>
                <Feather name={cfg.icon as any} size={18} color={cfg.color} />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txLabel} numberOfLines={1}>
                  {tx.description || cfg.label}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(tx.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: isRevenue ? GREEN : '#fff' }]}>
                {isRevenue ? '+' : '-'}{formatCents(Math.abs(tx.amountCents))}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="dollar-sign" size={48} color="#444" />
      <Text style={styles.emptyTitle}>No Transactions Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your spending and revenue data will appear here once you subscribe to a plan, purchase boosts, or confirm bookings.
      </Text>
    </View>
  );

  return (
    <>
      <AppHeader title="Revenue & Spending" onBack={() => navigation.goBack()} />
      <ScreenScrollView>
        <View style={styles.container}>
          {renderPeriodSelector()}
          {loading ? (
            <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 60 }} />
          ) : summary && summary.transactionCount === 0 && transactions.length === 0 ? (
            renderEmpty()
          ) : (
            <>
              {renderSummaryCards()}
              {renderBreakdown()}
              {renderMonthlyTrend()}
              {renderROI()}
              {renderTransactions()}
            </>
          )}
        </View>
      </ScreenScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: CARD_BG,
  },
  periodBtnActive: { backgroundColor: ACCENT },
  periodLabel: { color: '#999', fontSize: 13, fontWeight: '600' },
  periodLabelActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  summaryCardRight: {
    borderLeftWidth: 0,
  },
  summaryLabel: { color: '#999', fontSize: 12, marginBottom: 6, fontWeight: '500' },
  summaryValue: { color: '#fff', fontSize: 24, fontWeight: '700' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  trendText: { fontSize: 11, fontWeight: '500' },
  summarySubtext: { color: '#666', fontSize: 11, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#aaa', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
  },
  breakdownRow: { marginBottom: 14 },
  breakdownInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { color: '#ccc', fontSize: 13, flex: 1 },
  breakdownAmount: { color: '#fff', fontSize: 13, fontWeight: '600' },
  breakdownPercent: { color: '#888', fontSize: 12, width: 36, textAlign: 'right' },
  breakdownBarBg: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3,
  },
  breakdownBarFill: { height: 6, borderRadius: 3 },
  chartContainer: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
  },
  barsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
  },
  barCol: { alignItems: 'center' },
  barLabel: { color: '#888', fontSize: 10, marginTop: 6 },
  legendRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#888', fontSize: 11 },
  roiRow: { flexDirection: 'row', gap: 12 },
  roiCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 14,
    padding: 20, alignItems: 'center',
  },
  roiValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  roiLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  txIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  txInfo: { flex: 1 },
  txLabel: { color: '#fff', fontSize: 13, fontWeight: '500' },
  txDate: { color: '#666', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  lockCard: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 24,
    alignItems: 'center', gap: 10,
  },
  lockText: { color: '#888', fontSize: 13, textAlign: 'center' },
  upgradeBtn: {
    backgroundColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8, marginTop: 4,
  },
  upgradeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center', paddingTop: 60, paddingHorizontal: 32,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: {
    color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
});
