import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';
import {
  getConversionFunnel, FunnelData,
  getInquiryTrends, InquiryTrendData,
} from '../../services/listingAnalyticsService';

const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const CARD_BG = '#1a1a1a';
const SCREEN_W = Dimensions.get('window').width;

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const FUNNEL_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#22c55e',
  '#10b981',
];

export const InquiryTrendsScreen = () => {
  const navigation = useNavigation<any>();
  const { user, getHostPlan } = useAuth();
  const hostPlan = getHostPlan() as HostPlan;
  const planLimits = getPlanLimits(hostPlan);
  const canSeeCharts = planLimits.analyticsLevel === 'basic' || planLimits.analyticsLevel === 'advanced';

  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [trends, setTrends] = useState<InquiryTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadData();
  }, [period, user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [f, t] = await Promise.all([
        getConversionFunnel(user.id, period),
        getInquiryTrends(user.id, period),
      ]);
      setFunnel(f);
      setTrends(t);
    } catch (err) {
      console.error('Failed to load inquiry trends:', err);
    }
    setLoading(false);
  };

  const avgResponseHours = useMemo(() => {
    if (!trends || trends.avgResponseTimeByDay.length === 0) return null;
    const total = trends.avgResponseTimeByDay.reduce((s, d) => s + d.hours, 0);
    return Math.round((total / trends.avgResponseTimeByDay.length) * 10) / 10;
  }, [trends]);

  const responseRating = useMemo(() => {
    if (avgResponseHours === null) return { label: 'N/A', color: '#666' };
    if (avgResponseHours < 2) return { label: 'Excellent', color: GREEN };
    if (avgResponseHours <= 6) return { label: 'Good', color: AMBER };
    return { label: 'Needs Improvement', color: RED };
  }, [avgResponseHours]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Inquiry Trends"
        mode="back"
        onBack={() => navigation.goBack()}
      />

      <ScreenScrollView contentContainerStyle={styles.content}>
        <View style={styles.periodRow}>
          <Text style={styles.periodLabel}>Time Period:</Text>
          <View style={styles.periodTabs}>
            {PERIODS.map(p => (
              <Pressable
                key={p.days}
                style={[styles.periodTab, period === p.days ? styles.periodTabActive : undefined]}
                onPress={() => setPeriod(p.days)}
              >
                <Text style={[styles.periodTabText, period === p.days ? styles.periodTabTextActive : undefined]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <>
            {funnel ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="filter" size={16} color="#8b5cf6" />
                  <Text style={styles.sectionTitle}>Conversion Funnel</Text>
                </View>
                <View style={styles.card}>
                  {[
                    { label: 'Views', count: funnel.views },
                    { label: 'Saves', count: funnel.saves },
                    { label: 'Inquiries', count: funnel.inquiries },
                    { label: 'Accepted', count: funnel.accepted },
                    { label: 'Booked', count: funnel.booked },
                  ].map((step, i) => {
                    const maxCount = Math.max(funnel.views, 1);
                    const widthPct = Math.max((step.count / maxCount) * 100, step.count > 0 ? 8 : 4);
                    const rate = funnel.views > 0
                      ? Math.round((step.count / funnel.views) * 1000) / 10
                      : 0;
                    return (
                      <View key={step.label} style={styles.funnelRow}>
                        <View
                          style={[
                            styles.funnelBar,
                            { width: `${widthPct}%`, backgroundColor: FUNNEL_COLORS[i] },
                          ]}
                        >
                          <Text style={styles.funnelBarText}>{step.count.toLocaleString()}</Text>
                        </View>
                        <View style={styles.funnelLabelRow}>
                          <Text style={styles.funnelLabel}>{step.label}</Text>
                          <Text style={styles.funnelRate}>{i === 0 ? '' : `${rate}%`}</Text>
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.conversionCallouts}>
                    <View style={styles.callout}>
                      <Text style={styles.calloutValue}>{funnel.conversionRates.viewToInquiry}%</Text>
                      <Text style={styles.calloutLabel}>View to Inquiry</Text>
                    </View>
                    <View style={styles.callout}>
                      <Text style={styles.calloutValue}>{funnel.conversionRates.inquiryToAccept}%</Text>
                      <Text style={styles.calloutLabel}>Inquiry to Accept</Text>
                    </View>
                    <View style={styles.callout}>
                      <Text style={styles.calloutValue}>{funnel.conversionRates.overallConversion}%</Text>
                      <Text style={styles.calloutLabel}>Overall</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {trends ? (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Feather name="pie-chart" size={16} color={AMBER} />
                    <Text style={styles.sectionTitle}>Inquiry Status</Text>
                  </View>
                  <View style={styles.card}>
                    {trends.statusBreakdown.map(item => {
                      const total = trends.statusBreakdown.reduce((s, b) => s + b.count, 0);
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <View key={item.status} style={styles.statusRow}>
                          <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                          <Text style={styles.statusLabel}>{item.status}</Text>
                          <Text style={styles.statusCount}>{item.count}</Text>
                          <View style={styles.statusBarWrap}>
                            <View style={[styles.statusBar, { width: `${Math.max(pct, 2)}%`, backgroundColor: item.color }]} />
                          </View>
                          <Text style={styles.statusPercent}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {canSeeCharts ? (
                  <>
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Feather name="bar-chart-2" size={16} color="#3b82f6" />
                        <Text style={styles.sectionTitle}>Daily Inquiries</Text>
                      </View>
                      <StackedBarChart data={trends.dailyCounts} period={period} />
                    </View>

                    {trends.avgResponseTimeByDay.length > 0 ? (
                      <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                          <Feather name="clock" size={16} color={responseRating.color} />
                          <Text style={styles.sectionTitle}>Response Time Trend</Text>
                        </View>
                        <View style={styles.card}>
                          <MiniLineChart data={trends.avgResponseTimeByDay} color="#8b5cf6" />
                          <View style={styles.responseAvg}>
                            <Text style={styles.responseAvgText}>
                              Average: {avgResponseHours !== null ? `${avgResponseHours} hours` : 'N/A'}
                            </Text>
                            <View style={[styles.responseBadge, { backgroundColor: responseRating.color }]}>
                              <Text style={styles.responseBadgeText}>{responseRating.label}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <LockedOverlay
                    title="Charts & Trends"
                    message="Upgrade to Pro for detailed inquiry charts"
                    onUpgrade={() => {
                      const parent = navigation.getParent();
                      if (parent) {
                        parent.navigate('Dashboard', { screen: 'HostSubscription' });
                      } else {
                        navigation.navigate('HostSubscription');
                      }
                    }}
                  />
                )}

                {trends.superInterestRate > 0 ? (
                  <View style={styles.superCallout}>
                    <Feather name="star" size={16} color="#ffd700" />
                    <Text style={styles.superCalloutText}>
                      {trends.superInterestRate}% of inquiries are Super Interests
                    </Text>
                  </View>
                ) : null}

                {trends.topInquiryListings.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Feather name="award" size={16} color={ACCENT} />
                      <Text style={styles.sectionTitle}>Top Listings by Inquiries</Text>
                    </View>
                    <View style={styles.card}>
                      {trends.topInquiryListings.map((listing, i) => (
                        <Pressable
                          key={listing.listingId}
                          style={styles.topListingRow}
                          onPress={() => navigation.navigate('ListingPerformance', { listingId: listing.listingId })}
                        >
                          <Text style={styles.topListingRank}>{i + 1}.</Text>
                          <Text style={styles.topListingTitle} numberOfLines={1}>{listing.title}</Text>
                          <Text style={styles.topListingCount}>{listing.count}</Text>
                          <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScreenScrollView>
    </View>
  );
};

const StackedBarChart = ({ data, period }: { data: InquiryTrendData['dailyCounts']; period: number }) => {
  const aggregated = useMemo(() => {
    if (period <= 30) return data;
    const weeks: typeof data = [];
    for (let i = 0; i < data.length; i += 7) {
      const chunk = data.slice(i, i + 7);
      weeks.push({
        date: chunk[0].date,
        pending: chunk.reduce((s, d) => s + d.pending, 0),
        accepted: chunk.reduce((s, d) => s + d.accepted, 0),
        passed: chunk.reduce((s, d) => s + d.passed, 0),
        expired: chunk.reduce((s, d) => s + d.expired, 0),
      });
    }
    return weeks;
  }, [data, period]);

  const maxVal = Math.max(...aggregated.map(d => d.pending + d.accepted + d.passed + d.expired), 1);
  const barWidth = Math.max(3, Math.floor((SCREEN_W - 80) / Math.max(aggregated.length, 1)) - 2);
  const showEveryN = aggregated.length > 14 ? Math.ceil(aggregated.length / 7) : aggregated.length > 7 ? 2 : 1;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartBars}>
        {aggregated.map((d, i) => {
          const total = d.pending + d.accepted + d.passed + d.expired;
          const h = Math.max(2, (total / maxVal) * 80);
          const segments = [
            { val: d.accepted, color: '#27AE60' },
            { val: d.pending, color: '#F39C12' },
            { val: d.passed, color: '#E74C3C' },
            { val: d.expired, color: '#95A5A6' },
          ];
          return (
            <View key={i} style={styles.chartBarCol}>
              <View style={{ height: h, width: barWidth, borderRadius: 2, overflow: 'hidden', justifyContent: 'flex-end' }}>
                {total > 0 ? segments.map((seg, si) => {
                  const segH = total > 0 ? (seg.val / total) * h : 0;
                  return segH > 0 ? (
                    <View key={si} style={{ height: segH, backgroundColor: seg.color }} />
                  ) : null;
                }) : (
                  <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                )}
              </View>
              {i % showEveryN === 0 ? (
                <Text style={styles.chartLabel}>{d.date.substring(5)}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        {[
          { label: 'Accepted', color: '#27AE60' },
          { label: 'Pending', color: '#F39C12' },
          { label: 'Passed', color: '#E74C3C' },
          { label: 'Expired', color: '#95A5A6' },
        ].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const MiniLineChart = ({ data, color }: { data: { date: string; hours: number }[]; color: string }) => {
  const maxVal = Math.max(...data.map(d => d.hours), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * (SCREEN_W - 80),
    y: 60 - (d.hours / maxVal) * 56,
  }));

  return (
    <View style={styles.lineChartWrap}>
      <View style={{ height: 64, width: SCREEN_W - 80 }}>
        {points.map((pt, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: pt.x - 3,
              top: pt.y - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
            }}
          />
        ))}
        {points.length > 1 ? points.slice(0, -1).map((pt, i) => {
          const next = points[i + 1];
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`l${i}`}
              style={{
                position: 'absolute',
                left: pt.x,
                top: pt.y,
                width: len,
                height: 2,
                backgroundColor: color,
                opacity: 0.5,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        }) : null}
      </View>
    </View>
  );
};

const LockedOverlay = ({ title, message, onUpgrade }: { title: string; message: string; onUpgrade: () => void }) => (
  <View style={styles.lockedCard}>
    <Feather name="lock" size={24} color="rgba(255,255,255,0.2)" />
    <Text style={styles.lockedTitle}>{title}</Text>
    <Text style={styles.lockedMsg}>{message}</Text>
    <Pressable style={styles.lockedBtn} onPress={onUpgrade}>
      <Text style={styles.lockedBtnText}>Upgrade</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { paddingBottom: 40 },
  periodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  periodLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  periodTabs: { flexDirection: 'row', gap: 6 },
  periodTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  periodTabActive: { backgroundColor: ACCENT },
  periodTabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  periodTabTextActive: { color: '#fff' },
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  funnelRow: { marginBottom: 10 },
  funnelBar: {
    height: 28, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 10,
    minWidth: 40,
  },
  funnelBarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  funnelLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 2, paddingHorizontal: 2,
  },
  funnelLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  funnelRate: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  conversionCallouts: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  callout: { alignItems: 'center', gap: 2 },
  calloutValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  calloutLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', width: 70 },
  statusCount: { fontSize: 14, fontWeight: '700', color: '#fff', width: 30, textAlign: 'right' },
  statusBarWrap: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginHorizontal: 6,
  },
  statusBar: { height: '100%', borderRadius: 3 },
  statusPercent: { fontSize: 12, color: 'rgba(255,255,255,0.35)', width: 32, textAlign: 'right' },
  chartCard: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  chartBars: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 100,
  },
  chartBarCol: { alignItems: 'center', gap: 4 },
  chartLabel: { fontSize: 8, color: 'rgba(255,255,255,0.25)' },
  chartLegend: {
    flexDirection: 'row', justifyContent: 'center', gap: 14,
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  lineChartWrap: { marginBottom: 12 },
  responseAvg: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  responseAvgText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  responseBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  responseBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  superCallout: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)',
  },
  superCalloutText: { fontSize: 13, fontWeight: '600', color: '#ffd700' },
  topListingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  topListingRank: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.3)', width: 20 },
  topListingTitle: { flex: 1, fontSize: 13, color: '#fff' },
  topListingCount: { fontSize: 14, fontWeight: '700', color: ACCENT, marginRight: 4 },
  lockedCard: {
    alignItems: 'center', gap: 8, paddingVertical: 32,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: CARD_BG, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  lockedTitle: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  lockedMsg: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingHorizontal: 32 },
  lockedBtn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
    backgroundColor: ACCENT, marginTop: 4,
  },
  lockedBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

export default InquiryTrendsScreen;
