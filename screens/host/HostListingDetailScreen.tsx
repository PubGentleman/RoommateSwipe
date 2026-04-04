import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Image,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Property } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { getListing, mapListingToProperty, updateListing } from '../../services/listingService';
import { SUBWAY_LINE_COLORS } from '../../constants/transitData';
import SubwayLineBadge from '../../components/SubwayLineBadge';
import { getLinesForStop } from '../../utils/transitHelpers';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RouteParams = {
  HostListingDetail: { listingId: string };
};

export function HostListingDetailScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'HostListingDetail'>>();
  const insets = useSafeAreaInsets();

  const { listingId, propertyId } = route.params as any;
  const resolvedId = listingId || propertyId;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  const loadListing = useCallback(async () => {
    if (!resolvedId) { setLoading(false); return; }
    setLoading(true);
    let loaded = false;
    try {
      const raw = await getListing(resolvedId);
      if (raw) {
        const mapped = mapListingToProperty(raw);
        setProperty(mapped);
        loaded = true;
      }
    } catch (err) {
      console.warn('Supabase listing fetch failed, trying local:', err);
    }
    if (!loaded) {
      try {
        const properties = await StorageService.getProperties();
        const found = properties.find(p => p.id === resolvedId);
        if (found) {
          setProperty(found);
        }
      } catch {}
    }
    setLoading(false);
  }, [resolvedId]);

  useFocusEffect(
    useCallback(() => {
      loadListing();
    }, [loadListing])
  );

  const getStatusInfo = () => {
    if (!property) return { label: 'Unknown', color: '#6B7280' };
    if (property.isArchived) return { label: 'Archived', color: '#6B7280' };
    if (property.rentedDate && !property.available) return { label: 'Rented', color: '#F59E0B' };
    if (!property.available) return { label: 'Paused', color: '#F59E0B' };
    return { label: 'Active', color: '#22C55E' };
  };

  const handlePause = async () => {
    if (!property) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateListing(property.id, { is_paused: true, is_active: false });
    loadListing();
  };

  const handleActivate = async () => {
    if (!property) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateListing(property.id, { is_paused: false, is_active: true });
    loadListing();
  };

  const handleMarkRented = async () => {
    if (!property) return;
    const confirmed = await confirm({
      title: 'Mark as Rented',
      message: `Mark "${property.title}" as rented? It will be hidden from renters.`,
    });
    if (!confirmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const unlockAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await updateListing(property.id, { is_rented: true, is_active: false, outreach_unlocked_at: unlockAt });
    loadListing();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Feather name="alert-circle" size={40} color={theme.textSecondary} />
        <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 12 }}>Listing not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#ff6b5b', fontSize: 14, fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const photos = property.photos?.length > 0 ? property.photos : [];
  const status = getStatusInfo();

  const transitStops = property.transitInfo?.stops || [];
  const transitOverride = property.transitInfo?.manualOverride;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoSection}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setPhotoIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {photos.map((photo, i) => (
                <Image key={i} source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Feather name="camera" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginTop: 8 }}>No photos yet</Text>
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={styles.topGradient}
          />

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <View style={[styles.statusPill, { backgroundColor: status.color + '30' }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {photos.length > 1 ? (
            <View style={styles.photoDots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex ? styles.dotActive : null]} />
              ))}
            </View>
          ) : null}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.priceGradient}
          >
            <Text style={styles.priceText}>
              ${property.price?.toLocaleString()}<Text style={styles.pricePeriod}>/mo</Text>
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={[styles.title, { color: theme.text }]}>{property.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Feather name="map-pin" size={13} color="#ff6b5b" />
            <Text style={[styles.location, { color: theme.textSecondary }]}>
              {property.neighborhood ? `${property.neighborhood}, ` : ''}{property.city}, {property.state}
              {property.zipCode ? ` ${property.zipCode}` : ''}
            </Text>
          </View>
          {property.address ? (
            <Text style={[styles.address, { color: theme.textSecondary }]}>
              {property.address}
            </Text>
          ) : null}
        </View>

        <View style={[styles.statsStrip, { borderColor: theme.border }]}>
          <View style={styles.stat}>
            <Feather name="home" size={16} color="#ff6b5b" />
            <Text style={[styles.statValue, { color: theme.text }]}>{property.bedrooms}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Beds</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Feather name="droplet" size={16} color="#ff6b5b" />
            <Text style={[styles.statValue, { color: theme.text }]}>{property.bathrooms}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Baths</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Feather name="maximize" size={16} color="#ff6b5b" />
            <Text style={[styles.statValue, { color: theme.text }]}>{property.sqft ? property.sqft.toLocaleString() : '\u2014'}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sqft</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Feather name={property.roomType === 'entire' ? 'key' : 'user'} size={16} color="#ff6b5b" />
            <Text style={[styles.statValue, { color: theme.text, fontSize: 12 }]}>
              {property.roomType === 'entire' ? 'Entire' : 'Room'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Type</Text>
          </View>
        </View>

        {property.description ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>About this listing</Text>
            <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
              {property.description}
            </Text>
          </View>
        ) : null}

        {property.amenities && property.amenities.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {property.amenities.slice(0, 12).map((amenity, i) => (
                <View key={i} style={[styles.amenityChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Feather name="check" size={12} color="#22C55E" />
                  <Text style={[styles.amenityText, { color: theme.text }]}>{amenity}</Text>
                </View>
              ))}
              {property.amenities.length > 12 ? (
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>
                  +{property.amenities.length - 12} more
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {(transitStops.length > 0 || transitOverride) ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Nearby Transit</Text>
            {transitStops.length > 0 ? (
              <View style={{ gap: 10 }}>
                {transitStops.slice(0, 6).map((stop: any, i: number) => {
                  const lines = getLinesForStop(stop);
                  const walkMin = stop.walkMinutes || Math.max(1, Math.round((stop.distanceMiles || stop.distanceMi || 0) * 20));
                  const distanceVal = stop.distanceMiles || stop.distanceMi || 0;
                  const cleanName = stop.name
                    .replace(/\s*subway\s*station\s*/i, '')
                    .replace(/\s*station\s*/i, ' ')
                    .replace(/\s*\([^)]*\)\s*/g, '')
                    .replace(/\s+line$/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                  const isSubway = stop.type === 'subway' || stop.type === 'Subway';
                  const isBus = stop.type === 'bus' || stop.type === 'Bus Stop';
                  const isTrain = stop.type === 'train' || stop.type === 'Train Station';
                  return (
                    <View key={`transit-${i}`} style={styles.transitCard}>
                      <View style={[styles.transitIcon, {
                        backgroundColor: isSubway ? 'rgba(0,57,166,0.08)' : isBus ? 'rgba(255,99,25,0.08)' : isTrain ? 'rgba(0,147,60,0.08)' : 'rgba(128,129,131,0.08)',
                      }]}>
                        <Feather
                          name={isSubway ? 'navigation' : isBus ? 'truck' : isTrain ? 'navigation' : 'map-pin'}
                          size={14}
                          color={isSubway ? '#5b8cff' : isBus ? '#FF6319' : isTrain ? '#00933C' : '#808183'}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.transitName} numberOfLines={1}>{cleanName || stop.name}</Text>
                        <Text style={styles.transitMeta}>
                          {walkMin} min walk{distanceVal > 0 ? ` · ${distanceVal.toFixed(2)} mi` : ''}
                        </Text>
                      </View>
                      {lines.length > 0 ? (
                        <View style={styles.transitLines}>
                          {lines.slice(0, 6).map((line: string) => (
                            <SubwayLineBadge key={line} line={line} size="md" />
                          ))}
                          {lines.length > 6 ? (
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, alignSelf: 'center' }}>+{lines.length - 6}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {transitOverride ? (
              <Text style={[styles.descriptionText, { color: theme.textSecondary, marginTop: transitStops.length > 0 ? 8 : 0, lineHeight: 18 }]}>{transitOverride}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Details</Text>
          <View style={{ gap: 8 }}>
            <DetailRow icon="file-text" label="Listing Type" value={property.propertyType === 'sublet' ? 'Sublet' : 'Lease'} theme={theme} />
            {property.securityDeposit ? (
              <DetailRow icon="dollar-sign" label="Security Deposit" value={`$${property.securityDeposit.toLocaleString()}`} theme={theme} />
            ) : null}
            {property.availableDate ? (
              <DetailRow icon="calendar" label="Available Date" value={new Date(property.availableDate).toLocaleDateString()} theme={theme} />
            ) : null}
            {property.hostLivesIn !== undefined ? (
              <DetailRow icon="home" label="Host Lives In Unit" value={property.hostLivesIn ? 'Yes' : 'No'} theme={theme} />
            ) : null}
            {(property.existingRoommatesCount ?? 0) > 0 ? (
              <DetailRow icon="users" label="Existing Roommates" value={String(property.existingRoommatesCount)} theme={theme} />
            ) : null}
            {property.requiresBackgroundCheck ? (
              <DetailRow icon="shield" label="Background Check" value="Required" theme={theme} />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="star" size={16} color={property.average_rating ? '#FFD700' : theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
              {property.average_rating
                ? `${property.average_rating.toFixed(1)} · ${property.review_count || 0} reviews`
                : 'No reviews yet'}
            </Text>
          </View>
        </View>

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate('CreateEditListing', { propertyId: property.id })}
        >
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editBtnGrad}
          >
            <Feather name="edit-2" size={16} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Edit Listing</Text>
          </LinearGradient>
        </Pressable>

        {property.available && !property.isArchived ? (
          <Pressable style={[styles.quickAction, { borderColor: theme.border }]} onPress={handlePause}>
            <Feather name="pause" size={16} color="#F59E0B" />
          </Pressable>
        ) : !property.available && !property.isArchived && !property.rentedDate ? (
          <Pressable style={[styles.quickAction, { borderColor: theme.border }]} onPress={handleActivate}>
            <Feather name="play" size={16} color="#22C55E" />
          </Pressable>
        ) : null}

        {property.available ? (
          <Pressable style={[styles.quickAction, { borderColor: theme.border }]} onPress={handleMarkRented}>
            <Feather name="check-circle" size={16} color="#3B82F6" />
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.quickAction, { borderColor: theme.border }]}
          onPress={() => navigation.navigate('ListingBoost', { listingId: property.id })}
        >
          <Feather name="zap" size={16} color="#a855f7" />
        </Pressable>
      </View>
    </View>
  );
}

const DetailRow = ({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Feather name={icon as any} size={14} color={theme.textSecondary} />
    <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>{label}</Text>
    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },

  photoSection: { position: 'relative' },
  photo: { width: SCREEN_WIDTH, height: 300 },
  photoPlaceholder: { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  photoDots: {
    position: 'absolute', bottom: 50,
    flexDirection: 'row', alignSelf: 'center', gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  priceGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 60, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 12,
  },
  priceText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  pricePeriod: { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },

  section: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700' },
  location: { fontSize: 14 },
  address: { fontSize: 13, marginTop: 4 },
  descriptionText: { fontSize: 14, lineHeight: 22 },

  statsStrip: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 16, marginHorizontal: 20, marginTop: 4,
    borderRadius: 14, borderWidth: 1,
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 30 },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  amenityText: { fontSize: 12, fontWeight: '500' },

  transitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  transitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  transitMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  transitLines: {
    flexDirection: 'row',
    gap: 3,
    flexWrap: 'wrap',
    maxWidth: 130,
    justifyContent: 'flex-end',
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1,
  },
  editBtn: { flex: 1 },
  editBtnGrad: {
    height: 48, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  quickAction: {
    width: 48, height: 48, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
});
