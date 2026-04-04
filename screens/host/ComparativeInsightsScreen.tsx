import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';
import { getMyListings } from '../../services/listingService';
import {
  getMarketPosition, MarketPosition,
  getAreaSnapshot, AreaSnapshot,
  getImprovementTips, ImprovementTip,
} from '../../services/comparativeService';

const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const PURPLE = '#6C5CE7';
const CARD_BG = '#1a1a1a';
const SCREEN_W = Dimensions.get('window').width;

export const ComparativeInsightsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialListingId = route.params?.listingId;
  const { user, getHostPlan } = useAuth();
  const hostPlan = getHostPlan() as HostPlan;
  const planLimits = getPlanLimits(hostPlan);
  const canSeeFullComparison = planLimits.analyticsLevel === 'basic' || planLimits.analyticsLevel === 'advanced';
  const canSeeAreaSnapshot = planLimits.analyticsLevel === 'advanced';

  const [listings, setListings] = useState<any[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(initialListingId || null);
  const [position, setPosition] = useState<MarketPosition | null>(null);
  const [area, setArea] = useState<AreaSnapshot | null>(null);
  const [tips, setTips] = useState<ImprovementTip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadListings();
  }, [user?.id]);

  useEffect(() => {
    if (initialListingId) setSelectedListingId(initialListingId);
  }, [initialListingId]);

  useEffect(() => {
    if (selectedListingId && user?.id) loadComparison();
  }, [selectedListingId, user?.id]);

  const loadListings = async () => {
    if (!user?.id) return;
    const myListings = await getMyListings(user.id);
    const active = myListings.filter((l: any) => l.is_active && !l.is_rented);
    setListings(active);
    if (!selectedListingId && active.length > 0) {
      setSelectedListingId(active[0].id);
    }
    if (active.length === 0) setLoading(false);
  };

  const loadComparison = async () => {
    if (!selectedListingId || !user?.id) return;
    setLoading(true);
    try {
      const pos = await getMarketPosition(selectedListingId, user.id);
      setPosition(pos);
      if (pos) {
        const snap = await getAreaSnapshot(pos.neighborhood, '');
        setArea(snap);
        setTips(getImprovementTips(pos));
      }
    } catch (err) {
      console.error('Failed to load comparison:', err);
    }
    setLoading(false);
  };

  const renderListingSelector = () => {
    if (listings.length <= 1) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
        {listings.map(listing => (
          <Pressable
            key={listing.id}
            style={[styles.selectorChip, selectedListingId === listing.id && styles.selectorChipActive]}
            onPress={() => setSelectedListingId(listing.id)}
          >
            <Text
              style={[styles.selectorChipText, selectedListingId === listing.id && styles.selectorChipTextActive]}
              numberOfLines={1}
            >
              {listing.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const renderOverallScore = () => {
    if (!position) return null;
    const scoreColor = position.overallScore >= 75 ? GREEN
      : position.overallScore >= 50 ? AMBER : RED;

    return (
      <View style={styles.overallCard}>
        <View style={styles.overallBadge}>
          <Feather name="award" size={22} color={scoreColor} />
          <Text style={[styles.overallRank, { color: scoreColor }]}>{position.overallRank}</Text>
        </View>
        <Text style={styles.overallScoreText}>Score: {position.overallScore} / 100</Text>
        <View style={styles.scoreBarBg}>
          <View style={[styles.scoreBarFill, {
            width: `${position.overallScore}%`,
            backgroundColor: scoreColor,
          }]} />
        </View>
        <Text style={styles.overallNeighborhood}>
          {position.neighborhood} {area ? `\u00b7 ${area.totalActiveListings} listings` : ''}
        </Text>
      </View>
    );
  };

  const renderPriceComparison = () => {
    if (!position) return null;
    const range = position.areaPriceRange.max - position.areaPriceRange.min;
    const yourPos = range > 0
      ? Math.min(95, Math.max(5, ((position.yourPrice - position.areaPriceRange.min) / range) * 100))
      : 50;
    const medianPos = range > 0
      ? Math.min(95, Math.max(5, ((position.areaMedianPrice - position.areaPriceRange.min) / range) * 100))
      : 50;

    const verdictColor = position.priceVerdict === 'below_market' ? GREEN
      : position.priceVerdict === 'at_market' ? AMBER : RED;
    const verdictLabel = position.priceVerdict === 'below_market' ? 'Below Market'
      : position.priceVerdict === 'at_market' ? 'At Market' : 'Above Market';

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price Comparison</Text>
        <View style={styles.priceCard}>
          <Text style={styles.priceRange}>
            ${position.areaPriceRange.min.toLocaleString()} — ${position.areaPriceRange.max.toLocaleString()}
          </Text>
          <View style={styles.priceBarContainer}>
            <View style={styles.priceBar} />
            <View style={[styles.priceMarker, { left: `${medianPos}%` }]}>
              <View style={styles.medianLine} />
              <Text style={styles.medianLabel}>Median</Text>
            </View>
            <View style={[styles.yourPriceMarker, { left: `${yourPos}%` }]}>
              <View style={[styles.yourPriceDot, { backgroundColor: verdictColor }]} />
              <Text style={styles.yourPriceLabel}>${position.yourPrice.toLocaleString()}</Text>
            </View>
          </View>
          <View style={[styles.verdictBadge, { backgroundColor: verdictColor + '22' }]}>
            <Text style={[styles.verdictText, { color: verdictColor }]}>{verdictLabel}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMetricComparison = (
    title: string,
    yourValue: string,
    areaValue: string,
    percentile: number,
    icon: string,
  ) => {
    const pColor = percentile >= 70 ? GREEN : percentile >= 40 ? AMBER : RED;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Feather name="user" size={14} color={PURPLE} />
            <Text style={styles.metricValue}>{yourValue}</Text>
            <Text style={styles.metricLabel}>You</Text>
            <View style={[styles.percentileBadge, { backgroundColor: pColor + '22' }]}>
              <Text style={[styles.percentileText, { color: pColor }]}>
                Top {Math.max(1, 100 - percentile)}%
              </Text>
            </View>
          </View>
          <View style={styles.metricCard}>
            <Feather name="users" size={14} color="#888" />
            <Text style={styles.metricValue}>{areaValue}</Text>
            <Text style={styles.metricLabel}>Area Avg</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderLockedMetric = (title: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.lockCard}>
        <Feather name="lock" size={18} color="#888" />
        <Text style={styles.lockText}>Upgrade to Pro to unlock {title.toLowerCase()} insights</Text>
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

  const renderAreaSnapshot = () => {
    if (!area) return null;
    if (!canSeeAreaSnapshot) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Area Snapshot</Text>
          <View style={styles.lockCard}>
            <Feather name="lock" size={18} color="#888" />
            <Text style={styles.lockText}>Upgrade to Pro for detailed area insights</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Area Snapshot</Text>
        <View style={styles.areaCard}>
          <View style={styles.areaRow}>
            <Feather name="home" size={14} color="#888" />
            <Text style={styles.areaDetail}>{area.totalActiveListings} active listings</Text>
          </View>
          <View style={styles.areaRow}>
            <Feather name="dollar-sign" size={14} color="#888" />
            <Text style={styles.areaDetail}>Median: ${area.medianPrice.toLocaleString()}/mo</Text>
          </View>
          {area.topAmenities.length > 0 ? (
            <View style={styles.areaRow}>
              <Feather name="check-circle" size={14} color="#888" />
              <Text style={styles.areaDetail} numberOfLines={2}>
                Top amenities: {area.topAmenities.slice(0, 5).join(', ')}
              </Text>
            </View>
          ) : null}
          <View style={styles.areaRow}>
            <Feather name="image" size={14} color="#888" />
            <Text style={styles.areaDetail}>Avg photos: {area.avgPhotosCount} per listing</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTips = () => {
    if (tips.length === 0) return null;
    if (!canSeeFullComparison) return null;
    const impactColors = { high: RED, medium: AMBER, low: GREEN };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Improvement Tips</Text>
        {tips.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <View style={[styles.tipIconBg, { backgroundColor: PURPLE + '22' }]}>
                <Feather name={tip.icon as any} size={16} color={PURPLE} />
              </View>
              <View style={[styles.impactBadge, { backgroundColor: impactColors[tip.impact] + '22' }]}>
                <Text style={[styles.impactText, { color: impactColors[tip.impact] }]}>
                  {tip.impact.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipDescription}>{tip.description}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="bar-chart-2" size={48} color="#444" />
      <Text style={styles.emptyTitle}>Not Enough Data</Text>
      <Text style={styles.emptySubtitle}>
        We need more listings in your area to generate comparative insights. Check back soon.
      </Text>
    </View>
  );

  const renderNoListings = () => (
    <View style={styles.emptyContainer}>
      <Feather name="home" size={48} color="#444" />
      <Text style={styles.emptyTitle}>No Active Listings</Text>
      <Text style={styles.emptySubtitle}>
        Create a listing first to see how it compares to others in your area.
      </Text>
    </View>
  );

  if (planLimits.analyticsLevel === 'none') {
    return (
      <>
        <AppHeader title="How You Compare" onBack={() => navigation.goBack()} />
        <ScreenScrollView>
          <View style={styles.emptyContainer}>
            <Feather name="lock" size={48} color="#444" />
            <Text style={styles.emptyTitle}>Comparative Insights</Text>
            <Text style={styles.emptySubtitle}>
              Upgrade to a Pro plan to see how your listings compare to others in your area.
            </Text>
            <Pressable style={styles.upgradeBtn} onPress={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('Dashboard', { screen: 'HostSubscription' });
              else navigation.navigate('HostSubscription');
            }}>
              <Text style={styles.upgradeBtnText}>Upgrade Plan</Text>
            </Pressable>
          </View>
        </ScreenScrollView>
      </>
    );
  }

  return (
    <>
      <AppHeader title="How You Compare" onBack={() => navigation.goBack()} />
      <ScreenScrollView>
        <View style={styles.container}>
          {renderListingSelector()}
          {loading ? (
            <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 60 }} />
          ) : listings.length === 0 ? (
            renderNoListings()
          ) : !position ? (
            renderEmpty()
          ) : (
            <>
              {renderOverallScore()}
              {renderPriceComparison()}
              {canSeeFullComparison ? (
                <>
                  {renderMetricComparison(
                    'Engagement',
                    `${position.yourViewsPerDay.toFixed(1)}/day`,
                    `${position.areaAvgViewsPerDay.toFixed(1)}/day`,
                    position.engagementPercentile,
                    'eye',
                  )}
                  {renderMetricComparison(
                    'Response Time',
                    position.yourResponseHours !== null ? `${position.yourResponseHours}h` : 'N/A',
                    `${position.areaAvgResponseHours}h`,
                    position.responsePercentile,
                    'clock',
                  )}
                  {renderMetricComparison(
                    'Inquiry Rate',
                    `${position.yourInquiryRate}%`,
                    `${position.areaAvgInquiryRate}%`,
                    position.inquiryRatePercentile,
                    'message-circle',
                  )}
                </>
              ) : (
                <>
                  {renderLockedMetric('Engagement')}
                  {renderLockedMetric('Response Time')}
                  {renderLockedMetric('Inquiry Rate')}
                </>
              )}
              {renderAreaSnapshot()}
              {renderTips()}
            </>
          )}
        </View>
      </ScreenScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  selectorRow: { marginBottom: 16 },
  selectorChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: CARD_BG,
    marginRight: 8, maxWidth: 180,
  },
  selectorChipActive: { backgroundColor: ACCENT },
  selectorChipText: { color: '#999', fontSize: 13, fontWeight: '600' },
  selectorChipTextActive: { color: '#fff' },
  overallCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 24,
  },
  overallBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  overallRank: { fontSize: 20, fontWeight: '800' },
  overallScoreText: { color: '#ccc', fontSize: 14, marginBottom: 12 },
  scoreBarBg: {
    width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4, marginBottom: 10,
  },
  scoreBarFill: { height: 8, borderRadius: 4 },
  overallNeighborhood: { color: '#888', fontSize: 12 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#aaa', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase',
  },
  priceCard: { backgroundColor: CARD_BG, borderRadius: 14, padding: 16 },
  priceRange: { color: '#ccc', fontSize: 13, marginBottom: 16 },
  priceBarContainer: { height: 50, position: 'relative', marginBottom: 12 },
  priceBar: {
    position: 'absolute', top: 20, left: 0, right: 0,
    height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3,
  },
  priceMarker: { position: 'absolute', top: 0, alignItems: 'center', marginLeft: -20 },
  medianLine: { width: 2, height: 16, backgroundColor: '#888', marginBottom: 2 },
  medianLabel: { color: '#888', fontSize: 10 },
  yourPriceMarker: { position: 'absolute', top: 28, alignItems: 'center', marginLeft: -30 },
  yourPriceDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 2 },
  yourPriceLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  verdictBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
  },
  verdictText: { fontSize: 12, fontWeight: '700' },
  metricRow: { flexDirection: 'row', gap: 12 },
  metricCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 6,
  },
  metricValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  metricLabel: { color: '#888', fontSize: 12 },
  percentileBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  percentileText: { fontSize: 11, fontWeight: '700' },
  areaCard: { backgroundColor: CARD_BG, borderRadius: 14, padding: 16, gap: 10 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  areaDetail: { color: '#ccc', fontSize: 13, flex: 1 },
  tipCard: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginBottom: 10,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tipIconBg: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  impactBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  impactText: { fontSize: 10, fontWeight: '800' },
  tipTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  tipDescription: { color: '#888', fontSize: 12, lineHeight: 18 },
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
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
