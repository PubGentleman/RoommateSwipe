import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { Property, HostSubscriptionData, ListingBoost } from '../../types/models';
import { BOOST_OPTIONS, calculateBoostExpiry, isListingBoosted, getBoostTimeRemaining, isFreePlan } from '../../utils/hostPricing';
import { getListing } from '../../services/listingService';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const PURPLE = '#a855f7';
const GOLD = '#ffd700';

export const ListingBoostScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listingId = route.params?.listingId;

  const [listing, setListing] = useState<Property | null>(null);
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [existingBoost, setExistingBoost] = useState<ListingBoost | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'24h' | '72h' | '7d' | null>(null);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      let found: Property | null = null;
      try {
        const supaListing = await getListing(listingId);
        if (supaListing) {
          found = {
            id: supaListing.id,
            title: supaListing.title || '',
            description: supaListing.description || '',
            price: supaListing.rent || 0,
            bedrooms: supaListing.bedrooms || 1,
            bathrooms: supaListing.bathrooms || 1,
            sqft: supaListing.sqft || 0,
            propertyType: supaListing.property_type || 'lease',
            roomType: supaListing.room_type || 'entire',
            city: supaListing.city || '',
            state: supaListing.state || '',
            neighborhood: supaListing.neighborhood,
            address: supaListing.address || '',
            photos: supaListing.photos || [],
            available: true,
            hostId: supaListing.host_id || user.id,
            hostName: user.name,
          };
        }
      } catch {}
      if (!found) {
        const props = await StorageService.getProperties();
        found = props.find(p => p.id === listingId) || null;
      }
      if (found) setListing(found);
      const sub = await StorageService.getHostSubscription(user.id);
      setHostSub(sub);
      const activeBoost = await StorageService.getActiveBoostForHost(user.id);
      setExistingBoost(activeBoost);
    };
    loadData();
  }, [user, listingId]);

  const isBoosted = listing ? isListingBoosted(listing) : false;
  const hasActiveBoostElsewhere = existingBoost && existingBoost.listingId !== listingId;
  const hasFreeBoosts = hostSub && hostSub.freeBoostsRemaining > 0;
  const isOnFreePlan = hostSub && isFreePlan(hostSub.plan);

  if (isOnFreePlan && hostSub) {
    return (
      <View style={[{ flex: 1, backgroundColor: BG }, { paddingTop: insets.top }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>Boost Listing</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Feather name="lock" size={40} color={PURPLE} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16, textAlign: 'center' }}>Boosts Available on Starter+</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            Upgrade to a paid plan to boost your listings and get more visibility.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('HostSubscription')}
            style={{ marginTop: 20, backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: PURPLE }}>See Plans</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const applyBoost = async (duration: '24h' | '72h' | '7d', useFree: boolean) => {
    if (!user || !listing || !hostSub) return;

    if (hasActiveBoostElsewhere) {
      Alert.alert('Boost Active', 'You already have an active boost on another listing. Only one boost at a time is allowed.');
      return;
    }

    const option = BOOST_OPTIONS.find(o => o.duration === duration);
    if (!option) return;

    const doApply = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const boost: ListingBoost = {
        listingId: listing.id,
        duration,
        price: useFree ? 0 : option.price,
        startedAt: new Date().toISOString(),
        expiresAt: calculateBoostExpiry(duration),
        isActive: true,
        usedFreeboost: useFree,
      };
      await StorageService.applyListingBoost(listing.id, boost);
      if (useFree && hostSub.freeBoostsRemaining > 0) {
        await StorageService.updateHostSubscription(user.id, {
          freeBoostsRemaining: hostSub.freeBoostsRemaining - 1,
        });
      }
      Alert.alert('Listing Boosted!', `Your listing will be featured for ${option.label.toLowerCase()}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    };

    if (useFree) {
      Alert.alert(
        'Use Free Boost',
        `Apply your free ${hostSub.freeBoostDuration} boost to "${listing.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Apply', onPress: doApply },
        ]
      );
    } else if (isDev) {
      Alert.alert(
        'Dev Mode',
        `Payment would process via Stripe: $${option.price} for ${option.label}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm (Mock)', onPress: doApply },
        ]
      );
    } else {
      doApply();
    }
  };

  if (!listing || !hostSub) return null;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Boost Listing</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.listingInfo}>
          <View style={styles.listingIcon}>
            <Feather name="home" size={20} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
            <Text style={styles.listingAddress} numberOfLines={1}>
              {listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city}
            </Text>
          </View>
        </View>

        {isBoosted && listing.listingBoost ? (
          <View style={styles.activeBoostCard}>
            <LinearGradient colors={[PURPLE, '#7c3aed']} style={styles.activeBoostGradient}>
              <Feather name="zap" size={24} color="#fff" />
              <Text style={styles.activeBoostTitle}>Boost Active</Text>
              <Text style={styles.activeBoostExpiry}>
                {getBoostTimeRemaining(listing.listingBoost)}
              </Text>
            </LinearGradient>
          </View>
        ) : null}

        {hasActiveBoostElsewhere ? (
          <View style={styles.warningCard}>
            <Feather name="alert-circle" size={16} color={GOLD} />
            <Text style={styles.warningText}>
              You have an active boost on another listing. Only one boost at a time is allowed.
            </Text>
          </View>
        ) : null}

        {!isBoosted && hasFreeBoosts ? (
          <Pressable
            style={styles.freeBoostBanner}
            onPress={() => applyBoost(hostSub.freeBoostDuration, true)}
          >
            <LinearGradient colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.05)']} style={styles.freeBoostGradient}>
              <View style={styles.freeBoostContent}>
                <View style={styles.freeBoostIcon}>
                  <Feather name="gift" size={18} color={PURPLE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.freeBoostTitle}>Use Free Boost</Text>
                  <Text style={styles.freeBoostSub}>
                    {hostSub.freeBoostsRemaining} free {hostSub.freeBoostDuration} boost{hostSub.freeBoostsRemaining > 1 ? 's' : ''} remaining
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={PURPLE} />
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        {!isBoosted ? (
          <View style={styles.optionsSection}>
            <Text style={styles.sectionTitle}>Boost Options</Text>
            {BOOST_OPTIONS.map(option => {
              const isSelected = selectedDuration === option.duration;
              const isBestValue = option.duration === '72h';
              return (
                <Pressable
                  key={option.duration}
                  style={[
                    styles.optionCard,
                    isSelected ? { borderColor: PURPLE, borderWidth: 2 } : null,
                    (hasActiveBoostElsewhere) ? { opacity: 0.5 } : null,
                  ]}
                  onPress={() => {
                    if (hasActiveBoostElsewhere) return;
                    setSelectedDuration(option.duration);
                  }}
                >
                  {isBestValue ? (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>Best Value</Text>
                    </View>
                  ) : null}
                  <View style={styles.optionRow}>
                    <View style={styles.optionLeft}>
                      <Feather name="zap" size={16} color={isSelected ? PURPLE : 'rgba(255,255,255,0.4)'} />
                      <View>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDesc}>{option.description}</Text>
                      </View>
                    </View>
                    <Text style={[styles.optionPrice, isSelected ? { color: PURPLE } : null]}>
                      ${option.price}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {selectedDuration && !hasActiveBoostElsewhere ? (
              <Pressable onPress={() => applyBoost(selectedDuration, false)}>
                <LinearGradient colors={[PURPLE, '#7c3aed']} style={styles.purchaseBtn}>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={styles.purchaseBtnText}>
                    Purchase Boost — ${BOOST_OPTIONS.find(o => o.duration === selectedDuration)?.price}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.notice}>
          One boost active at a time. Boosts cannot be cancelled once applied.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  listingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  listingIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  listingTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  listingAddress: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  activeBoostCard: { marginBottom: 16 },
  activeBoostGradient: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  activeBoostTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  activeBoostExpiry: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  warningText: { fontSize: 13, color: GOLD, flex: 1, lineHeight: 18 },
  freeBoostBanner: { marginBottom: 16 },
  freeBoostGradient: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  freeBoostContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  freeBoostIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  freeBoostTitle: { fontSize: 15, fontWeight: '700', color: PURPLE },
  freeBoostSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  optionsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  optionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bestValueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  bestValueText: { fontSize: 10, fontWeight: '700', color: PURPLE },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  optionDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  optionPrice: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  purchaseBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  purchaseBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  notice: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
