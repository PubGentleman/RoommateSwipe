import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GOLD = '#ffd700';

type HostPlan = 'starter' | 'pro' | 'business';

interface PlanFeature {
  label: string;
  included: boolean;
}

interface PlanTier {
  id: HostPlan;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  recommended?: boolean;
  features: PlanFeature[];
  monthlyNote: string;
}

const HOST_PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyNote: 'No credit card required',
    features: [
      { label: '1 active listing', included: true },
      { label: 'Up to 5 inquiry responses/mo', included: true },
      { label: 'Basic analytics (views only)', included: true },
      { label: 'Boosted listing visibility', included: false },
      { label: 'Verified host badge', included: false },
      { label: 'Full analytics dashboard', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29.99,
    annualPrice: 299.90,
    recommended: true,
    monthlyNote: 'Unlimited inquiries, full analytics & verified badge',
    features: [
      { label: 'Up to 5 active listings', included: true },
      { label: 'Unlimited inquiry responses', included: true },
      { label: 'Boosted listing visibility', included: true },
      { label: 'Full analytics dashboard', included: true },
      { label: 'Verified host badge', included: true },
      { label: 'Priority search placement', included: false },
      { label: 'Featured slot on Explore page', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 79.99,
    annualPrice: 799.90,
    monthlyNote: 'Unlimited listings, priority placement & dedicated support',
    features: [
      { label: 'Everything in Pro', included: true },
      { label: 'Unlimited active listings', included: true },
      { label: 'Priority placement in search results', included: true },
      { label: 'Featured listing slot on Explore page', included: true },
      { label: 'Advanced analytics & conversion rate', included: true },
      { label: 'Dedicated host support', included: true },
    ],
  },
];

const ONE_TIME_PURCHASES = [
  {
    id: 'boost',
    name: 'Listing Boost',
    desc: '7 days of boosted visibility — appear at the top of results in your city',
    price: '$4.99',
    btnLabel: 'Boost',
    icon: 'trending-up' as const,
    iconColor: '#ff7b6b',
    iconBg: 'rgba(255,107,91,0.12)',
  },
  {
    id: 'verify',
    name: 'Host Verification Badge',
    desc: 'One-time ID & identity check — builds renter trust instantly',
    price: '$9.99',
    btnLabel: 'Verify',
    icon: 'shield' as const,
    iconColor: '#78c0ff',
    iconBg: 'rgba(100,180,255,0.1)',
  },
  {
    id: 'super',
    name: 'Super Interest',
    desc: "Jump to top of host's queue with a gold badge — stand out instantly",
    price: '$0.99',
    btnLabel: 'Send',
    icon: 'star' as const,
    iconColor: '#ffd700',
    iconBg: 'rgba(255,215,0,0.1)',
  },
];

const planOrder: Record<HostPlan, number> = { starter: 0, pro: 1, business: 2 };

export const HostPricingScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { getHostPlan, upgradeHostPlan, downgradeHostPlan, purchaseListingBoost, purchaseHostVerification, purchaseSuperInterest } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedTier, setSelectedTier] = useState<HostPlan>('pro');
  const currentPlan = getHostPlan();

  const getStripPrice = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return '$0';
    return `$${plan.monthlyPrice.toFixed(2)}`;
  };

  const getStripPer = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return 'forever';
    return '/mo';
  };

  const getCardPrice = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return '$0';
    return `$${plan.monthlyPrice.toFixed(2)}`;
  };

  const getCardPeriod = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return '/ forever';
    return isAnnual ? '/ mo' : '/ mo';
  };

  const handleSelectPlan = (plan: PlanTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (plan.id === currentPlan) {
      Alert.alert('Current Plan', `You are already on the ${plan.name} plan.`);
      return;
    }
    if (plan.id === 'starter' && currentPlan !== 'starter') {
      Alert.alert(
        'Downgrade to Starter',
        'Your current plan benefits will continue until the end of your billing period.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Downgrade', style: 'destructive', onPress: async () => {
            await downgradeHostPlan('starter');
            Alert.alert('Scheduled', 'You will be moved to Starter at the end of your billing period.');
          }},
        ]
      );
      return;
    }
    const isUpgrade = planOrder[plan.id] > planOrder[currentPlan];
    const price = isAnnual
      ? `$${plan.annualPrice.toFixed(2)}/year`
      : `$${plan.monthlyPrice.toFixed(2)}/month`;
    const title = isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`;
    const actionText = isUpgrade ? 'Subscribe' : 'Switch';
    Alert.alert(title, `${actionText} to ${plan.name} for ${price}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: actionText, onPress: async () => {
        if (isUpgrade) {
          await upgradeHostPlan(plan.id as 'pro' | 'business');
        } else {
          await downgradeHostPlan(plan.id as 'starter' | 'pro');
        }
        Alert.alert('Success', `You are now on the ${plan.name} plan!`);
      }},
    ]);
  };

  const handlePurchase = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (id === 'boost') {
      Alert.alert('Listing Boost', 'Boost a listing for $4.99 (7 days)?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purchase', onPress: () => { purchaseListingBoost(''); Alert.alert('Purchased', 'Listing Boost activated for 7 days!'); }},
      ]);
    } else if (id === 'verify') {
      Alert.alert('Host Verification', 'Get verified for $9.99 (one-time)?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purchase', onPress: () => { purchaseHostVerification(); Alert.alert('Purchased', 'Your Host Verification badge is now active!'); }},
      ]);
    } else if (id === 'super') {
      Alert.alert('Super Interest', 'Purchase Super Interest for $0.99?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purchase', onPress: () => { purchaseSuperInterest(); Alert.alert('Purchased', 'Super Interest ready to use!'); }},
      ]);
    }
  };

  const getCTAStyle = (plan: PlanTier) => {
    if (plan.id === currentPlan) return 'ghost';
    if (plan.recommended) return 'primary';
    return 'outline';
  };

  const getCTALabel = (plan: PlanTier) => {
    if (plan.id === currentPlan) return 'Current Plan';
    if (planOrder[plan.id] > planOrder[currentPlan]) return `Upgrade to ${plan.name}`;
    return `Switch to ${plan.name}`;
  };

  return (
    <View style={[s.container, { backgroundColor: BG }]}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.65)" />
        </Pressable>
        <Text style={s.headerTitle}>Subscription</Text>
        <View style={s.hostBadge}>
          <Text style={s.hostBadgeText}>HOST MODE</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Text style={s.heroTitle}>Grow Your <Text style={s.heroAccent}>Listings</Text></Text>
          <Text style={s.heroSub}>Reach more renters and fill vacancies faster</Text>
        </View>

        <View style={s.tierStrip}>
          {HOST_PLANS.map(plan => {
            const active = selectedTier === plan.id;
            return (
              <Pressable
                key={plan.id}
                style={[s.tierTile, active ? s.tierTileActive : null]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier(plan.id); }}
              >
                {active ? <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.tDot} /> : null}
                <Text style={[s.tName, active ? s.tNameActive : null]}>{plan.name.toUpperCase()}</Text>
                <Text style={s.tPrice}>{getStripPrice(plan)}</Text>
                <Text style={s.tPer}>{getStripPer(plan)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.billingToggle}>
          <Pressable
            style={[s.toggleBtn, !isAnnual ? s.toggleBtnActive : null]}
            onPress={() => setIsAnnual(false)}
          >
            {!isAnnual ? (
              <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.toggleGradient}>
                <Text style={s.toggleActiveText}>Monthly</Text>
              </LinearGradient>
            ) : (
              <Text style={s.toggleInactiveText}>Monthly</Text>
            )}
          </Pressable>
          <Pressable
            style={[s.toggleBtn, isAnnual ? s.toggleBtnActive : null]}
            onPress={() => setIsAnnual(true)}
          >
            {isAnnual ? (
              <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.toggleGradient}>
                <Text style={s.toggleActiveText}>Annual</Text>
                <View style={s.saveBadgeOn}>
                  <Text style={s.saveBadgeOnText}>PAY ONCE/YEAR</Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={s.toggleInnerRow}>
                <Text style={s.toggleInactiveText}>Annual</Text>
                <View style={s.saveBadgeOff}>
                  <Text style={s.saveBadgeOffText}>PAY ONCE/YEAR</Text>
                </View>
              </View>
            )}
          </Pressable>
        </View>

        {HOST_PLANS.map(plan => {
          const isRec = plan.recommended;
          const annualTotal = plan.monthlyPrice > 0 && isAnnual
            ? `Billed $${(plan.monthlyPrice * 12).toFixed(2)}/yr`
            : null;
          const ctaStyle = getCTAStyle(plan);

          return (
            <View key={plan.id} style={[s.planCard, isRec ? s.planCardRec : null]}>
              <View style={[s.planBand, isRec ? s.planBandRec : null]}>
                <View style={s.planTopRow}>
                  <Text style={[s.planName, isRec ? s.planNameCoral : null]}>{plan.name}</Text>
                  {isRec ? (
                    <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.planBadgePopular}>
                      <Feather name="star" size={8} color="#fff" />
                      <Text style={s.planBadgePopularText}>MOST POPULAR</Text>
                    </LinearGradient>
                  ) : plan.id === 'business' ? (
                    <View style={s.planBadgeValue}>
                      <Feather name="award" size={8} color="rgba(255,215,0,0.85)" />
                      <Text style={s.planBadgeValueText}>BEST VALUE</Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.priceRow}>
                  <Text style={s.priceBig}>{getCardPrice(plan)}</Text>
                  <Text style={s.pricePeriod}>{getCardPeriod(plan)}</Text>
                </View>
                {isAnnual && annualTotal ? (
                  <Text style={s.priceNote}>
                    {annualTotal}  ·  <Text style={s.savingsTag}>One annual payment</Text>
                  </Text>
                ) : (
                  <Text style={s.priceNote}>{plan.monthlyNote}</Text>
                )}
              </View>
              <View style={[s.planDivider, isRec ? s.planDividerCoral : null]} />
              <View style={s.planFeatures}>
                {plan.features.map((feat, idx) => (
                  <View key={idx} style={s.featRow}>
                    <View style={[s.featIcon, feat.included ? s.featIconOn : s.featIconOff]}>
                      <Feather
                        name={feat.included ? 'check' : 'x'}
                        size={9}
                        color={feat.included ? ACCENT : 'rgba(255,255,255,0.18)'}
                      />
                    </View>
                    <Text style={feat.included ? s.featLabelOn : s.featLabelOff}>{feat.label}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={[
                  s.planCTA,
                  ctaStyle === 'primary' ? s.planCTAPrimary : null,
                  ctaStyle === 'outline' ? s.planCTAOutline : null,
                  ctaStyle === 'ghost' ? s.planCTAGhost : null,
                ]}
                onPress={() => handleSelectPlan(plan)}
              >
                {ctaStyle === 'primary' ? (
                  <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.ctaGradient}>
                    <Text style={s.ctaTextWhite}>{getCTALabel(plan)} →</Text>
                  </LinearGradient>
                ) : (
                  <Text style={ctaStyle === 'ghost' ? s.ctaTextGhost : s.ctaTextOutline}>{getCTALabel(plan)}</Text>
                )}
              </Pressable>
            </View>
          );
        })}

        <Text style={s.sectionLabel}>One-Time Purchases</Text>

        <View style={s.oneshotCard}>
          {ONE_TIME_PURCHASES.map((item, idx) => (
            <View key={item.id} style={[s.oneshotRow, idx < ONE_TIME_PURCHASES.length - 1 ? s.oneshotRowBorder : null]}>
              <View style={[s.oneshotIcon, { backgroundColor: item.iconBg }]}>
                <Feather name={item.icon} size={19} color={item.iconColor} />
              </View>
              <View style={s.oneshotInfo}>
                <Text style={s.oneshotName}>{item.name}</Text>
                <Text style={s.oneshotDesc}>{item.desc}</Text>
              </View>
              <View style={s.oneshotPriceCol}>
                <Text style={s.oneshotAmount}>{item.price}</Text>
                <Pressable onPress={() => handlePurchase(item.id)}>
                  <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.oneshotBuy}>
                    <Text style={s.oneshotBuyText}>{item.btnLabel}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.finePrint}>
          Cancel anytime in Account Settings  ·  Prices in USD{'\n'}
          Subscriptions renew automatically. Terms & Privacy apply.
        </Text>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  hostBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.22)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ff7b6b',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  hero: {
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  heroAccent: {
    color: ACCENT,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  tierStrip: {
    flexDirection: 'row',
    gap: 6,
  },
  tierTile: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  tierTileActive: {
    borderColor: 'rgba(255,107,91,0.45)',
    backgroundColor: 'rgba(255,107,91,0.07)',
  },
  tDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tName: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
  },
  tNameActive: {
    color: '#ff8070',
  },
  tPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  tPer: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.28)',
    fontWeight: '500',
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  toggleBtnActive: {},
  toggleGradient: {
    height: 36,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  toggleActiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  toggleInactiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.38)',
  },
  toggleInnerRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  saveBadgeOff: {
    backgroundColor: 'rgba(255,107,91,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.22)',
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  saveBadgeOffText: {
    fontSize: 9,
    fontWeight: '800',
    color: ACCENT,
  },
  saveBadgeOn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  saveBadgeOnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  planCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  planCardRec: {
    borderColor: 'rgba(255,107,91,0.4)',
  },
  planBand: {
    padding: 13,
    paddingHorizontal: 15,
    paddingBottom: 11,
  },
  planBandRec: {
    backgroundColor: 'rgba(255,107,91,0.06)',
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  planName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },
  planNameCoral: {
    color: ACCENT,
  },
  planBadgePopular: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 3,
  },
  planBadgePopularText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  planBadgeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 3,
  },
  planBadgeValueText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,215,0,0.85)',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  priceBig: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  priceNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    marginTop: 3,
    fontWeight: '500',
  },
  savingsTag: {
    color: '#ff8070',
    fontWeight: '700',
  },
  planDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 15,
  },
  planDividerCoral: {
    backgroundColor: 'rgba(255,107,91,0.1)',
  },
  planFeatures: {
    padding: 11,
    paddingHorizontal: 15,
    paddingBottom: 12,
    gap: 7,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featIcon: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featIconOn: {
    backgroundColor: 'rgba(255,107,91,0.14)',
  },
  featIconOff: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  featLabelOn: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
  },
  featLabelOff: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.2)',
    textDecorationLine: 'line-through',
    flex: 1,
  },
  planCTA: {
    marginHorizontal: 15,
    marginBottom: 13,
    height: 42,
    borderRadius: 13,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCTAPrimary: {},
  planCTAOutline: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  planCTAGhost: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ctaGradient: {
    width: '100%',
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextWhite: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#fff',
  },
  ctaTextOutline: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },
  ctaTextGhost: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  oneshotCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  oneshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 15,
  },
  oneshotRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  oneshotIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneshotInfo: {
    flex: 1,
  },
  oneshotName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  oneshotDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 15,
  },
  oneshotPriceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  oneshotAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },
  oneshotBuy: {
    borderRadius: 7,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  oneshotBuyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  finePrint: {
    textAlign: 'center',
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.18)',
    lineHeight: 16,
    paddingBottom: 2,
  },
});
