import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '../../components/VectorIcons';
import { supabase } from '../../lib/supabase';
import { Property, User } from '../../types/models';
import { mapListingToProperty } from '../../services/listingService';
import { getHostReviewSummary, getHostReviews, HostReview, ReviewSummary } from '../../services/reviewService';
import { HostReviewsScreen } from '../shared/HostReviewsScreen';

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const SURFACE = '#1a1a1a';
const ACCENT = '#f59e0b';

type HostPublicProfileParams = {
  hostId: string;
  hostName: string;
  hostType: 'individual' | 'agent' | 'company';
};

type RouteType = RouteProp<{ HostPublicProfile: HostPublicProfileParams }, 'HostPublicProfile'>;

const AVATAR_GRADIENTS: [string, string][] = [
  ['#4a9eff', '#1e6fd4'],
  ['#e83a7a', '#9b1fad'],
  ['#ff6b5b', '#e83a2a'],
  ['#2ecc71', '#1aa355'],
  ['#ffd700', '#ff9500'],
  ['#9b59b6', '#6c3483'],
];

const getAvatarGradient = (id: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const formatMemberSince = (dateStr: string) => {
  const d = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `Member since ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const HostPublicProfileScreen = () => {
  const route = useRoute<RouteType>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { hostId, hostName, hostType } = route.params;

  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<Property[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [recentReviews, setRecentReviews] = useState<HostReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, profilesRes, listingsRes, summary, reviews] = await Promise.all([
        supabase.from('users').select('*').eq('id', hostId).single(),
        supabase.from('profiles').select('*').eq('user_id', hostId).single(),
        supabase.from('listings')
          .select('*')
          .or(`created_by.eq.${hostId},assigned_agent_id.eq.${hostId}`)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20),
        getHostReviewSummary(hostId),
        getHostReviews(hostId),
      ]);

      const merged = { ...(profilesRes.data || {}), ...(usersRes.data || {}) };
      if (usersRes.data || profilesRes.data) setProfile(merged);
      if (listingsRes.data) {
        setListings(listingsRes.data.map((l: any) => mapListingToProperty(l)));
      }
      setReviewSummary(summary);
      setRecentReviews(reviews.slice(0, 3));
    } catch (err) {
      console.error('Error fetching host profile:', err);
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayName = hostType === 'company'
    ? (profile?.company_name || profile?.name || hostName)
    : hostType === 'individual'
      ? (profile?.name?.split(' ')[0] || hostName.split(' ')[0])
      : (profile?.name || hostName);

  const profilePhoto = profile?.avatar_url || profile?.profile_image_url || profile?.profile_picture;
  const companyLogo = profile?.company_logo_url;
  const avatarImage = hostType === 'company' ? (companyLogo || profilePhoto) : profilePhoto;
  const avatarGradient = getAvatarGradient(hostId);
  const initials = getInitials(displayName);

  const badgeText = hostType === 'company'
    ? 'Property Management'
    : hostType === 'agent'
      ? 'Licensed Agent'
      : 'Host';

  const badgeColor = hostType === 'company' ? '#3b82f6' : hostType === 'agent' ? '#f59e0b' : '#22c55e';

  const infoRows: { icon: string; label: string; value: string; onPress?: () => void }[] = [];

  if (profile?.license_number) {
    const licenseVal = profile.license_state
      ? `${profile.license_number} (${profile.license_state})`
      : profile.license_number;
    infoRows.push({ icon: 'file-text', label: 'License #', value: licenseVal });
  }
  if (profile?.brokerage_name) {
    infoRows.push({ icon: 'home', label: 'Brokerage', value: profile.brokerage_name });
  }
  if (hostType === 'agent' && profile?.agency_name) {
    infoRows.push({ icon: 'briefcase', label: 'Agency', value: profile.agency_name });
  }
  if (hostType !== 'individual' && profile?.phone) {
    infoRows.push({
      icon: 'phone',
      label: 'Phone',
      value: profile.phone,
      onPress: () => Linking.openURL(`tel:${profile.phone}`),
    });
  }
  if (profile?.units_managed && profile.units_managed > 1) {
    infoRows.push({ icon: 'grid', label: 'Units Managed', value: `${profile.units_managed}` });
  }
  if (profile?.created_at) {
    infoRows.push({ icon: 'calendar', label: 'Joined', value: formatMemberSince(profile.created_at) });
  }

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Feather
          key={i}
          name="star"
          size={14}
          color={i <= Math.round(rating) ? '#a78bfa' : 'rgba(255,255,255,0.15)'}
        />
      );
    }
    return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
  };

  const navigateToListing = (listingId: string) => {
    (navigation as any).navigate('ExploreMain', { viewListingId: listingId });
  };

  if (loading) {
    return (
      <View style={[profileStyles.container, { paddingTop: insets.top }]}>
        <View style={profileStyles.header}>
          <Pressable onPress={() => navigation.goBack()} style={profileStyles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={profileStyles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={profileStyles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[profileStyles.container, { paddingTop: insets.top }]}>
      <View style={profileStyles.header}>
        <Pressable onPress={() => navigation.goBack()} style={profileStyles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={profileStyles.headerTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={profileStyles.profileSection}>
          {avatarImage ? (
            <Image source={{ uri: avatarImage }} style={profileStyles.avatar} />
          ) : (
            <LinearGradient colors={avatarGradient} style={profileStyles.avatar}>
              <Text style={profileStyles.avatarText}>{initials}</Text>
            </LinearGradient>
          )}
          <Text style={profileStyles.displayName}>{displayName}</Text>
          <View style={[profileStyles.typeBadge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
            <Feather
              name={hostType === 'company' ? 'briefcase' : hostType === 'agent' ? 'award' : 'user'}
              size={12}
              color={badgeColor}
            />
            <Text style={[profileStyles.typeBadgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
          {hostType !== 'individual' && profile?.license_verified ? (
            <View style={profileStyles.verifiedRow}>
              <Feather name="check-circle" size={14} color="#22c55e" />
              <Text style={profileStyles.verifiedText}>Verified</Text>
            </View>
          ) : null}
          {hostType === 'individual' && profile?.created_at ? (
            <Text style={profileStyles.memberSince}>{formatMemberSince(profile.created_at)}</Text>
          ) : null}
          {reviewSummary && reviewSummary.reviewCount > 0 ? (
            <View style={profileStyles.ratingRow}>
              {renderStars(reviewSummary.averageRating || 0)}
              <Text style={profileStyles.ratingText}>
                {(reviewSummary.averageRating || 0).toFixed(1)} ({reviewSummary.reviewCount} review{reviewSummary.reviewCount !== 1 ? 's' : ''})
              </Text>
            </View>
          ) : null}
        </View>

        {(profile?.bio || profile?.profile_data?.bio) ? (
          <View style={profileStyles.card}>
            <Text style={profileStyles.cardTitle}>About</Text>
            <Text style={profileStyles.bioText}>{profile.bio || profile.profile_data?.bio}</Text>
          </View>
        ) : null}

        {infoRows.length > 0 && hostType !== 'individual' ? (
          <View style={profileStyles.card}>
            <Text style={profileStyles.cardTitle}>Professional Info</Text>
            {infoRows.map((row, idx) => (
              <Pressable
                key={idx}
                style={profileStyles.infoRow}
                onPress={row.onPress}
                disabled={!row.onPress}
              >
                <Feather name={row.icon as any} size={15} color="rgba(255,255,255,0.5)" />
                <Text style={profileStyles.infoLabel}>{row.label}</Text>
                <Text style={[profileStyles.infoValue, row.onPress ? { color: '#3b82f6' } : null]} numberOfLines={1}>
                  {row.value}
                </Text>
                {row.onPress ? <Feather name="external-link" size={12} color="#3b82f6" /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={profileStyles.card}>
          <View style={profileStyles.sectionHeader}>
            <Text style={profileStyles.cardTitle}>Listings by {displayName}</Text>
            <View style={profileStyles.countBadge}>
              <Text style={profileStyles.countBadgeText}>{listings.length}</Text>
            </View>
          </View>
          {listings.length === 0 ? (
            <View style={profileStyles.emptyState}>
              <Feather name="home" size={32} color="rgba(255,255,255,0.2)" />
              <Text style={profileStyles.emptyText}>No active listings</Text>
            </View>
          ) : (
            listings.map((listing) => (
              <Pressable
                key={listing.id}
                style={profileStyles.listingCard}
                onPress={() => navigateToListing(listing.id)}
              >
                <Image
                  source={{ uri: listing.photos?.[0] || '' }}
                  style={profileStyles.listingPhoto}
                />
                <View style={profileStyles.listingInfo}>
                  <Text style={profileStyles.listingAddress} numberOfLines={1}>
                    {listing.address || listing.neighborhood || 'Listing'}
                  </Text>
                  <Text style={profileStyles.listingPrice}>
                    ${listing.rent?.toLocaleString()}/mo
                  </Text>
                  <View style={profileStyles.listingMeta}>
                    <Text style={profileStyles.listingMetaText}>
                      {listing.bedrooms} bed{listing.bedrooms !== 1 ? 's' : ''}
                    </Text>
                    <Text style={profileStyles.listingMetaDot}>{'\u00B7'}</Text>
                    <Text style={profileStyles.listingMetaText}>
                      {listing.bathrooms} bath{listing.bathrooms !== 1 ? 's' : ''}
                    </Text>
                    <Text style={profileStyles.listingMetaDot}>{'\u00B7'}</Text>
                    <Text style={profileStyles.listingMetaText}>
                      {listing.roomType === 'entire' ? 'Entire' : 'Room'}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ))
          )}
        </View>

        {reviewSummary && reviewSummary.reviewCount > 0 ? (
          <View style={profileStyles.card}>
            <View style={profileStyles.sectionHeader}>
              <Text style={profileStyles.cardTitle}>Reviews</Text>
              <View style={profileStyles.countBadge}>
                <Text style={profileStyles.countBadgeText}>{reviewSummary.reviewCount}</Text>
              </View>
            </View>
            <View style={profileStyles.reviewSummaryRow}>
              {renderStars(reviewSummary.averageRating || 0)}
              <Text style={profileStyles.reviewAvgText}>
                {(reviewSummary.averageRating || 0).toFixed(1)} out of 5
              </Text>
            </View>
            {recentReviews.map((review) => (
              <View key={review.id} style={profileStyles.reviewItem}>
                <View style={profileStyles.reviewHeader}>
                  <Text style={profileStyles.reviewerName}>
                    {review.reviewer_name || 'Anonymous'}
                  </Text>
                  {renderStars(review.rating)}
                </View>
                {review.review_text ? (
                  <Text style={profileStyles.reviewText} numberOfLines={3}>
                    {review.review_text}
                  </Text>
                ) : null}
                <Text style={profileStyles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            ))}
            {reviewSummary.reviewCount > 3 ? (
              <Pressable
                style={profileStyles.seeAllBtn}
                onPress={() => setShowAllReviews(true)}
              >
                <Text style={profileStyles.seeAllText}>See All Reviews</Text>
                <Feather name="chevron-right" size={14} color="#a78bfa" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {showAllReviews ? (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAllReviews(false)}>
          <HostReviewsScreen
            hostId={hostId}
            hostName={displayName}
            onClose={() => setShowAllReviews(false)}
          />
        </Modal>
      ) : null}
    </View>
  );
};

const profileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  memberSince: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#a78bfa',
    fontWeight: '600',
  },
  card: {
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  infoLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    width: 90,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listingPhoto: {
    width: 64,
    height: 48,
    borderRadius: 8,
    backgroundColor: SURFACE,
  },
  listingInfo: {
    flex: 1,
  },
  listingAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6b5b',
    marginBottom: 2,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  listingMetaDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  reviewSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  reviewAvgText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  reviewText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a78bfa',
  },
});
