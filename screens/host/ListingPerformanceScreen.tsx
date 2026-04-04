import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';
import { getListingPerformance, ListingPerformanceData } from '../../services/listingAnalyticsService';
import { getMyListings, mapListingToProperty } from '../../services/listingService';
import { Property } from '../../types/models';

const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const CARD_BG = '#1a1a1a';
const SCREEN_W = Dimensions.get('window').width;

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export const ListingPerformanceScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { listingId } = route.params || {};
  const { user, getHostPlan } = useAuth();
  const hostPlan = getHostPlan() as HostPlan;
  const planLimits = getPlanLimits(hostPlan);
  const canSeeCharts = planLimits.analyticsLevel === 'basic' || planLimits.analyticsLevel === 'advanced';
  const canSeeBoostImpact = planLimits.analyticsLevel === 'advanced';

  const [data, setData] = useState<ListingPerformanceData | null>(null);
  const [listing, setListing] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadData();
  }, [period, listingId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const perf = await getListingPerformance(listingId, period);
      setData(perf);

      if (!listing && user) {
        const supaListings = await getMyListings(user.id);
        if (supaListings?.length) {
          const found = supaListings.find((l: any) => l.id === listingId);
          if (found) setListing(mapListingToProperty(found, user.name));
        }
      }
    } catch (err) {
      console.error('Failed to load performance:', err);
    }
    setLoading(false);
  };

  const responseTimeColor = useMemo(() => {
    if (!data?.avgResponseTimeHours) return '#666';
    if (data.avgResponseTimeHours < 2) return GREEN;
    if (data.avgResponseTimeHours < 6) return AMBER;
    return RED;
  }, [data?.avgResponseTimeHours]);

  const responseTimeLabel = useMemo(() => {
    if (!data?.avgResponseTimeHours) return 'N/A';
    if (data.avgResponseTimeHours < 2) return 'Great';
    if (data.avgResponseTimeHours < 6) return 'Good';
    return 'Needs Improvement';
  }, [data?.avgResponseTimeHours]);

  const responseTimePct = useMemo(() => {
    if (!data?.avgResponseTimeHours) return 0;
    return Math.max(0, Math.min(100, 100 - (data.avgResponseTimeHours / 24) * 100));
  }, [data?.avgResponseTimeHours]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Listing Performance"
        mode="back"
        onBack={() => navigation.goBack()}
      />

      <ScreenScrollView contentContainerStyle={styles.content}>
        {listing ? (
          <View style={styles.listingHeader}>
            {listing.photos?.[0] ? (
              <Image source={{ uri: listing.photos[0] }} style={styles.listingThumb} />
            ) : (
              <View style={[styles.listingThumb, styles.thumbPlaceholder]}>
                <Feather name="image" size={20} color="#666" />
              </View>
            )}
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
              <Text style={styles.listingMeta}>
                ${listing.price?.toLocaleString()}/mo
                {listing.bedrooms ? ` \u00B7 ${listing.bedrooms}BR` : ''}
                {listing.neighborhood ? ` \u00B7 ${listing.neighborhood}` : ''}
              </Text>
            </View>
          </View>
        ) : null}

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
        ) : data ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Views" value={data.totalViews} icon="eye" color={BLUE} />
              <StatCard label="Unique" value={data.uniqueViews} icon="users" color="#8b5cf6" />
              <StatCard label="Saves" value={data.totalSaves} icon="heart" color={ACCENT} />
              <StatCard label="Inquiries" value={data.totalInquiries} icon="message-circle" color={GREEN} />
            </View>

            {canSeeCharts ? (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Feather name="trending-up" size={16} color={BLUE} />
                    <Text style={styles.sectionTitle}>Views Over Time</Text>
                  </View>
                  <MiniBarChart data={data.viewsByDay} color={BLUE} />
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Feather name="message-circle" size={16} color={GREEN} />
                    <Text style={styles.sectionTitle}>Inquiries Over Time</Text>
                  </View>
                  <MiniBarChart data={data.inquiriesByDay} color={GREEN} />
                </View>
              </>
            ) : (
              <LockedOverlay
                title="Detailed Charts"
                message="Upgrade to Pro for time-series analytics"
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

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="clock" size={16} color={responseTimeColor} />
                <Text style={styles.sectionTitle}>Response Time</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.responseValue}>
                  {data.avgResponseTimeHours !== null ? `${data.avgResponseTimeHours} hours` : 'No data yet'}
                </Text>
                <View style={styles.responseBar}>
                  <View style={[styles.responseBarFill, { width: `${responseTimePct}%`, backgroundColor: responseTimeColor }]} />
                </View>
                <Text style={[styles.responseLabel, { color: responseTimeColor }]}>{responseTimeLabel}</Text>
              </View>
            </View>

            {data.boostImpact && canSeeBoostImpact ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="zap" size={16} color="#a855f7" />
                  <Text style={styles.sectionTitle}>Boost Impact</Text>
                </View>
                <View style={styles.card}>
                  <View style={styles.boostRow}>
                    <Text style={styles.boostLabel}>Views during boost</Text>
                    <Text style={styles.boostValue}>{data.boostImpact.viewsDuringBoost}</Text>
                    <TrendBadge value={data.boostImpact.liftPercentage} />
                  </View>
                  <View style={styles.boostRow}>
                    <Text style={styles.boostLabel}>Views before boost</Text>
                    <Text style={styles.boostValueMuted}>{data.boostImpact.viewsBeforeBoost}</Text>
                  </View>
                  <View style={[styles.boostRow, { marginTop: 8 }]}>
                    <Text style={styles.boostLabel}>Inquiries during boost</Text>
                    <Text style={styles.boostValue}>{data.boostImpact.inquiriesDuringBoost}</Text>
                  </View>
                  <View style={styles.boostRow}>
                    <Text style={styles.boostLabel}>Inquiries before boost</Text>
                    <Text style={styles.boostValueMuted}>{data.boostImpact.inquiriesBeforeBoost}</Text>
                  </View>
                </View>
              </View>
            ) : data.boostImpact && !canSeeBoostImpact ? (
              <LockedOverlay
                title="Boost Impact Analysis"
                message="Upgrade to Business for boost analytics"
                onUpgrade={() => {
                  const parent = navigation.getParent();
                  if (parent) {
                    parent.navigate('Dashboard', { screen: 'HostSubscription' });
                  } else {
                    navigation.navigate('HostSubscription');
                  }
                }}
              />
            ) : null}

            <Pressable
              style={styles.boostCta}
              onPress={() => navigation.navigate('ListingBoost', { listingId })}
            >
              <Feather name="zap" size={16} color="#fff" />
              <Text style={styles.boostCtaText}>Boost This Listing</Text>
            </Pressable>
          </>
        ) : null}
      </ScreenScrollView>
    </View>
  );
};

const StatCard = ({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) => (
  <View style={styles.statCard}>
    <Feather name={icon as any} size={16} color={color} />
    <Text style={styles.statValue}>{value.toLocaleString()}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const TrendBadge = ({ value }: { value: number }) => {
  const positive = value >= 0;
  return (
    <View style={[styles.trendBadge, { backgroundColor: positive ? 'rgba(62,207,142,0.12)' : 'rgba(239,68,68,0.12)' }]}>
      <Feather name={positive ? 'trending-up' : 'trending-down'} size={10} color={positive ? GREEN : RED} />
      <Text style={[styles.trendText, { color: positive ? GREEN : RED }]}>
        {positive ? '+' : ''}{value}%
      </Text>
    </View>
  );
};

const MiniBarChart = ({ data, color }: { data: { date: string; count: number }[]; color: string }) => {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barWidth = Math.max(2, Math.floor((SCREEN_W - 80) / Math.max(data.length, 1)) - 2);
  const showEveryN = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 7 ? 2 : 1;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartBars}>
        {data.map((d, i) => (
          <View key={i} style={styles.chartBarCol}>
            <View
              style={[
                styles.chartBar,
                {
                  height: Math.max(2, (d.count / maxVal) * 80),
                  width: barWidth,
                  backgroundColor: d.count > 0 ? color : 'rgba(255,255,255,0.06)',
                },
              ]}
            />
            {i % showEveryN === 0 ? (
              <Text style={styles.chartLabel}>{d.date.substring(5)}</Text>
            ) : null}
          </View>
        ))}
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
  listingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: CARD_BG, marginHorizontal: 16, marginTop: 8,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  listingThumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  listingInfo: { flex: 1, gap: 4 },
  listingTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  listingMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
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
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16,
  },
  statCard: {
    flex: 1, minWidth: (SCREEN_W - 62) / 4, alignItems: 'center', gap: 6,
    backgroundColor: CARD_BG, borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  responseValue: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 10 },
  responseBar: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginBottom: 6,
  },
  responseBarFill: { height: '100%', borderRadius: 3 },
  responseLabel: { fontSize: 12, fontWeight: '600' },
  boostRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  boostLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', flex: 1 },
  boostValue: { fontSize: 15, fontWeight: '700', color: '#fff', marginRight: 8 },
  boostValueMuted: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  trendText: { fontSize: 11, fontWeight: '700' },
  boostCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#a855f7', borderRadius: 14, paddingVertical: 14,
    marginHorizontal: 16, marginTop: 20,
  },
  boostCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  chartCard: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  chartBars: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 100,
  },
  chartBarCol: { alignItems: 'center', gap: 4 },
  chartBar: { borderRadius: 2 },
  chartLabel: { fontSize: 8, color: 'rgba(255,255,255,0.25)' },
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

export default ListingPerformanceScreen;
