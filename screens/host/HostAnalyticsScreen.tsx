import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, Pressable, Share,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../components/VectorIcons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { StorageService } from '../../utils/storage';
import { Property, InterestCard } from '../../types/models';
import { Spacing, BorderRadius } from '../../constants/theme';
import { getMyListings, mapListingToProperty, getListingViewStats, type ListingViewStats } from '../../services/listingService';
import { getReceivedInterestCards } from '../../services/discoverService';
import { canAccessAnalytics } from '../../utils/planGates';
import { LockedFeatureWall } from '../../components/host/LockedFeatureWall';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';
import { getOutreachLogForHost } from '../../services/hostOutreachService';

const ACCENT  = '#ff6b5b';
const ACCENT2 = '#5B7FFF';
const GREEN   = '#3ECF8E';
const AMBER   = '#f59e0b';
const CARD_BG = '#1a1a1a';
const BG      = '#111';

export const HostAnalyticsScreen = () => {
  const { user, getHostPlan } = useAuth();
  const navigation = useNavigation<any>();
  const hostPlan = getHostPlan() as HostPlan;
  const analyticsLocked = !canAccessAnalytics(hostPlan);
  const analyticsLevel = getPlanLimits(hostPlan).analyticsLevel;
  const isAdvanced = analyticsLevel === 'advanced';
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<InterestCard[]>([]);
  const [viewStats, setViewStats] = useState<ListingViewStats[]>([]);
  const [outreachLog, setOutreachLog] = useState<any[]>([]);
  const [trendWindow, setTrendWindow] = useState<30 | 90>(30);

  useFocusEffect(
    useCallback(() => { loadData(); }, [user?.id])
  );

  const loadData = async () => {
    if (!user) return;

    try {
      const supaListings = await getMyListings();
      if (supaListings?.length) {
        const mapped: Property[] = supaListings.map((l: any) => mapListingToProperty(l, user.name));
        setProperties(mapped);
        if (isAdvanced) {
          const stats = await getListingViewStats(mapped.map(p => p.id));
          setViewStats(stats);
        }
      } else {
        setProperties([]);
      }
    } catch {
      const allProperties = await StorageService.getProperties();
      setProperties(allProperties.filter(p => p.hostId === user.id));
    }

    try {
      const supaCards = await getReceivedInterestCards();
      const mapped: InterestCard[] = (supaCards || []).map((c: any) => ({
        id: c.id,
        renterId: c.sender?.id || c.sender_id,
        renterName: c.sender?.full_name || 'Unknown',
        renterPhoto: c.sender?.avatar_url,
        hostId: c.recipient_id || user.id,
        propertyId: c.listing_id || '',
        propertyTitle: c.listing_title || '',
        status: c.status || 'pending',
        isSuperInterest: c.action === 'super_interest',
        compatibilityScore: c.compatibility_score || 0,
        budgetRange: c.budget_range || '',
        moveInDate: c.move_in_date || '',
        lifestyleTags: c.lifestyle_tags || [],
        personalNote: c.personal_note || '',
        createdAt: c.created_at || new Date().toISOString(),
        respondedAt: c.responded_at,
      }));
      setInquiries(mapped);
    } catch {
      const cards = await StorageService.getInterestCardsForHost(user.id);
      setInquiries(cards);
    }

    if (isAdvanced) {
      try {
        const log = await getOutreachLogForHost(user.id);
        setOutreachLog(log);
      } catch {
        setOutreachLog([]);
      }
    }
  };

  const totalListings   = properties.length;
  const activeListings  = properties.filter(p => p.available && !p.rentedDate).length;
  const rentedListings  = properties.filter(p => !!p.rentedDate).length;
  const pausedListings  = properties.filter(p => !p.available && !p.rentedDate).length;

  const totalInquiries   = inquiries.length;
  const pendingInquiries = inquiries.filter(i => i.status === 'pending').length;
  const acceptedInquiries = inquiries.filter(i => i.status === 'accepted').length;
  const passedInquiries  = inquiries.filter(i => i.status === 'passed').length;
  const acceptRate = totalInquiries > 0
    ? Math.round((acceptedInquiries / totalInquiries) * 100) : 0;

  const totalRealViews    = viewStats.reduce((sum, s) => sum + s.last30Days, 0);
  const estimatedViews    = totalInquiries * 15;
  const estimatedSaves    = totalInquiries * 8;
  const displayViews      = isAdvanced ? totalRealViews : estimatedViews;
  const displayViewsLabel = isAdvanced ? 'Listing Views' : 'Est. Views';

  const now = Date.now();
  const windowMs = trendWindow * 24 * 60 * 60 * 1000;
  const priorWindowMs = windowMs * 2;
  const inquiriesInWindow = inquiries.filter(i =>
    now - new Date(i.createdAt).getTime() < windowMs
  ).length;
  const inquiriesPrior = inquiries.filter(i => {
    const age = now - new Date(i.createdAt).getTime();
    return age >= windowMs && age < priorWindowMs;
  }).length;
  const trendDelta    = inquiriesInWindow - inquiriesPrior;
  const trendPositive = trendDelta > 0;
  const trendNeutral  = trendDelta === 0;

  const perListingInquiries = properties.map(p => {
    const count = inquiries.filter(i => i.propertyId === p.id).length;
    const views = viewStats.find(s => s.listingId === p.id)?.last30Days ?? 0;
    return { property: p, inquiryCount: count, viewCount: views };
  });
  const maxInquiryCount = Math.max(...perListingInquiries.map(p => p.inquiryCount), 1);

  const budgetBuckets: Record<string, number> = {};
  inquiries.forEach(i => {
    if (!i.budgetRange) return;
    budgetBuckets[i.budgetRange] = (budgetBuckets[i.budgetRange] || 0) + 1;
  });
  const topBudgets = Object.entries(budgetBuckets).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const moveInMonths: Record<string, number> = {};
  inquiries.forEach(i => {
    if (!i.moveInDate) return;
    const month = new Date(i.moveInDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    moveInMonths[month] = (moveInMonths[month] || 0) + 1;
  });
  const moveInSorted = Object.entries(moveInMonths).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const tagCounts: Record<string, number> = {};
  inquiries.forEach(i => {
    (i.lifestyleTags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const outreachThisMonth = outreachLog.filter(
    (e: any) => new Date(e.sentAt).getTime() > thirtyDaysAgo
  ).length;
  const outreachConversions = inquiries.filter(i => {
    const inquiryTime = new Date(i.createdAt).getTime();
    return outreachLog.some((e: any) =>
      e.groupId === i.renterId &&
      Math.abs(inquiryTime - new Date(e.sentAt).getTime()) < 7 * 24 * 60 * 60 * 1000
    );
  }).length;
  const outreachConversionRate = outreachThisMonth > 0
    ? Math.round((outreachConversions / outreachThisMonth) * 100) : 0;

  const isCompany = user?.hostType === 'company';
  const isAgent = user?.hostType === 'agent';
  const showCompanyExtras = isAdvanced && isCompany;
  const showAgentExtras = isAdvanced && isAgent;

  const occupiedListings = properties.filter(p => !!p.rentedDate).length;
  const vacancyRate = totalListings > 0
    ? Math.round(((totalListings - occupiedListings) / totalListings) * 100) : 0;
  const occupancyRate = 100 - vacancyRate;
  const projectedRevenue = properties
    .filter(p => !!p.rentedDate)
    .reduce((sum, p) => sum + (p.price || 0), 0);
  const filledListings = properties.filter(p => !!p.rentedDate && !!p.createdAt);
  const avgDaysToFill = filledListings.length > 0
    ? Math.round(
        filledListings.reduce((sum, p) => {
          const created = new Date(p.createdAt).getTime();
          const rented = new Date(p.rentedDate!).getTime();
          return sum + (rented - created) / (1000 * 60 * 60 * 24);
        }, 0) / filledListings.length
      )
    : null;

  const respondedCards = inquiries.filter(i => !!i.respondedAt && !!i.createdAt);
  const avgResponseHours = respondedCards.length > 0
    ? Math.round(
        respondedCards.reduce((sum, i) => {
          const received = new Date(i.createdAt).getTime();
          const responded = new Date(i.respondedAt!).getTime();
          return sum + (responded - received) / (1000 * 60 * 60);
        }, 0) / respondedCards.length
      )
    : null;
  const responseLabel = avgResponseHours === null
    ? '\u2014'
    : avgResponseHours < 1
    ? '< 1 hr'
    : avgResponseHours < 24
    ? `${avgResponseHours} hrs`
    : `${Math.round(avgResponseHours / 24)} days`;
  const responseColor = avgResponseHours === null
    ? '#666'
    : avgResponseHours <= 4 ? GREEN
    : avgResponseHours <= 24 ? AMBER
    : ACCENT;

  const handleExport = async () => {
    const header = 'Renter,Listing,Status,Budget,Move-In,Compatibility,Date\n';
    const rows = inquiries.map(i =>
      [
        i.renterName,
        i.propertyTitle,
        i.status,
        i.budgetRange,
        i.moveInDate,
        i.compatibilityScore,
        new Date(i.createdAt).toLocaleDateString(),
      ].join(',')
    ).join('\n');
    await Share.share({ title: 'Roomdr Analytics Export', message: header + rows });
  };

  const handleCompanyExport = async () => {
    const header = 'Listing,Price,Status,Views,Inquiries,Accept Rate,Days Listed\n';
    const rows = perListingInquiries.map(({ property, inquiryCount, viewCount }) => {
      const accepted = inquiries.filter(i => i.propertyId === property.id && i.status === 'accepted').length;
      const rate = inquiryCount > 0 ? Math.round((accepted / inquiryCount) * 100) : 0;
      const daysListed = property.createdAt
        ? Math.round((Date.now() - new Date(property.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : '\u2014';
      return [
        `"${property.title}"`, `$${property.price}/mo`, getStatusLabel(property),
        viewCount, inquiryCount, `${rate}%`, daysListed,
      ].join(',');
    }).join('\n');
    await Share.share({ title: 'Roomdr Portfolio Report', message: header + rows });
  };

  const handleAgentExport = async () => {
    const header = 'Listing,Price,Days Listed,Views,Inquiries,Accepted,Accept Rate,Health Score,Status\n';
    const rows = perListingInquiries.map(({ property, inquiryCount, viewCount }) => {
      const accepted = inquiries.filter(i => i.propertyId === property.id && i.status === 'accepted').length;
      const daysListed = property.createdAt
        ? Math.round((Date.now() - new Date(property.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const score = getListingHealthScore(viewCount, inquiryCount, accepted, daysListed as number);
      const rate = inquiryCount > 0 ? Math.round((accepted / inquiryCount) * 100) : 0;
      return [
        `"${property.title}"`, `$${property.price}/mo`, daysListed,
        viewCount, inquiryCount, accepted, `${rate}%`, score, getStatusLabel(property),
      ].join(',');
    }).join('\n');
    await Share.share({ title: 'Roomdr Client Report', message: header + rows });
  };

  const getStatusLabel = (p: Property) => p.rentedDate ? 'Rented' : !p.available ? 'Paused' : 'Active';
  const getStatusColor = (p: Property) => p.rentedDate ? ACCENT2 : !p.available ? AMBER : GREEN;

  if (analyticsLocked) {
    return (
      <ScreenScrollView style={{ backgroundColor: BG }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={28} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h2" style={{ marginLeft: 8 }}>Analytics</ThemedText>
        </View>
        <LockedFeatureWall
          icon="bar-chart-2"
          title="Analytics"
          description="Track listing views, match rates, and outreach performance. Upgrade to Pro to unlock detailed insights."
          requiredPlan="Pro"
          onUpgrade={() => navigation.navigate('HostSubscription')}
        />
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView style={{ backgroundColor: BG }}>

      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={28} color="#FFFFFF" />
        </Pressable>
        <ThemedText type="h2" style={{ marginLeft: 8 }}>Analytics</ThemedText>
      </View>

      <ThemedText type="h2" style={styles.sectionTitle}>Overview</ThemedText>
      <View style={styles.overviewGrid}>
        <OverviewCard icon="home" label="Total Listings" value={totalListings} />
        <OverviewCard icon="check-circle" label="Active" value={activeListings} color={GREEN} />
        <OverviewCard icon="heart" label="Inquiries" value={totalInquiries} />
        <OverviewCard icon="trending-up" label="Accept Rate" value={`${acceptRate}%`} color={ACCENT} />
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="Pending" value={pendingInquiries} color={AMBER} />
        <StatusPill label="Accepted" value={acceptedInquiries} color={GREEN} />
        <StatusPill label="Passed" value={passedInquiries} color="#FF4757" />
        <StatusPill label="Rented" value={rentedListings} color={ACCENT2} />
        <StatusPill label="Paused" value={pausedListings} color={AMBER} />
      </View>

      <ThemedText type="h2" style={styles.sectionTitle}>Conversion Funnel</ThemedText>
      <View style={[styles.card, { backgroundColor: CARD_BG }]}>
        <FunnelRow
          label={displayViewsLabel}
          value={displayViews}
          maxValue={displayViews}
          color={ACCENT2}
          isEstimated={!isAdvanced}
        />
        {!isAdvanced ? (
          <FunnelRow label="Est. Saves" value={estimatedSaves} maxValue={estimatedViews} color={AMBER} isEstimated />
        ) : null}
        <FunnelRow label="Inquiries" value={totalInquiries} maxValue={displayViews || 1} color={ACCENT} />
        <FunnelRow label="Accepted" value={acceptedInquiries} maxValue={displayViews || 1} color={GREEN} />
      </View>
      {!isAdvanced ? (
        <ThemedText style={styles.disclaimer}>
          * Estimated based on inquiry volume. Upgrade to Business for real view tracking.
        </ThemedText>
      ) : null}

      <ThemedText type="h2" style={styles.sectionTitle}>Per-Listing Breakdown</ThemedText>
      {perListingInquiries.length === 0 ? (
        <View style={[styles.card, { backgroundColor: CARD_BG, alignItems: 'center', paddingVertical: Spacing.xxl }]}>
          <Feather name="bar-chart-2" size={40} color="#666" />
          <ThemedText style={{ color: '#888', marginTop: Spacing.md }}>No listings yet</ThemedText>
        </View>
      ) : (
        perListingInquiries.map(({ property, inquiryCount, viewCount }) => (
          <View key={property.id} style={[styles.card, { backgroundColor: CARD_BG, marginBottom: Spacing.md }]}>
            <View style={styles.listingHeader}>
              <ThemedText type="h3" style={{ flex: 1 }} numberOfLines={1}>{property.title}</ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(property) + '22' }]}>
                <ThemedText style={[styles.statusBadgeText, { color: getStatusColor(property) }]}>
                  {getStatusLabel(property)}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={{ color: '#888', marginBottom: Spacing.sm }}>${property.price}/mo</ThemedText>

            {isAdvanced ? (
              <View style={[styles.barRow, { marginBottom: Spacing.xs }]}>
                <ThemedText style={{ color: ACCENT2, width: 80, fontSize: 12 }}>{viewCount} views</ThemedText>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, {
                    width: `${Math.max((viewCount / Math.max(...perListingInquiries.map(p => p.viewCount), 1)) * 100, viewCount > 0 ? 8 : 0)}%`,
                    backgroundColor: ACCENT2,
                  }]} />
                </View>
              </View>
            ) : null}

            <View style={styles.barRow}>
              <ThemedText style={{ color: '#aaa', width: 80 }}>{inquiryCount} inquiries</ThemedText>
              <View style={styles.barContainer}>
                <View style={[styles.bar, {
                  width: `${Math.max((inquiryCount / maxInquiryCount) * 100, inquiryCount > 0 ? 8 : 0)}%`,
                  backgroundColor: ACCENT,
                }]} />
              </View>
            </View>

            {isAdvanced && viewCount > 0 ? (
              <ThemedText style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                {Math.round((inquiryCount / viewCount) * 100)}% view-to-inquiry rate
              </ThemedText>
            ) : null}
          </View>
        ))
      )}

      <View style={styles.sectionTitleRow}>
        <ThemedText type="h2" style={[styles.sectionTitle, { flex: 1, marginTop: 0, marginBottom: 0 }]}>Trend</ThemedText>
        {isAdvanced ? (
          <View style={styles.windowToggle}>
            {([30, 90] as const).map(w => (
              <Pressable
                key={w}
                style={[styles.windowBtn, trendWindow === w && styles.windowBtnActive]}
                onPress={() => setTrendWindow(w)}
              >
                <ThemedText style={[styles.windowBtnText, trendWindow === w && { color: '#fff' }]}>
                  {w}d
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={[styles.card, { backgroundColor: CARD_BG }]}>
        <View style={styles.trendRow}>
          <Feather
            name={trendPositive ? 'trending-up' : trendNeutral ? 'minus' : 'trending-down'}
            size={24}
            color={trendPositive ? GREEN : trendNeutral ? '#888' : '#FF4757'}
          />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="h3">
              {trendPositive
                ? `+${trendDelta} more than prior ${trendWindow} days`
                : trendNeutral && inquiriesInWindow > 0
                ? `Same as prior ${trendWindow} days`
                : trendNeutral
                ? 'Getting Started'
                : `${Math.abs(trendDelta)} fewer than prior ${trendWindow} days`}
            </ThemedText>
            <ThemedText style={{ color: '#888', marginTop: Spacing.xs }}>
              {inquiriesInWindow > 0
                ? `${inquiriesInWindow} inquir${inquiriesInWindow !== 1 ? 'ies' : 'y'} in the last ${trendWindow} days${inquiriesPrior > 0 ? ` vs. ${inquiriesPrior} prior` : ''}.`
                : `No inquiries in the last ${trendWindow} days.`}
            </ThemedText>
          </View>
        </View>
      </View>

      {isAdvanced ? (
        <>
          <View style={styles.advancedHeader}>
            <View style={styles.advancedBadge}>
              <Feather name="zap" size={11} color="#fff" />
              <ThemedText style={styles.advancedBadgeText}>Business</ThemedText>
            </View>
            <ThemedText type="h2" style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, marginTop: 0 }]}>
              Renter Demographics
            </ThemedText>
          </View>

          {totalInquiries === 0 ? (
            <View style={[styles.card, { backgroundColor: CARD_BG, alignItems: 'center', paddingVertical: Spacing.xl }]}>
              <Feather name="users" size={32} color="#444" />
              <ThemedText style={{ color: '#666', marginTop: 8, fontSize: 13 }}>No inquiries yet — demographics will appear here</ThemedText>
            </View>
          ) : (
            <>
              {topTags.length > 0 ? (
                <View style={[styles.card, { backgroundColor: CARD_BG }]}>
                  <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>Top Lifestyle Tags</ThemedText>
                  <View style={styles.tagCloud}>
                    {topTags.map(([tag, count]) => (
                      <View key={tag} style={styles.tagChip}>
                        <ThemedText style={styles.tagChipText}>{tag}</ThemedText>
                        <View style={styles.tagChipCount}>
                          <ThemedText style={styles.tagChipCountText}>{count}</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {topBudgets.length > 0 ? (
                <View style={[styles.card, { backgroundColor: CARD_BG, marginTop: Spacing.md }]}>
                  <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>Budget Ranges</ThemedText>
                  {topBudgets.map(([label, count]) => (
                    <View key={label} style={styles.barRow}>
                      <ThemedText style={{ color: '#aaa', fontSize: 12, width: 120 }} numberOfLines={1}>{label}</ThemedText>
                      <View style={styles.barContainer}>
                        <View style={[styles.bar, {
                          width: `${(count / (topBudgets[0]?.[1] || 1)) * 100}%`,
                          backgroundColor: ACCENT2,
                        }]} />
                      </View>
                      <ThemedText style={{ color: '#666', fontSize: 12, width: 24, textAlign: 'right' }}>{count}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {moveInSorted.length > 0 ? (
                <View style={[styles.card, { backgroundColor: CARD_BG, marginTop: Spacing.md }]}>
                  <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>Move-In Timeline</ThemedText>
                  {moveInSorted.map(([month, count]) => (
                    <View key={month} style={styles.barRow}>
                      <ThemedText style={{ color: '#aaa', fontSize: 12, width: 90 }}>{month}</ThemedText>
                      <View style={styles.barContainer}>
                        <View style={[styles.bar, {
                          width: `${(count / (moveInSorted[0]?.[1] || 1)) * 100}%`,
                          backgroundColor: GREEN,
                        }]} />
                      </View>
                      <ThemedText style={{ color: '#666', fontSize: 12, width: 24, textAlign: 'right' }}>{count}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}

          <ThemedText type="h2" style={styles.sectionTitle}>Outreach Performance</ThemedText>
          <View style={styles.overviewGrid}>
            <OverviewCard icon="send" label="Sent (30d)" value={outreachThisMonth} />
            <OverviewCard icon="percent" label="Conv. Rate" value={`${outreachConversionRate}%`} color={GREEN} />
          </View>
          {outreachThisMonth === 0 ? (
            <ThemedText style={[styles.disclaimer, { marginTop: -8 }]}>
              No outreach sent in the last 30 days. Use proactive outreach to reach renter groups.
            </ThemedText>
          ) : null}

          <Pressable style={styles.exportBtn} onPress={handleExport}>
            <Feather name="download" size={16} color={ACCENT} style={{ marginRight: 8 }} />
            <ThemedText style={{ color: ACCENT, fontWeight: '600' }}>Export Inquiry Data (CSV)</ThemedText>
          </Pressable>
        </>
      ) : null}

      {showCompanyExtras ? (
        <>
          <View style={styles.advancedHeader}>
            <View style={[styles.advancedBadge, { backgroundColor: ACCENT2 }]}>
              <Feather name="briefcase" size={11} color="#fff" />
              <ThemedText style={styles.advancedBadgeText}>Company</ThemedText>
            </View>
            <ThemedText type="h2" style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, marginTop: 0 }]}>
              Portfolio Overview
            </ThemedText>
          </View>

          <View style={styles.overviewGrid}>
            <OverviewCard
              icon="home"
              label="Occupancy Rate"
              value={`${occupancyRate}%`}
              color={occupancyRate >= 80 ? GREEN : occupancyRate >= 60 ? AMBER : ACCENT}
            />
            <OverviewCard icon="dollar-sign" label="Projected Revenue" value={`$${projectedRevenue.toLocaleString()}/mo`} color={GREEN} />
          </View>

          <View style={[styles.card, { backgroundColor: CARD_BG, marginTop: Spacing.md }]}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>Unit Status Breakdown</ThemedText>
            {[
              { label: 'Occupied', count: occupiedListings, color: GREEN },
              { label: 'Vacant', count: activeListings, color: AMBER },
              { label: 'Paused', count: pausedListings, color: '#666' },
            ].map(({ label, count, color }) => (
              <View key={label} style={styles.barRow}>
                <ThemedText style={{ color: '#aaa', fontSize: 12, width: 70 }}>{label}</ThemedText>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, {
                    width: totalListings > 0 ? `${(count / totalListings) * 100}%` : '0%',
                    backgroundColor: color,
                  }]} />
                </View>
                <ThemedText style={{ color: '#666', fontSize: 12, width: 28, textAlign: 'right' }}>{count}</ThemedText>
              </View>
            ))}
          </View>

          {avgDaysToFill !== null ? (
            <View style={[styles.card, { backgroundColor: CARD_BG, flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md }]}>
              <View style={[styles.compatCircle, {
                borderColor: avgDaysToFill <= 14 ? GREEN : avgDaysToFill <= 30 ? AMBER : ACCENT,
              }]}>
                <ThemedText style={[styles.compatValue, {
                  color: avgDaysToFill <= 14 ? GREEN : avgDaysToFill <= 30 ? AMBER : ACCENT,
                  fontSize: 14,
                }]}>
                  {avgDaysToFill}d
                </ThemedText>
              </View>
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <ThemedText type="h3">Avg. Days to Fill</ThemedText>
                <ThemedText style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                  From listing creation to first accepted inquiry
                </ThemedText>
              </View>
            </View>
          ) : null}

          <ThemedText type="h2" style={styles.sectionTitle}>Portfolio Comparison</ThemedText>
          <View style={[styles.card, { backgroundColor: CARD_BG, padding: 0, overflow: 'hidden' }]}>
            <View style={[styles.tableRow, { borderBottomWidth: 1, borderBottomColor: '#2a2a2a' }]}>
              <ThemedText style={[styles.tableCell, styles.tableHeader, { flex: 2 }]}>Listing</ThemedText>
              <ThemedText style={[styles.tableCell, styles.tableHeader]}>Views</ThemedText>
              <ThemedText style={[styles.tableCell, styles.tableHeader]}>Inq.</ThemedText>
              <ThemedText style={[styles.tableCell, styles.tableHeader]}>Status</ThemedText>
            </View>
            {perListingInquiries.map(({ property, inquiryCount, viewCount }, idx) => (
              <View
                key={property.id}
                style={[
                  styles.tableRow,
                  idx < perListingInquiries.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
                ]}
              >
                <ThemedText style={[styles.tableCell, { flex: 2, color: '#ccc' }]} numberOfLines={1}>
                  {property.title}
                </ThemedText>
                <ThemedText style={[styles.tableCell, { color: ACCENT2 }]}>{viewCount}</ThemedText>
                <ThemedText style={[styles.tableCell, { color: ACCENT }]}>{inquiryCount}</ThemedText>
                <View style={[styles.tableCell as any, { alignItems: 'flex-start' }]}>
                  <View style={{ backgroundColor: getStatusColor(property) + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <ThemedText style={{ color: getStatusColor(property), fontSize: 10, fontWeight: '600' }}>
                      {getStatusLabel(property)}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={[styles.exportBtn, { borderColor: ACCENT2 + '44', marginTop: Spacing.md }]} onPress={handleCompanyExport}>
            <Feather name="file-text" size={16} color={ACCENT2} style={{ marginRight: 8 }} />
            <ThemedText style={{ color: ACCENT2, fontWeight: '600' }}>Export Portfolio Report (CSV)</ThemedText>
          </Pressable>
        </>
      ) : null}

      {showAgentExtras ? (
        <>
          <View style={styles.advancedHeader}>
            <View style={[styles.advancedBadge, { backgroundColor: '#9b59b6' }]}>
              <Feather name="award" size={11} color="#fff" />
              <ThemedText style={styles.advancedBadgeText}>Agent</ThemedText>
            </View>
            <ThemedText type="h2" style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, marginTop: 0 }]}>
              Agent Performance
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: CARD_BG, flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md }]}>
            <View style={[styles.compatCircle, { borderColor: responseColor }]}>
              <Feather name="clock" size={20} color={responseColor} />
            </View>
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <ThemedText type="h3">Avg. Response Time</ThemedText>
              <ThemedText style={{ color: responseColor, fontSize: 22, fontWeight: '700', marginTop: 2 }}>
                {responseLabel}
              </ThemedText>
              <ThemedText style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                {respondedCards.length > 0
                  ? `Based on ${respondedCards.length} responded inquiries`
                  : 'Respond to inquiries to track your response time'}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="h2" style={styles.sectionTitle}>Listing Scorecards</ThemedText>
          <ThemedText style={[styles.disclaimer, { marginBottom: Spacing.sm }]}>
            Health score based on view-to-inquiry rate, accept rate, and listing age.
          </ThemedText>
          {perListingInquiries.length === 0 ? (
            <View style={[styles.card, { backgroundColor: CARD_BG, alignItems: 'center', paddingVertical: Spacing.xl }]}>
              <Feather name="award" size={32} color="#444" />
              <ThemedText style={{ color: '#666', marginTop: 8, fontSize: 13 }}>Add listings to see scorecards</ThemedText>
            </View>
          ) : (
            perListingInquiries.map(({ property, inquiryCount, viewCount }) => {
              const accepted = inquiries.filter(i => i.propertyId === property.id && i.status === 'accepted').length;
              const daysListed = property.createdAt
                ? Math.round((Date.now() - new Date(property.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              const score = getListingHealthScore(viewCount, inquiryCount, accepted, daysListed);
              const scoreColor = score >= 70 ? GREEN : score >= 40 ? AMBER : ACCENT;

              return (
                <View key={property.id} style={[styles.card, { backgroundColor: CARD_BG, marginBottom: Spacing.sm }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="h3" numberOfLines={1}>{property.title}</ThemedText>
                      <ThemedText style={{ color: '#666', fontSize: 12 }}>
                        Listed {daysListed} day{daysListed !== 1 ? 's' : ''} ago · ${property.price}/mo
                      </ThemedText>
                    </View>
                    <View style={[styles.compatCircle, { borderColor: scoreColor, width: 52, height: 52, borderRadius: 26 }]}>
                      <ThemedText style={[styles.compatValue, { color: scoreColor, fontSize: 15 }]}>{score}</ThemedText>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View>
                      <ThemedText style={{ color: ACCENT2, fontWeight: '700' }}>{viewCount}</ThemedText>
                      <ThemedText style={{ color: '#666', fontSize: 11 }}>Views</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={{ color: ACCENT, fontWeight: '700' }}>{inquiryCount}</ThemedText>
                      <ThemedText style={{ color: '#666', fontSize: 11 }}>Inquiries</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={{ color: GREEN, fontWeight: '700' }}>{accepted}</ThemedText>
                      <ThemedText style={{ color: '#666', fontSize: 11 }}>Accepted</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={{ color: '#888', fontWeight: '700' }}>
                        {inquiryCount > 0 ? `${Math.round((accepted / inquiryCount) * 100)}%` : '\u2014'}
                      </ThemedText>
                      <ThemedText style={{ color: '#666', fontSize: 11 }}>Accept Rate</ThemedText>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <Pressable style={[styles.exportBtn, { borderColor: '#9b59b644', marginTop: Spacing.md }]} onPress={handleAgentExport}>
            <Feather name="file-text" size={16} color="#9b59b6" style={{ marginRight: 8 }} />
            <ThemedText style={{ color: '#9b59b6', fontWeight: '600' }}>Export Client Report (CSV)</ThemedText>
          </Pressable>
        </>
      ) : null}

      <View style={{ height: 40 }} />
    </ScreenScrollView>
  );
};

function getListingHealthScore(
  viewCount: number,
  inquiryCount: number,
  accepted: number,
  daysListed: number,
): number {
  const vtiRate = viewCount > 0 ? (inquiryCount / viewCount) : 0;
  const acceptRate = inquiryCount > 0 ? (accepted / inquiryCount) : 0;
  const recency = Math.max(0, 1 - daysListed / 90);
  const score = (vtiRate * 40) + (acceptRate * 40) + (recency * 20);
  return Math.min(100, Math.round(score * 100));
}

function OverviewCard({ icon, label, value, color }: { icon: any; label: string; value: number | string; color?: string }) {
  return (
    <View style={[styles.overviewCard, { backgroundColor: CARD_BG }]}>
      <Feather name={icon} size={20} color={color || ACCENT} />
      <ThemedText type="h2" style={{ marginTop: Spacing.sm, color: color || '#fff' }}>
        {value}
      </ThemedText>
      <ThemedText style={{ color: '#888', marginTop: 2, fontSize: 12 }}>{label}</ThemedText>
    </View>
  );
}

function StatusPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
      <ThemedText style={{ color, fontWeight: '700', fontSize: 14 }}>{value}</ThemedText>
      <ThemedText style={{ color: '#aaa', fontSize: 11, marginLeft: 4 }}>{label}</ThemedText>
    </View>
  );
}

function FunnelRow({
  label, value, maxValue, color, isEstimated,
}: {
  label: string; value: number; maxValue: number; color: string; isEstimated?: boolean;
}) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ThemedText style={{ color: '#aaa', fontSize: 13 }}>{label}</ThemedText>
          {isEstimated ? (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
              <ThemedText style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>EST</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{value.toLocaleString()}</ThemedText>
      </View>
      <View style={{ height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  overviewCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
  },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginLeft: Spacing.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  windowToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 2,
  },
  windowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  windowBtnActive: {
    backgroundColor: ACCENT,
  },
  windowBtnText: {
    fontSize: 12,
    color: '#888',
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  advancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  advancedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 6,
  },
  tagChipText: {
    color: '#ccc',
    fontSize: 12,
  },
  tagChipCount: {
    backgroundColor: '#444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagChipCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ACCENT + '44',
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    marginTop: 6,
  },
  compatCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compatValue: {
    fontWeight: '700',
    fontSize: 13,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: '#aaa',
  },
  tableHeader: {
    color: '#555',
    fontWeight: '600',
    fontSize: 11,
  },
});
