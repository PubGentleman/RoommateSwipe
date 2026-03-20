import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Image, Alert, Platform } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { PaywallSheet } from '../../components/PaywallSheet';
import { StorageService } from '../../utils/storage';
import { Property, InterestCard, HostSubscriptionData } from '../../types/models';
import { getMyListings, mapListingToProperty, updateListing, deleteListing as deleteListingSupa } from '../../services/listingService';
import { getReceivedInterestCards } from '../../services/discoverService';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';
import { isListingBoosted, canAddListingCheck, isFreePlan } from '../../utils/hostPricing';
import { ListingLimitModal, OverageModal } from '../../components/ListingLimitModal';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const GOLD = '#ffd700';
const BLUE = '#5b8cff';
const ORANGE = '#ffa500';

type FilterStatus = 'all' | 'active' | 'paused' | 'rented';

const AVATAR_GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#11998e', '#38ef7d'],
  ['#fc4a1a', '#f7b733'],
  ['#4facfe', '#00f2fe'],
  ['#a18cd1', '#fbc2eb'],
];

const getListingStatus = (listing: Property): 'active' | 'paused' | 'rented' => {
  if (listing.rentedDate && !listing.available) return 'rented';
  if (!listing.available) return 'paused';
  return 'active';
};

const getStatusColor = (status: string) => {
  if (status === 'active') return GREEN;
  if (status === 'paused') return ORANGE;
  return BLUE;
};

const getStatusLabel = (status: string) => {
  if (status === 'active') return 'Active';
  if (status === 'paused') return 'Paused';
  return 'Rented';
};

function getGradient(name: string): [string, string] {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function formatListedAgo(listing: Property): string {
  if (!listing.availableDate) return '';
  const diff = Date.now() - new Date(listing.availableDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Listed today';
  if (days === 1) return 'Listed 1d ago';
  return `Listed ${days}d ago`;
}

export const MyListingsScreen = () => {
  const { user, getHostPlan } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [listings, setListings] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<InterestCard[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showHostPaywall, setShowHostPaywall] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [overageMessage, setOverageMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const supaListings = await getMyListings();
      if (supaListings && supaListings.length > 0) {
        const mapped: Property[] = supaListings.map((l: any) => mapListingToProperty(l, user.name));
        setListings(mapped);
      } else {
        const allProperties = await StorageService.getProperties();
        const myListings = allProperties.filter(p => p.hostId === user.id);
        if (myListings.length > 0) {
          setListings(myListings);
        } else {
          await StorageService.assignPropertiesToHost(user.id, user.name);
          const refreshed = await StorageService.getProperties();
          setListings(refreshed.filter(p => p.hostId === user.id));
        }
      }
    } catch {
      const allProperties = await StorageService.getProperties();
      const myListings = allProperties.filter(p => p.hostId === user.id);
      setListings(myListings);
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

    const sub = await StorageService.getHostSubscription(user.id);
    setHostSub(sub);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredListings = listings.filter(listing => {
    if (filter === 'all') return true;
    return getListingStatus(listing) === filter;
  });

  const activeCount = listings.filter(p => getListingStatus(p) === 'active').length;
  const pausedCount = listings.filter(p => getListingStatus(p) === 'paused').length;
  const rentedCount = listings.filter(p => getListingStatus(p) === 'rented').length;

  const getInquiriesForListing = (propertyId: string) =>
    inquiries.filter(c => c.propertyId === propertyId);

  const pauseListing = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = listings.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;
    try {
      await updateListing(propertyId, { is_paused: true, is_active: true });
    } catch {
      const updated = { ...property, available: false, rentedDate: undefined };
      await StorageService.addOrUpdateProperty(updated);
    }
    await StorageService.notifyPropertyEvent(
      propertyId,
      'property_update',
      'Listing Paused',
      `${property.title} has been temporarily paused by the host`,
    );
    await loadData();
  };

  const markAsRented = async (propertyId: string) => {
    if (!user) return;
    const confirmRent = () => {
      return new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('Mark this listing as rented? A 48-hour cooldown will begin before you can message interested groups.'));
        } else {
          Alert.alert(
            'Mark as Rented',
            'A 48-hour cooldown will begin before you can message interested groups.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Mark Rented', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        }
      });
    };
    const confirmed = await confirmRent();
    if (!confirmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const unlockAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await updateListing(propertyId, { is_rented: true, is_active: false, outreach_unlocked_at: unlockAt });
    } catch {
      await StorageService.markPropertyAsRented(propertyId);
    }
    await loadData();
  };

  const markAsAvailable = async (propertyId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateListing(propertyId, { is_rented: false, is_paused: false, is_active: true });
    } catch {
      await StorageService.markPropertyAsAvailable(propertyId);
    }
    await loadData();
  };

  const executeDeleteListing = async (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const property = listings.find(p => p.id === propertyId);
    try {
      await deleteListingSupa(propertyId);
    } catch {
    }
    if (property) {
      await StorageService.notifyPropertyEvent(
        propertyId,
        'property_update',
        'Listing Removed',
        `${property.title} is no longer available`,
      );
    }
    await StorageService.deleteProperty(propertyId);
    await loadData();
  };

  const deleteListingHandler = (propertyId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this listing? This action cannot be undone.');
      if (confirmed) {
        executeDeleteListing(propertyId);
      }
      return;
    }
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeDeleteListing(propertyId),
        },
      ]
    );
  };

  const toggleFeatured = async (propertyId: string) => {
    if (!user) return;
    const hostPlan = (user as any).hostPlan || 'starter';
    if (hostPlan !== 'business') {
      Alert.alert(
        'Business Plan Required',
        'Featured listings are available exclusively for Business hosts. Upgrade your plan to feature your listings.',
        [{ text: 'OK' }]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const property = listings.find(p => p.id === propertyId);
    if (!property || property.hostId !== user.id) return;
    const updated = { ...property, featured: !property.featured };
    try {
      await updateListing(propertyId, { is_featured: !property.featured });
    } catch {
      await StorageService.addOrUpdateProperty(updated);
    }
    setListings(prev => prev.map(p => p.id === propertyId ? updated : p));
  };

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: listings.length },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'paused', label: 'Paused', count: pausedCount },
    { key: 'rented', label: 'Rented', count: rentedCount },
  ];

  const renderListingCard = (listing: Property) => {
    const status = getListingStatus(listing);
    const statusColor = getStatusColor(status);
    const listingInquiries = getInquiriesForListing(listing.id);
    const pendingInquiries = listingInquiries.filter(c => c.status === 'pending');
    const viewsHash = listing.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const views = (viewsHash % 180) + 10;
    const rate = listingInquiries.length > 0 ? ((listingInquiries.length / views) * 100).toFixed(1) : '0.0';

    return (
      <View key={listing.id} style={styles.card}>
        <Pressable
          style={styles.cardPhoto}
          onPress={() => navigation.navigate('CreateEditListing', { propertyId: listing.id })}
        >
          {listing.photos && listing.photos.length > 0 ? (
            <Image source={{ uri: listing.photos[0] }} style={styles.photoImage} />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.photoGradient}
          />
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>{getStatusLabel(status)}</Text>
          </View>
          <View style={styles.priceOnPhoto}>
            <Text style={styles.priceText}>
              ${listing.price?.toLocaleString()}<Text style={styles.pricePeriod}>/mo</Text>
            </Text>
          </View>
          {listing.featured ? (
            <View style={styles.boostBadge}>
              <Feather name="star" size={10} color={GOLD} />
              <Text style={styles.boostBadgeText}>Featured</Text>
            </View>
          ) : null}
          {isListingBoosted(listing) ? (
            <View style={[
              styles.boostedPill,
              listing.listingBoost?.includesFeaturedBadge
                ? { backgroundColor: 'rgba(123,94,167,0.3)', borderColor: 'rgba(123,94,167,0.5)' }
                : null,
            ]}>
              <Feather
                name={listing.listingBoost?.includesFeaturedBadge ? 'star' : 'zap'}
                size={10}
                color={listing.listingBoost?.includesFeaturedBadge ? '#ffd700' : '#a855f7'}
              />
              <Text style={[
                styles.boostedPillText,
                listing.listingBoost?.includesFeaturedBadge ? { color: '#ffd700' } : null,
              ]}>
                {listing.listingBoost?.includesFeaturedBadge ? 'Featured' : 'Boosted'}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.cardBody}>
          <Pressable onPress={() => navigation.navigate('CreateEditListing', { propertyId: listing.id })}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
              {user?.purchases?.hostVerificationBadge === true ? (
                <View style={styles.verifiedBadge}>
                  <Feather name="shield" size={11} color="#3ECF8E" />
                  <Text style={styles.verifiedBadgeText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardLocation}>
              <Feather name="map-pin" size={12} color={ACCENT} />
              <Text style={styles.cardLocationText} numberOfLines={1}>
                {listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city}
                {listing.bedrooms || listing.bathrooms ? ` · ${listing.bedrooms} bd ${listing.bathrooms} ba` : ''}
              </Text>
            </View>
          </Pressable>

          {listingInquiries.length > 0 ? (
            <Pressable
              style={styles.inquiryRow}
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('Dashboard', { screen: 'Inquiries' });
                }
              }}
            >
              <View style={styles.inquiryRowLeft}>
                <View style={styles.inqAvatars}>
                  {listingInquiries.slice(0, 2).map((inq, i) => {
                    const grad = getGradient(inq.renterName);
                    return (
                      <LinearGradient
                        key={inq.id}
                        colors={grad}
                        style={[styles.inqMiniAv, i > 0 ? { marginLeft: -8 } : null]}
                      >
                        <Text style={styles.inqMiniAvText}>
                          {inq.renterName.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    );
                  })}
                  {listingInquiries.length > 2 ? (
                    <View style={[styles.inqMiniAv, styles.inqMiniAvMore, { marginLeft: -8 }]}>
                      <Text style={styles.inqMiniAvText}>+{listingInquiries.length - 2}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.inquiryRowText}>
                  <Text style={{ color: '#ff8070' }}>{listingInquiries.length} renter{listingInquiries.length !== 1 ? 's' : ''}</Text>
                  {' '}interested{pendingInquiries.length > 0 ? ` · ${pendingInquiries.length} pending review` : ''}
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color="rgba(255,107,91,0.5)" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.inquiryRowEmpty}
              onPress={() => navigation.navigate('ListingBoost', { listingId: listing.id })}
            >
              <View style={styles.inquiryRowLeft}>
                <Feather name="message-square" size={16} color="rgba(255,255,255,0.2)" />
                <Text style={styles.inquiryRowTextEmpty}>
                  No inquiries yet — <Text style={{ color: '#ff8070' }}>Boost to get noticed</Text>
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color="rgba(255,107,91,0.4)" />
            </Pressable>
          )}

          <View style={styles.statChips}>
            <View style={styles.chipMuted}>
              <Feather name="eye" size={12} color="rgba(255,255,255,0.45)" />
              <Text style={styles.chipMutedText}>{views} views</Text>
            </View>
            <View style={listingInquiries.length > 0 ? styles.chipCoral : styles.chipMuted}>
              <Feather name="heart" size={12} color={listingInquiries.length > 0 ? '#ff8070' : 'rgba(255,255,255,0.45)'} />
              <Text style={listingInquiries.length > 0 ? styles.chipCoralText : styles.chipMutedText}>
                {listingInquiries.length} inquiries
              </Text>
            </View>
            {listingInquiries.length > 0 ? (
              <View style={styles.chipGreen}>
                <Feather name="trending-up" size={12} color={GREEN} />
                <Text style={styles.chipGreenText}>{rate}% rate</Text>
              </View>
            ) : (
              <View style={styles.chipMuted}>
                <Feather name="clock" size={12} color="rgba(255,255,255,0.45)" />
                <Text style={styles.chipMutedText}>{formatListedAgo(listing) || 'New'}</Text>
              </View>
            )}
            <View style={listing.roomType === 'entire' ? styles.chipEntire : styles.chipRoom}>
              <Feather name={listing.roomType === 'entire' ? 'home' : 'key'} size={12} color={listing.roomType === 'entire' ? '#a78bfa' : '#60a5fa'} />
              <Text style={listing.roomType === 'entire' ? styles.chipEntireText : styles.chipRoomText}>
                {listing.roomType === 'entire' ? 'Entire' : 'Room'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.actionRow}>
            <Pressable
              style={styles.actEdit}
              onPress={() => navigation.navigate('CreateEditListing', { propertyId: listing.id })}
            >
              <Feather name="edit-2" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.actEditText}>Edit</Text>
            </Pressable>
            {status === 'active' ? (
              <>
                {!isFreePlan(getHostPlan() as any) ? (
                  <Pressable
                    style={styles.actBoost}
                    onPress={() => navigation.navigate('ListingBoost', { listingId: listing.id })}
                  >
                    <Feather name="zap" size={13} color="#a855f7" />
                    <Text style={styles.actBoostText}>Boost</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.actPause} onPress={() => pauseListing(listing.id)}>
                  <Feather name="pause" size={13} color={ORANGE} />
                  <Text style={styles.actPauseText}>Pause</Text>
                </Pressable>
                <Pressable style={styles.actRented} onPress={() => markAsRented(listing.id)}>
                  <Feather name="check" size={13} color={GREEN} />
                  <Text style={styles.actRentedText}>Rented</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.actRented} onPress={() => markAsAvailable(listing.id)}>
                  <Feather name="refresh-cw" size={13} color={GREEN} />
                  <Text style={styles.actRentedText}>Available</Text>
                </Pressable>
                {status === 'rented' ? (
                  <Pressable
                    style={styles.actOutreach}
                    onPress={() => {
                      navigation.navigate('HostGroupOutreach', {
                        listingId: listing.id,
                        listingTitle: listing.title,
                      });
                    }}
                  >
                    <Feather name="mail" size={13} color={BLUE} />
                    <Text style={styles.actOutreachText}>Groups</Text>
                  </Pressable>
                ) : null}
              </>
            )}
            <Pressable style={styles.actDelete} onPress={() => deleteListingHandler(listing.id)}>
              <Feather name="trash-2" size={14} color="#ff4d4d" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.topNav, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.topTitle}>My Listings</Text>
          <Text style={styles.topSub}>
            {listings.length} listing{listings.length !== 1 ? 's' : ''} · {activeCount} active
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => setShowAISheet(true)}>
            <LinearGradient
              colors={[ACCENT, '#e83a2a']}
              style={styles.aiGradientBtn}
            >
              <Feather name="cpu" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        <Pressable onPress={() => {
          if (hostSub) {
            const updatedSub = { ...hostSub, activeListingCount: activeCount };
            const result = canAddListingCheck(updatedSub);
            if (!result.allowed) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setLimitMessage(result.message);
              setShowLimitModal(true);
              return;
            }
            if (result.message) {
              setOverageMessage(result.message);
              setShowOverageModal(true);
              return;
            }
          }
          navigation.navigate('CreateEditListing');
        }}>
          <LinearGradient
            colors={[ACCENT, '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBtn}
          >
            <Feather name="plus" size={13} color="#fff" />
            <Text style={styles.addBtnText}>Add Listing</Text>
          </LinearGradient>
        </Pressable>
        </View>
      </View>

      <View style={styles.filterTabs}>
        {filterTabs.map(tab => (
          <Pressable
            key={tab.key}
            style={filter === tab.key ? styles.ftabActive : styles.ftabInactive}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={filter === tab.key ? styles.ftabActiveText : styles.ftabInactiveText}>
              {tab.label}
            </Text>
            <View style={filter === tab.key ? styles.ftabCountActive : styles.ftabCountInactive}>
              <Text style={[styles.ftabCountText, filter === tab.key ? { color: '#fff' } : { color: 'rgba(255,255,255,0.45)' }]}>
                {tab.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="home" size={48} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptySub}>
              {filter === 'all' ? 'Tap "Add Listing" to create your first listing' : `No ${filter} listings`}
            </Text>
          </View>
        ) : (
          filteredListings.map(listing => renderListingCard(listing))
        )}
      </ScrollView>

      <RoomdrAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="host_listings"
        contextData={{
          host: {
            totalListings: listings.length,
            activeListings: listings.filter(p => getListingStatus(p) === 'active').length,
            totalInquiries: inquiries.length,
            pendingInquiries: inquiries.filter(c => c.status === 'pending').length,
            totalViews: listings.reduce((sum, l) => sum + (l.listingViewData?.viewsToday || 0), 0),
            planName: getHostPlan() || 'starter',
          }
        }}
        onNavigate={(screen, params) => {
          try { navigation.navigate(screen as any, params); } catch {}
        }}
      />
      <PaywallSheet
        visible={showHostPaywall}
        featureName="More Listings"
        requiredPlan={getHostPlan() === 'starter' ? 'pro' : 'business'}
        role="host"
        onUpgrade={() => {
          setShowHostPaywall(false);
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('Dashboard', { screen: 'HostPricing' });
          }
        }}
        onDismiss={() => setShowHostPaywall(false)}
      />

      <ListingLimitModal
        visible={showLimitModal}
        message={limitMessage}
        onCancel={() => setShowLimitModal(false)}
        onUpgrade={() => {
          setShowLimitModal(false);
          const parent = navigation.getParent();
          if (parent) parent.navigate('Dashboard', { screen: 'HostSubscription' });
          else navigation.navigate('HostSubscription' as any);
        }}
      />

      <OverageModal
        visible={showOverageModal}
        message={overageMessage}
        onCancel={() => setShowOverageModal(false)}
        onContinue={() => {
          setShowOverageModal(false);
          navigation.navigate('CreateEditListing');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  topTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  topSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  aiGradientBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    height: 38,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  filterTabs: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  ftabActive: {
    height: 32,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ACCENT,
  },
  ftabInactive: {
    height: 32,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  ftabActiveText: { fontSize: 12.5, fontWeight: '600', color: '#fff' },
  ftabInactiveText: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  ftabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  ftabCountInactive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  ftabCountText: { fontSize: 10, fontWeight: '700' },

  feed: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardPhoto: {
    position: 'relative',
    height: 160,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a2535',
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 26,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  priceOnPhoto: {
    position: 'absolute',
    bottom: 12,
    left: 14,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  boostBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD,
  },
  boostedPill: {
    position: 'absolute',
    top: 40,
    left: 12,
    backgroundColor: 'rgba(30,10,50,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boostedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a855f7',
  },

  cardBody: { padding: 14, paddingHorizontal: 15 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    lineHeight: 20,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(62,207,142,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(62,207,142,0.25)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3ECF8E',
  },
  cardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  cardLocationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    flex: 1,
  },

  inquiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.12)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  inquiryRowEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  inquiryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  inqAvatars: { flexDirection: 'row' },
  inqMiniAv: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inqMiniAvMore: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  inqMiniAvText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  inquiryRowText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    flex: 1,
  },
  inquiryRowTextEmpty: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    flex: 1,
  },

  statChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  chipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipMutedText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  chipCoral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.18)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipCoralText: { fontSize: 11, fontWeight: '600', color: '#ff8070' },
  chipGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.18)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipGreenText: { fontSize: 11, fontWeight: '600', color: GREEN },
  chipRoom: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipRoomText: { fontSize: 11, fontWeight: '600' as const, color: '#60a5fa' },
  chipEntire: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipEntireText: { fontSize: 11, fontWeight: '600' as const, color: '#a78bfa' },

  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actEdit: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actEditText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  actBoost: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  actBoostText: { fontSize: 12, fontWeight: '700', color: '#a855f7' },
  actPause: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,165,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,165,0,0.2)',
  },
  actPauseText: { fontSize: 12, fontWeight: '700', color: ORANGE },
  actRented: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.2)',
  },
  actRentedText: { fontSize: 12, fontWeight: '700', color: GREEN },
  actOutreach: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(91,140,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(91,140,255,0.2)',
  },
  actOutreachText: { fontSize: 12, fontWeight: '700', color: '#5b8cff' },
  actDelete: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.18)',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 8,
    textAlign: 'center',
  },
});
