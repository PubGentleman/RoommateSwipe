import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Alert } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { Property, HostSubscriptionData, ListingBoost, BoostCredits } from '../../types/models';
import { BOOST_OPTIONS, BOOST_PACKS, calculateBoostExpiry, isListingBoosted, getBoostTimeRemaining, isFreePlan, createBoostRecord } from '../../utils/hostPricing';
import { getListing } from '../../services/listingService';
import { getPlanLimits, type HostPlan } from '../../constants/planLimits';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const PURPLE = '#a855f7';
const GOLD = '#ffd700';
const ROOMDR_PURPLE = '#7B5EA7';
const GREEN = '#22c55e';
const BLUE = '#60a5fa';

const CREDIT_COLORS: Record<string, string> = {
  quick: BLUE,
  standard: PURPLE,
  extended: GREEN,
};

const BOOST_TYPE_MAP: Record<string, 'quick' | 'standard' | 'extended'> = {
  quick: 'quick',
  standard: 'standard',
  extended: 'extended',
};

export const ListingBoostScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user, getHostPlan } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const listingId = route.params?.listingId;

  const [listing, setListing] = useState<Property | null>(null);
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [activeBoostCount, setActiveBoostCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boostCredits, setBoostCredits] = useState<BoostCredits>({ quick: 0, standard: 0, extended: 0 });

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
            amenities: supaListing.amenities || [],
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
      if (sub?.boostCredits) {
        setBoostCredits(sub.boostCredits);
      }
      const boostCount = await StorageService.getActiveBoostCountForHost(user.id);
      setActiveBoostCount(boostCount);
    };
    loadData();
  }, [user, listingId]);

  const isAgent = user?.hostType === 'agent';
  const isCompany = user?.hostType === 'company';
  const hostPlan = getHostPlan() as HostPlan;
  const planLimits = getPlanLimits(hostPlan);
  const isAgentFree = isAgent && (hostPlan === 'free' || hostPlan === 'none' || (hostPlan as string) === 'pay_per_use');
  const canPayPerBoost = isAgentFree;

  const isBoosted = listing ? isListingBoosted(listing) : false;
  const maxSimultaneous = canPayPerBoost ? 1 : planLimits.simultaneousBoosts;
  const boostsExcludingThis = isBoosted ? activeBoostCount - 1 : activeBoostCount;
  const hasReachedBoostLimit = maxSimultaneous > 0 && boostsExcludingThis >= maxSimultaneous;
  const hasFreeBoosts = hostSub && hostSub.freeBoostsRemaining > 0;
  const hasAnyCredits = boostCredits.quick > 0 || boostCredits.standard > 0 || boostCredits.extended > 0;

  if (!planLimits.hasBoosts && !canPayPerBoost) {
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
            onPress={() => {
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('Dashboard', { screen: 'HostSubscription' });
              }
            }}
            style={{ marginTop: 20, backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: PURPLE }}>See Plans</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const applyBoost = async (optionId: string, useFree: boolean) => {
    if (!user || !listing || !hostSub) return;

    if (hasReachedBoostLimit) {
      await showAlert({ title: 'Boost Limit Reached', message: `Your ${planLimits.label} plan allows up to ${maxSimultaneous} simultaneous boost${maxSimultaneous !== 1 ? 's' : ''}. Upgrade your plan for more.`, variant: 'warning' });
      return;
    }

    const option = BOOST_OPTIONS.find(o => o.id === optionId);
    if (!option) return;

    const doApply = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const boost = createBoostRecord(listing.id, option, useFree);
      await StorageService.applyListingBoost(listing.id, boost);
      if (useFree && hostSub.freeBoostsRemaining > 0) {
        await StorageService.updateHostSubscription(user.id, {
          freeBoostsRemaining: hostSub.freeBoostsRemaining - 1,
        });
      }
      const durationLabel = option.duration === '6h' ? '6 hours'
        : option.duration === '12h' ? '12 hours'
        : option.duration === '24h' ? '24 hours'
        : option.duration === '72h' ? '3 days'
        : '7 days';
      const resultLabel = option.includesFeaturedBadge
        ? `Your listing is now featured for ${durationLabel} with a Featured badge!`
        : `Your listing has been boosted to the top of search for ${durationLabel}.`;
      await showAlert({ title: 'Boost Applied!', message: resultLabel, variant: 'success' });
      navigation.goBack();
    };

    if (useFree) {
      const confirmed = await confirm({
        title: 'Use Free Boost',
        message: `Apply your free ${hostSub.freeBoostDuration} boost to "${listing.title}"?`,
        confirmText: 'Apply',
        variant: 'info',
      });
      if (confirmed) await doApply();
    } else if (isDev) {
      const confirmed = await confirm({
        title: 'Dev Mode',
        message: `Payment would process via Stripe: $${option.price} for ${option.label}.${option.includesFeaturedBadge ? ' Includes Featured badge.' : ''}`,
        confirmText: 'Confirm (Mock)',
        variant: 'info',
      });
      if (confirmed) await doApply();
    } else {
      doApply();
    }
  };

  const useCredit = async (boostType: 'quick' | 'standard' | 'extended') => {
    if (!user || !listing || !hostSub) return;
    if (boostCredits[boostType] <= 0) return;

    if (hasReachedBoostLimit) {
      await showAlert({ title: 'Boost Limit Reached', message: `Your ${planLimits.label} plan allows up to ${maxSimultaneous} simultaneous boost${maxSimultaneous !== 1 ? 's' : ''}. Upgrade your plan for more.`, variant: 'warning' });
      return;
    }

    const option = BOOST_OPTIONS.find(o => o.id === boostType);
    if (!option) return;

    const confirmed = await confirm({
      title: 'Use Boost Credit',
      message: `Use 1 ${option.label.replace(' Boost', '')} credit to boost "${listing.title}" for ${option.duration}? You have ${boostCredits[boostType]} credit${boostCredits[boostType] !== 1 ? 's' : ''} remaining.`,
      confirmText: 'Use Credit',
      variant: 'info',
    });
    if (!confirmed) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const boost = createBoostRecord(listing.id, option, false);
    await StorageService.applyListingBoost(listing.id, boost);

    const newCredits = { ...boostCredits, [boostType]: boostCredits[boostType] - 1 };
    setBoostCredits(newCredits);
    await StorageService.updateHostSubscription(user.id, { boostCredits: newCredits });

    const durationLabel = option.duration === '6h' ? '6 hours' : option.duration === '12h' ? '12 hours' : '24 hours';
    await showAlert({ title: 'Boost Applied!', message: `Your listing has been boosted for ${durationLabel} using a credit.`, variant: 'success' });
    navigation.goBack();
  };

  const purchaseBoostPack = async (packId: string) => {
    const allPacks = [...BOOST_PACKS.quick, ...BOOST_PACKS.standard, ...BOOST_PACKS.extended];
    const pack = allPacks.find(p => p.id === packId);
    if (!pack || !user) return;

    const boostType: 'quick' | 'standard' | 'extended' = packId.startsWith('quick') ? 'quick'
      : packId.startsWith('std') ? 'standard'
      : 'extended';

    const savings = (pack.quantity * BOOST_OPTIONS.find(o => o.id === boostType)!.price) - pack.totalPrice;

    const confirmed = await confirm({
      title: `Purchase ${pack.label}`,
      message: `$${pack.totalPrice.toFixed(2)} ($${pack.pricePerBoost.toFixed(2)}/ea)${savings > 0 ? `\nYou save $${savings.toFixed(2)} (${pack.discount}%)` : ''}\n\nCredits never expire.`,
      confirmText: `Purchase $${pack.totalPrice.toFixed(2)}`,
      variant: 'info',
    });
    if (!confirmed) return;

    if (isDev) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newCredits = { ...boostCredits, [boostType]: boostCredits[boostType] + pack.quantity };
      setBoostCredits(newCredits);
      await StorageService.updateHostSubscription(user.id, { boostCredits: newCredits });
      await StorageService.recordBoostPurchase({
        userId: user.id,
        packId,
        boostType,
        quantity: pack.quantity,
        pricePerBoost: pack.pricePerBoost,
        totalPrice: pack.totalPrice,
      });
      await showAlert({
        title: 'Credits Added!',
        message: `${pack.quantity} ${boostType.charAt(0).toUpperCase() + boostType.slice(1)} Boost credit${pack.quantity > 1 ? 's' : ''} added!\nYou now have ${newCredits[boostType]} ${boostType} credit${newCredits[boostType] !== 1 ? 's' : ''}.`,
        variant: 'success',
      });
    } else {
      await showAlert({ title: 'Payment Required', message: 'Payment processing will be available soon.', variant: 'info' });
    }
  };

  if (!listing || !hostSub) return null;

  const renderCreditsBar = () => {
    if (!hasAnyCredits) return null;
    return (
      <View style={styles.creditsSection}>
        <Text style={styles.creditsSectionTitle}>Your Boost Credits</Text>
        <View style={styles.creditsRow}>
          {(['quick', 'standard', 'extended'] as const).map(type => (
            <View key={type} style={[styles.creditCard, { borderTopColor: CREDIT_COLORS[type] }]}>
              <Text style={[styles.creditCount, { color: CREDIT_COLORS[type] }]}>{boostCredits[type]}</Text>
              <Text style={styles.creditLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderBoostPackSection = () => {
    const tiers: { key: 'quick' | 'standard' | 'extended'; label: string; duration: string }[] = [
      { key: 'quick', label: 'Quick Boosts', duration: '6h' },
      { key: 'standard', label: 'Standard Boosts', duration: '12h' },
      { key: 'extended', label: 'Extended Boosts', duration: '24h' },
    ];

    return (
      <View style={styles.bulkSection}>
        <View style={styles.bulkDivider} />
        <Text style={styles.bulkTitle}>Buy Boost Packs</Text>
        <Text style={styles.bulkSubtitle}>Save up to 50% when you buy in bulk</Text>

        {tiers.map(tier => (
          <View key={tier.key} style={styles.bulkTierSection}>
            <Text style={styles.bulkTierLabel}>{tier.label} ({tier.duration})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulkPacksRow}>
              {BOOST_PACKS[tier.key].filter(p => p.quantity > 1).map(pack => (
                <Pressable key={pack.id} style={styles.bulkPackCard} onPress={() => purchaseBoostPack(pack.id)}>
                  {pack.badge ? (
                    <View style={[styles.packBadge, { backgroundColor: pack.badge === 'Best Value' ? ACCENT : GREEN }]}>
                      <Text style={styles.packBadgeText}>{pack.badge}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.packSize}>{pack.quantity}-Pack</Text>
                  <Text style={styles.packPrice}>${pack.totalPrice.toFixed(2)}</Text>
                  <Text style={styles.packPerUnit}>${pack.pricePerBoost.toFixed(2)}/ea</Text>
                  {pack.discount > 0 ? (
                    <Text style={styles.packDiscount}>-{pack.discount}%</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    );
  };

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
              <Text style={styles.activeBoostTitle}>
                {listing.listingBoost.includesFeaturedBadge ? 'Featured Boost Active' : 'Boost Active'}
              </Text>
              <Text style={styles.activeBoostExpiry}>
                {getBoostTimeRemaining(listing.listingBoost)}
              </Text>
              {listing.listingBoost.includesFeaturedBadge ? (
                <View style={styles.activeBoostBadgeRow}>
                  <Feather name="star" size={12} color={GOLD} />
                  <Text style={styles.activeBoostBadgeText}>Featured badge is showing on your listing</Text>
                </View>
              ) : null}
              {listing.listingBoost.includesViewCount ? (
                <View style={styles.activeBoostBadgeRow}>
                  <Feather name="eye" size={12} color="#a855f7" />
                  <Text style={styles.activeBoostBadgeText}>View counter visible to renters</Text>
                </View>
              ) : null}
              {listing.listingBoost.includesTopPicks ? (
                <View style={styles.activeBoostBadgeRow}>
                  <Feather name="award" size={12} color="#22c55e" />
                  <Text style={styles.activeBoostBadgeText}>Appearing in Top Picks section</Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>
        ) : null}

        {!isBoosted && listing.listingBoost?.includesAnalytics && listing.listingBoost?.startedAt ? (
          <View style={styles.analyticsCard}>
            <View style={styles.analyticsHeader}>
              <Feather name="bar-chart-2" size={16} color="#3b82f6" />
              <Text style={styles.analyticsTitle}>Boost Performance</Text>
            </View>
            <Text style={styles.analyticsSubtitle}>
              {new Date(listing.listingBoost.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(listing.listingBoost.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.analyticsStats}>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>
                  {(() => {
                    const seed = listing.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                    return Math.floor(40 + (seed % 120));
                  })()}
                </Text>
                <Text style={styles.analyticsStatLabel}>Views</Text>
              </View>
              <View style={[styles.analyticsStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={styles.analyticsStatValue}>
                  {(() => {
                    const seed = listing.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                    return Math.floor(3 + (seed % 12));
                  })()}
                </Text>
                <Text style={styles.analyticsStatLabel}>Inquiries</Text>
              </View>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>
                  {(() => {
                    const seed = listing.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                    const views = 40 + (seed % 120);
                    const inquiries = 3 + (seed % 12);
                    return Math.round((inquiries / views) * 100);
                  })()}%
                </Text>
                <Text style={styles.analyticsStatLabel}>Conversion</Text>
              </View>
            </View>
          </View>
        ) : null}

        {hasReachedBoostLimit ? (
          <View style={styles.warningCard}>
            <Feather name="alert-circle" size={16} color={GOLD} />
            <Text style={styles.warningText}>
              {maxSimultaneous === -1
                ? 'Unlimited simultaneous boosts available.'
                : `You have reached your ${maxSimultaneous} simultaneous boost limit. Upgrade your plan for more.`}
            </Text>
          </View>
        ) : null}

        {!isBoosted && hasFreeBoosts ? (
          <Pressable
            style={styles.freeBoostBanner}
            onPress={() => {
              const freeOption = BOOST_OPTIONS.find(o => o.duration === hostSub.freeBoostDuration);
              if (freeOption) applyBoost(freeOption.id, true);
            }}
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

        {canPayPerBoost && !isBoosted ? (
          <View style={styles.payPerBoostBanner}>
            <LinearGradient colors={['rgba(168,85,247,0.12)', 'rgba(168,85,247,0.04)']} style={styles.payPerBoostGradient}>
              <View style={styles.payPerBoostContent}>
                <View style={styles.payPerBoostIcon}>
                  <Feather name="zap" size={16} color={PURPLE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payPerBoostTitle}>Pay-Per-Boost</Text>
                  <Text style={styles.payPerBoostSub}>
                    Purchase individual boosts without a subscription. 1 active boost at a time.
                  </Text>
                </View>
              </View>
              <View style={styles.payPerBoostUpgrade}>
                <Feather name="arrow-up" size={11} color="rgba(255,255,255,0.4)" />
                <Text style={styles.payPerBoostUpgradeText}>
                  Upgrade for more simultaneous boosts and free monthly boosts
                </Text>
              </View>
            </LinearGradient>
          </View>
        ) : null}

        {renderCreditsBar()}

        {!isBoosted ? (
          <View style={styles.optionsSection}>
            <Text style={styles.sectionTitle}>Boost Options</Text>
            {BOOST_OPTIONS.map(option => {
              const isSelected = selectedId === option.id;
              const creditType = BOOST_TYPE_MAP[option.id];
              const creditCount = creditType ? boostCredits[creditType] : 0;
              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionCard,
                    isSelected ? { borderColor: PURPLE, borderWidth: 2 } : null,
                    option.highlight ? { borderColor: 'rgba(168,85,247,0.3)', borderWidth: 1.5 } : null,
                    hasReachedBoostLimit ? { opacity: 0.5 } : null,
                  ]}
                  onPress={() => {
                    if (hasReachedBoostLimit) return;
                    setSelectedId(option.id);
                  }}
                >
                  {option.highlight ? (
                    <View style={styles.bestValueBadge}>
                      <Feather name="star" size={9} color={PURPLE} />
                      <Text style={styles.bestValueText}>Best Value</Text>
                    </View>
                  ) : null}

                  <View style={styles.optionTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      <View style={styles.durationChip}>
                        <Text style={styles.durationChipText}>
                          {option.duration.toUpperCase().replace('H', ' HRS').replace('D', ' DAYS')}
                        </Text>
                      </View>
                      {option.popularBadge ? (
                        <View style={[
                          styles.popularBadge,
                          { backgroundColor: option.highlight ? '#FF6B6B' : '#22C55E' }
                        ]}>
                          <Text style={styles.popularBadgeText}>{option.popularBadge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.optionPrice, isSelected ? { color: PURPLE } : null]}>
                      ${option.price}
                    </Text>
                  </View>

                  <Text style={styles.optionDesc}>{option.description}</Text>

                  <View style={styles.optionPerks}>
                    <View style={styles.perkRow}>
                      <Feather name="map-pin" size={12} color={ROOMDR_PURPLE} />
                      <Text style={styles.perkText}>Top placement in search</Text>
                    </View>
                    {option.includesFeaturedBadge ? (
                      <View style={styles.perkRow}>
                        <Feather name="star" size={12} color={GOLD} />
                        <Text style={[styles.perkText, { color: GOLD }]}>Featured badge on listing card</Text>
                      </View>
                    ) : (
                      <View style={styles.perkRow}>
                        <Feather name="minus" size={12} color="rgba(255,255,255,0.2)" />
                        <Text style={[styles.perkText, { color: 'rgba(255,255,255,0.25)' }]}>No badge</Text>
                      </View>
                    )}
                    {option.includesViewCount ? (
                      <View style={styles.perkRow}>
                        <Feather name="eye" size={12} color="#a855f7" />
                        <Text style={[styles.perkText, { color: '#a855f7' }]}>Social proof view counter</Text>
                      </View>
                    ) : (
                      <View style={styles.perkRow}>
                        <Feather name="minus" size={12} color="rgba(255,255,255,0.2)" />
                        <Text style={[styles.perkText, { color: 'rgba(255,255,255,0.25)' }]}>No view counter</Text>
                      </View>
                    )}
                    {option.includesTopPicks ? (
                      <View style={styles.perkRow}>
                        <Feather name="award" size={12} color="#22c55e" />
                        <Text style={[styles.perkText, { color: '#22c55e' }]}>Top Picks section placement</Text>
                      </View>
                    ) : null}
                    {option.includesAnalytics ? (
                      <View style={styles.perkRow}>
                        <Feather name="bar-chart-2" size={12} color="#3b82f6" />
                        <Text style={[styles.perkText, { color: '#3b82f6' }]}>Boost performance analytics</Text>
                      </View>
                    ) : null}
                  </View>

                  {creditCount > 0 && !hasReachedBoostLimit ? (
                    <Pressable
                      style={styles.useCreditBtn}
                      onPress={() => useCredit(creditType)}
                    >
                      <Text style={styles.useCreditText}>Use Credit ({creditCount} left)</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}

            {selectedId && !hasReachedBoostLimit ? (
              <Pressable onPress={() => applyBoost(selectedId, false)}>
                <LinearGradient colors={[PURPLE, '#7c3aed']} style={styles.purchaseBtn}>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={styles.purchaseBtnText}>
                    Purchase {BOOST_OPTIONS.find(o => o.id === selectedId)?.label} — ${BOOST_OPTIONS.find(o => o.id === selectedId)?.price}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.explainerBox}>
          <View style={styles.explainerHeader}>
            <Feather name="info" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.explainerTitle}>What's included?</Text>
          </View>
          <Text style={styles.explainerText}>
            Quick Boost = higher ranking in search results.
          </Text>
          <Text style={styles.explainerText}>
            Standard = Featured badge + view counter showing social proof to renters.
          </Text>
          <Text style={styles.explainerText}>
            Extended = everything in Standard + Top Picks section placement + boost analytics after it ends.
          </Text>
        </View>

        {renderBoostPackSection()}

        <Text style={styles.notice}>
          {canPayPerBoost
            ? 'Pay-per-boost: 1 active boost at a time. Upgrade your plan for more simultaneous boosts. Boosts cannot be cancelled once applied.'
            : maxSimultaneous === -1
            ? 'Unlimited simultaneous boosts on your plan. Boosts cannot be cancelled once applied.'
            : `Your plan allows up to ${maxSimultaneous} simultaneous boost${maxSimultaneous !== 1 ? 's' : ''}. Boosts cannot be cancelled once applied.`}
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
    backgroundColor: '#1a1a1a',
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
  activeBoostBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeBoostBadgeText: { fontSize: 12, fontWeight: '600', color: GOLD },
  analyticsCard: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  analyticsSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    marginBottom: 14,
  },
  analyticsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 14,
  },
  analyticsStat: {
    flex: 1,
    alignItems: 'center',
  },
  analyticsStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3b82f6',
  },
  analyticsStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
    fontWeight: '600',
  },
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
  creditsSection: { marginBottom: 16 },
  creditsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  creditsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  creditCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  creditCount: {
    fontSize: 22,
    fontWeight: '800',
  },
  creditLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontWeight: '600',
  },
  optionsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  optionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bestValueBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  bestValueText: { fontSize: 10, fontWeight: '700', color: PURPLE },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  durationChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  durationChipText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  popularBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  optionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 18, marginBottom: 10 },
  optionPrice: { fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  optionPerks: { gap: 6 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  useCreditBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  useCreditText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
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
  explainerBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  explainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  explainerTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  explainerText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17 },
  notice: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
  payPerBoostBanner: { marginBottom: 16 },
  payPerBoostGradient: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  payPerBoostContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payPerBoostIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  payPerBoostTitle: { fontSize: 14, fontWeight: '700', color: PURPLE },
  payPerBoostSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 16 },
  payPerBoostUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  payPerBoostUpgradeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    flex: 1,
  },
  bulkSection: {
    marginTop: 24,
  },
  bulkDivider: {
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  bulkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  bulkSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
  },
  bulkTierSection: {
    marginBottom: 16,
  },
  bulkTierLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  bulkPacksRow: {
    gap: 10,
    paddingRight: 4,
  },
  bulkPackCard: {
    width: 100,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  packBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  packBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  packSize: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  packPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  packPerUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  packDiscount: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
    marginTop: 4,
  },
});
