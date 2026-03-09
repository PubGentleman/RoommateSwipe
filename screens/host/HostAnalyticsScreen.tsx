import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { StorageService } from '../../utils/storage';
import { Property, InterestCard } from '../../types/models';
import { Spacing, BorderRadius } from '../../constants/theme';

const ACCENT = '#ff6b5b';
const CARD_BG = '#1a1a1a';
const BG = '#111';

// PAYWALL MISSING: Analytics screen is not gated by host plan — Starter users can see full analytics including conversion funnel, inquiry counts, and accept rate. Starter should only see view counts. (Host Starter/Pro)
// MISSING FEATURE: Advanced analytics differentiation for Business tier — no additional metrics beyond what Pro sees (Host Business)
export const HostAnalyticsScreen = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<InterestCard[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user?.id])
  );

  const loadData = async () => {
    if (!user) return;
    await StorageService.assignPropertiesToHost(user.id, user.name);
    const allProperties = await StorageService.getProperties();
    const hostProperties = allProperties.filter(p => p.hostId === user.id);
    setProperties(hostProperties);

    const hostInquiries = await StorageService.getInterestCardsForHost(user.id);
    setInquiries(hostInquiries);
  };

  const totalListings = properties.length;
  const activeListings = properties.filter(p => p.available && !p.rentedDate).length;
  const rentedListings = properties.filter(p => !!p.rentedDate).length;
  const pausedListings = properties.filter(p => !p.available && !p.rentedDate).length;

  const totalInquiries = inquiries.length;
  const pendingInquiries = inquiries.filter(i => i.status === 'pending').length;
  const acceptedInquiries = inquiries.filter(i => i.status === 'accepted').length;
  const passedInquiries = inquiries.filter(i => i.status === 'passed').length;
  const acceptRate = totalInquiries > 0 ? Math.round((acceptedInquiries / totalInquiries) * 100) : 0;

  const estimatedViews = totalInquiries * 15;
  const estimatedSaves = totalInquiries * 8;

  const perListingInquiries = properties.map(p => {
    const count = inquiries.filter(i => i.propertyId === p.id).length;
    return { property: p, inquiryCount: count };
  });
  const maxInquiryCount = Math.max(...perListingInquiries.map(p => p.inquiryCount), 1);

  const getStatusLabel = (p: Property) => {
    if (p.rentedDate) return 'Rented';
    if (!p.available) return 'Paused';
    return 'Active';
  };

  const getStatusColor = (p: Property) => {
    if (p.rentedDate) return '#5B7FFF';
    if (!p.available) return '#FFA500';
    return '#3ECF8E';
  };

  return (
    <ScreenScrollView style={{ backgroundColor: BG }}>
      <ThemedText type="h2" style={styles.sectionTitle}>Overview</ThemedText>
      <View style={styles.overviewGrid}>
        <OverviewCard icon="home" label="Total Listings" value={totalListings} />
        <OverviewCard icon="check-circle" label="Active" value={activeListings} color="#3ECF8E" />
        <OverviewCard icon="heart" label="Inquiries" value={totalInquiries} />
        <OverviewCard icon="trending-up" label="Accept Rate" value={`${acceptRate}%`} color={ACCENT} />
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="Pending" value={pendingInquiries} color="#FFA500" />
        <StatusPill label="Accepted" value={acceptedInquiries} color="#3ECF8E" />
        <StatusPill label="Passed" value={passedInquiries} color="#FF4757" />
        <StatusPill label="Rented" value={rentedListings} color="#5B7FFF" />
        <StatusPill label="Paused" value={pausedListings} color="#FFA500" />
      </View>

      <ThemedText type="h2" style={styles.sectionTitle}>Conversion Funnel</ThemedText>
      <View style={[styles.card, { backgroundColor: CARD_BG }]}>
        <FunnelRow label="Estimated Views" value={estimatedViews} maxValue={estimatedViews} color="#5B7FFF" />
        <FunnelRow label="Estimated Saves" value={estimatedSaves} maxValue={estimatedViews} color="#FFA500" />
        <FunnelRow label="Inquiries" value={totalInquiries} maxValue={estimatedViews} color={ACCENT} />
        <FunnelRow label="Accepted" value={acceptedInquiries} maxValue={estimatedViews} color="#3ECF8E" />
      </View>

      <ThemedText type="h2" style={styles.sectionTitle}>Per-Listing Breakdown</ThemedText>
      {perListingInquiries.length === 0 ? (
        <View style={[styles.card, { backgroundColor: CARD_BG, alignItems: 'center', paddingVertical: Spacing.xxl }]}>
          <Feather name="bar-chart-2" size={40} color="#666" />
          <ThemedText style={{ color: '#888', marginTop: Spacing.md }}>No listings yet</ThemedText>
        </View>
      ) : (
        perListingInquiries.map(({ property, inquiryCount }) => (
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
            <View style={styles.barRow}>
              <ThemedText style={{ color: '#aaa', width: 80 }}>{inquiryCount} inquiries</ThemedText>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.max((inquiryCount / maxInquiryCount) * 100, inquiryCount > 0 ? 8 : 0)}%`,
                      backgroundColor: ACCENT,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))
      )}

      <ThemedText type="h2" style={styles.sectionTitle}>Monthly Trend</ThemedText>
      <View style={[styles.card, { backgroundColor: CARD_BG }]}>
        <View style={styles.trendRow}>
          <Feather name="trending-up" size={24} color="#3ECF8E" />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="h3">
              {totalInquiries > 0 ? 'Trending Up' : 'Getting Started'}
            </ThemedText>
            <ThemedText style={{ color: '#888', marginTop: Spacing.xs }}>
              {totalInquiries > 0
                ? `You have ${totalInquiries} inquir${totalInquiries !== 1 ? 'ies' : 'y'} across ${totalListings} listing${totalListings !== 1 ? 's' : ''}. ${acceptRate}% accept rate.`
                : 'Add listings to start receiving inquiries and tracking performance.'}
            </ThemedText>
          </View>
        </View>
      </View>
    </ScreenScrollView>
  );
};

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

function FunnelRow({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 5 : 0) : 0;
  return (
    <View style={styles.funnelRow}>
      <View style={styles.funnelLabel}>
        <ThemedText style={{ color: '#ccc', fontSize: 13 }}>{label}</ThemedText>
        <ThemedText style={{ color, fontWeight: '700', fontSize: 13 }}>{value}</ThemedText>
      </View>
      <View style={styles.barContainer}>
        <View style={[styles.bar, { width: `${width}%`, backgroundColor: color }]} />
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
  funnelRow: {
    marginBottom: Spacing.md,
  },
  funnelLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
