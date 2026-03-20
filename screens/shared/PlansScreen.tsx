import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Text, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { useStripePayment } from '../../hooks/useStripePayment';
import { PurchaseConfirmModal } from '../../components/modals/PurchaseConfirmModal';
import type { PurchaseConfig } from '../../constants/purchaseConfig';

type PlansScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Plans'>;

const BG = '#111';
const CARD_BG = '#161616';
const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';
const ROOMDR_CORAL = '#ff6b5b';

type BillingCycle = 'monthly' | '3month' | 'annual';
type Tier = 'basic' | 'plus' | 'elite';

const PRICING: Record<BillingCycle, { plus: number; elite: number }> = {
  monthly: { plus: 14.99, elite: 29.99 },
  '3month': { plus: 40.47, elite: 80.97 },
  annual: { plus: 149.30, elite: 298.70 },
};

const FEATURES: Record<Tier, { text: string; included: boolean }[]> = {
  basic: [
    { text: '5 interest cards per day', included: true },
    { text: 'Basic match filters', included: true },
    { text: '10 listing views per day', included: true },
    { text: 'AI roommate assistant', included: false },
    { text: 'See who liked you', included: false },
  ],
  plus: [
    { text: 'Unlimited interest cards', included: true },
    { text: 'Advanced filters (lifestyle, schedule)', included: true },
    { text: 'AI roommate assistant', included: true },
    { text: 'See who liked you', included: true },
    { text: '5 rewinds & 3 super likes/day', included: true },
    { text: 'Weekly profile boost', included: false },
  ],
  elite: [
    { text: 'Everything in Plus', included: true },
    { text: 'Weekly profile boost', included: true },
    { text: 'Priority in match results', included: true },
    { text: 'Read receipts in chat', included: true },
    { text: 'Background & income verification', included: true },
    { text: 'Unlimited super likes & rewinds', included: true },
  ],
};

interface PlanDisplayInfo {
  id: Tier;
  badge: string;
  badgeColor: string;
  subtitle: string;
  isPopular: boolean;
  ctaLabel: string;
  ctaStyle: 'primary' | 'gold' | 'outline';
  featuresLabel: string;
}

const PLAN_DISPLAY: PlanDisplayInfo[] = [
  {
    id: 'basic',
    badge: 'FREE',
    badgeColor: '#888',
    subtitle: 'Get started with the basics',
    isPopular: false,
    ctaLabel: 'Free Forever',
    ctaStyle: 'outline',
    featuresLabel: 'WHAT YOU GET',
  },
  {
    id: 'plus',
    badge: 'PLUS',
    badgeColor: ROOMDR_CORAL,
    subtitle: 'Unlock better matching and more features',
    isPopular: true,
    ctaLabel: 'Start 7-Day Free Trial',
    ctaStyle: 'primary',
    featuresLabel: 'EVERYTHING IN BASIC, PLUS',
  },
  {
    id: 'elite',
    badge: 'ELITE',
    badgeColor: '#FFD700',
    subtitle: 'Maximum visibility and premium perks',
    isPopular: false,
    ctaLabel: 'Upgrade to Elite',
    ctaStyle: 'gold',
    featuresLabel: 'EVERYTHING IN PLUS, PLUS',
  },
];

const RENTER_PLAN_CONFIGS: Record<string, PurchaseConfig> = {
  plus: {
    id: 'renter_plus',
    type: 'subscription',
    title: 'Confirm Plan Change',
    targetLabel: 'Plus',
    price: '$14.99/mo',
    priceNote: 'billed monthly',
    icon: 'heart',
    iconColor: ROOMDR_CORAL,
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $14.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Unlimited interest cards',
      'Advanced filters (lifestyle, schedule)',
      'AI roommate assistant',
      'See who liked you',
      '5 rewinds & 3 super likes/day',
    ],
  },
  elite: {
    id: 'renter_elite',
    type: 'subscription',
    title: 'Confirm Plan Change',
    targetLabel: 'Elite',
    price: '$29.99/mo',
    priceNote: 'billed monthly',
    icon: 'star',
    iconColor: '#FFD700',
    confirmLabel: 'Subscribe Now',
    disclaimer: 'You will be charged $29.99 today and monthly after.\nCancel anytime in Account Settings.',
    perks: [
      'Everything in Plus',
      'Weekly profile boost',
      'Priority in match results',
      'Read receipts in chat',
      'Background & income verification',
      'Unlimited super likes & rewinds',
    ],
  },
};

export const PlansScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPlus, upgradeToElite, downgradeToPlan, cancelSubscriptionAtPeriodEnd, reactivateSubscription } = useAuth();
  const { processPayment } = useStripePayment();
  const navigation = useNavigation<PlansScreenNavigationProp>();

  const [processing, setProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const currentPlan = (user?.subscription?.plan || 'basic') as Tier;
  const subscriptionStatus = user?.subscription?.status || 'active';
  const scheduledPlan = user?.subscription?.scheduledPlan;
  const scheduledChangeDate = user?.subscription?.scheduledChangeDate;

  const getMonthlyRate = (plan: 'plus' | 'elite') => {
    if (billingCycle === 'monthly') return PRICING.monthly[plan];
    if (billingCycle === '3month') return PRICING['3month'][plan] / 3;
    return PRICING.annual[plan] / 12;
  };

  const getTotalPrice = (plan: 'plus' | 'elite') => PRICING[billingCycle][plan];

  const getModalConfig = (plan: string): PurchaseConfig => {
    const base = RENTER_PLAN_CONFIGS[plan];
    if (!base) return RENTER_PLAN_CONFIGS.plus;
    const total = getTotalPrice(plan as 'plus' | 'elite');
    const monthlyRate = getMonthlyRate(plan as 'plus' | 'elite');
    let price: string;
    let priceNote: string;
    let disclaimer: string;
    if (billingCycle === '3month') {
      price = `$${total.toFixed(2)}`;
      priceNote = `every 3 months ($${monthlyRate.toFixed(2)}/mo)`;
      disclaimer = `You will be charged $${total.toFixed(2)} today and every 3 months after.\nCancel anytime in Account Settings.`;
    } else if (billingCycle === 'annual') {
      price = `$${total.toFixed(2)}`;
      priceNote = `per year ($${monthlyRate.toFixed(2)}/mo)`;
      disclaimer = `You will be charged $${total.toFixed(2)} today and annually after.\nCancel anytime in Account Settings.`;
    } else {
      price = `$${monthlyRate.toFixed(2)}/mo`;
      priceNote = 'billed monthly';
      disclaimer = `You will be charged $${monthlyRate.toFixed(2)} today and monthly after.\nCancel anytime in Account Settings.`;
    }
    return { ...base, price, priceNote, disclaimer };
  };

  const handleSelectPlan = (tier: Tier) => {
    if (tier === currentPlan) return;
    if (tier === 'basic' && currentPlan !== 'basic') {
      handleDowngrade('basic');
      return;
    }
    if (tier === 'plus' && currentPlan === 'elite') {
      handleDowngrade('plus');
      return;
    }
    setSelectedPlan(tier);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedPlan || !user) return;
    setSubscribing(true);
    try {
      const { success, subscriptionId } = await processPayment(user.id, user.email || '', selectedPlan, billingCycle);
      if (!success) {
        setSubscribing(false);
        setSelectedPlan(null);
        return;
      }
      if (selectedPlan === 'plus') await upgradeToPlus(billingCycle, subscriptionId);
      else await upgradeToElite(billingCycle, subscriptionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedPlan(null);
      const planName = selectedPlan === 'plus' ? 'Plus' : 'Elite';
      Alert.alert('Success!', `Welcome to ${planName}! You now have access to all ${planName} features.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleDowngrade = async (targetPlan: 'basic' | 'plus') => {
    Alert.alert(
      `Downgrade to ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}`,
      `Your plan will change at the end of your billing period. You'll keep features until then.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Downgrade',
          onPress: async () => {
            setProcessing(true);
            try {
              await new Promise(r => setTimeout(r, 1000));
              await downgradeToPlan(targetPlan);
              Alert.alert('Downgrade Scheduled', `Your plan will change to ${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} at the end of your billing period.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Something went wrong.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      `Are you sure? You'll keep features until the end of your billing period, then revert to Basic.`,
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await new Promise(r => setTimeout(r, 1000));
              await cancelSubscriptionAtPeriodEnd();
              const expiryDate = user?.subscription?.expiresAt
                ? new Date(user.subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'the end of your billing period';
              Alert.alert('Subscription Cancelled', `You'll keep your features until ${expiryDate}.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Something went wrong.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const renderPlanCard = (display: PlanDisplayInfo) => {
    const tier = display.id;
    const features = FEATURES[tier];
    const isCurrentPlan = currentPlan === tier;
    const isBasic = tier === 'basic';

    let price = '$0';
    if (!isBasic) {
      const monthlyRate = getMonthlyRate(tier as 'plus' | 'elite');
      price = `$${monthlyRate.toFixed(2)}`;
    }

    let priceSubtext = isBasic ? 'No credit card required' : '';
    if (!isBasic) {
      if (billingCycle === '3month') {
        const total = getTotalPrice(tier as 'plus' | 'elite');
        priceSubtext = `Billed $${total.toFixed(2)} every 3 months \u00B7 Save 10%`;
      } else if (billingCycle === 'annual') {
        const total = getTotalPrice(tier as 'plus' | 'elite');
        priceSubtext = `Billed $${total.toFixed(2)}/yr \u00B7 Save 17%`;
      } else if (tier === 'plus' && currentPlan === 'basic') {
        priceSubtext = 'Includes 7-day free trial';
      } else {
        priceSubtext = 'Everything you need to find a roommate fast';
      }
    }

    const ctaText = isCurrentPlan
      ? 'Current Plan'
      : (isBasic && currentPlan !== 'basic')
        ? 'Downgrade'
        : (tier === 'plus' && currentPlan === 'elite')
          ? 'Downgrade to Plus'
          : display.ctaLabel;

    return (
      <View
        key={tier}
        style={[
          styles.planCard,
          isCurrentPlan ? { borderColor: ROOMDR_CORAL, borderWidth: 2 } : null,
          display.isPopular ? { borderColor: ROOMDR_CORAL, borderWidth: 1.5 } : null,
        ]}
      >
        {display.isPopular ? (
          <View style={styles.popularBadge}>
            <Feather name="star" size={10} color="#fff" />
            <Text style={styles.popularBadgeText}>Most Popular</Text>
          </View>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={[styles.tierBadge, { backgroundColor: `${display.badgeColor}20` }]}>
            <Text style={[styles.tierBadgeText, { color: display.badgeColor }]}>{display.badge}</Text>
          </View>
          {isCurrentPlan ? (
            <View style={styles.currentLabel}>
              <Feather name="check-circle" size={12} color={ACCENT} />
              <Text style={styles.currentLabelText}>Your plan</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.planName}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
        <Text style={styles.planSubtitle}>{display.subtitle}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.planPrice}>{price}</Text>
          <Text style={styles.pricePeriod}>/mo</Text>
        </View>

        <Text style={styles.noCreditCard}>{priceSubtext}</Text>

        {isCurrentPlan ? (
          <View style={styles.ctaBtnDisabled}>
            <Text style={styles.ctaBtnDisabledText}>{ctaText}</Text>
          </View>
        ) : display.ctaStyle === 'primary' ? (
          <Pressable onPress={() => handleSelectPlan(tier)} disabled={processing}>
            <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={styles.ctaBtnPrimary}>
              <Text style={styles.ctaBtnText}>{processing ? 'Processing...' : ctaText}</Text>
            </LinearGradient>
          </Pressable>
        ) : display.ctaStyle === 'gold' ? (
          <Pressable onPress={() => handleSelectPlan(tier)} disabled={processing}>
            <LinearGradient colors={['#D97706', '#B45309']} style={styles.ctaBtnGold}>
              <Text style={styles.ctaBtnText}>{processing ? 'Processing...' : ctaText}</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable onPress={() => handleSelectPlan(tier)} disabled={processing}>
            <View style={styles.ctaBtnOutlined}>
              <Text style={styles.ctaBtnOutlinedText}>{processing ? 'Processing...' : ctaText}</Text>
            </View>
          </Pressable>
        )}

        {isCurrentPlan && currentPlan !== 'basic' && subscriptionStatus === 'active' && !scheduledPlan ? (
          <View style={styles.manageRow}>
            {currentPlan === 'elite' ? (
              <Pressable style={styles.manageBtn} onPress={() => handleDowngrade('plus')} disabled={processing}>
                <Text style={styles.manageBtnText}>Downgrade to Plus</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.manageBtn, styles.manageBtnCancel]} onPress={handleCancel} disabled={processing}>
              <Text style={styles.manageBtnCancelText}>Cancel Subscription</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.featuresLabel}>{display.featuresLabel}</Text>

        <View style={styles.featureList}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Feather
                name={f.included ? 'check' : 'x'}
                size={14}
                color={f.included
                  ? (isBasic ? '#555' : tier === 'elite' ? '#FFD700' : ROOMDR_CORAL)
                  : 'rgba(255,255,255,0.15)'
                }
              />
              <Text style={[styles.featureText, !f.included ? styles.lockedFeatureText : null]}>{f.text}</Text>
            </View>
          ))}
        </View>

        {isBasic && currentPlan === 'basic' ? (
          <View style={styles.upgradeNudge}>
            <Feather name="info" size={14} color={ROOMDR_CORAL} />
            <Text style={styles.upgradeNudgeText}>
              Plus members match 2.4x faster with unlimited interest cards and AI matching
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Renter Plans</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.heroEyebrow}>
            <Text style={styles.heroEyebrowText}>RENTER PLANS</Text>
          </View>
          <Text style={styles.heroTitle}>
            Find your roommate.{'\n'}
            <Text style={{ color: ROOMDR_CORAL }}>Match smarter.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            From casual browsing to power matching — choose the plan that fits your search.
          </Text>
        </View>

        {currentPlan === 'basic' ? (
          <View style={styles.trialBanner}>
            <View style={styles.trialIcon}>
              <Feather name="gift" size={17} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trialTitle}>Try Plus Free for 7 Days</Text>
              <Text style={styles.trialSub}>Unlimited cards, AI matching & advanced filters. Cancel anytime.</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.billingRow}>
          <Pressable
            onPress={() => setBillingCycle('monthly')}
            style={[styles.billingChip, billingCycle === 'monthly' ? styles.billingChipActive : null]}
          >
            <Text style={[styles.billingChipText, billingCycle === 'monthly' ? styles.billingChipTextActive : null]}>
              Monthly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBillingCycle('3month')}
            style={[styles.billingChip, billingCycle === '3month' ? styles.billingChipActive : null]}
          >
            <Text style={[styles.billingChipText, billingCycle === '3month' ? styles.billingChipTextActive : null]}>
              3 Months
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBillingCycle('annual')}
            style={[styles.billingChip, billingCycle === 'annual' ? styles.billingChipActive : null]}
          >
            <Text style={[styles.billingChipText, billingCycle === 'annual' ? styles.billingChipTextActive : null]}>
              Annual
            </Text>
          </Pressable>
          {billingCycle !== 'monthly' ? (
            <View style={styles.savePill}>
              <Text style={styles.savePillText}>{billingCycle === '3month' ? 'Save 10%' : 'Save 17%'}</Text>
            </View>
          ) : null}
        </View>

        {scheduledPlan && scheduledChangeDate ? (
          <View style={styles.scheduledBanner}>
            <Feather name="info" size={16} color={ACCENT} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.scheduledTitle}>
                {subscriptionStatus === 'cancelled' ? 'Subscription Cancelled' : 'Plan Change Scheduled'}
              </Text>
              <Text style={styles.scheduledBody}>
                {subscriptionStatus === 'cancelled'
                  ? `Ends on ${new Date(scheduledChangeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Features remain until then.`
                  : `Changes to ${(scheduledPlan as string).charAt(0).toUpperCase() + (scheduledPlan as string).slice(1)} on ${new Date(scheduledChangeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
                }
              </Text>
              <Pressable style={styles.reactivateBtn} onPress={async () => {
                await reactivateSubscription();
                Alert.alert('Subscription Reactivated', 'Your subscription will continue on the current plan.');
              }}>
                <Text style={styles.reactivateBtnText}>{subscriptionStatus === 'cancelled' ? 'Reactivate' : 'Cancel Change'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {PLAN_DISPLAY.map(renderPlanCard)}

        <Text style={styles.finePrint}>
          Cancel anytime in Account Settings  ·  Prices in USD{'\n'}
          Subscription renews automatically. Terms & Privacy apply.
        </Text>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {selectedPlan && RENTER_PLAN_CONFIGS[selectedPlan] ? (
        <PurchaseConfirmModal
          visible={!!selectedPlan}
          config={getModalConfig(selectedPlan)}
          currentPlan={currentPlan === 'basic' ? 'Basic (Free)' : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
          loading={subscribing}
          onConfirm={handleConfirmSubscription}
          onCancel={() => setSelectedPlan(null)}
        />
      ) : null}
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

  heroSection: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  heroEyebrow: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  heroEyebrowText: {
    fontSize: 11, fontWeight: '700', color: ROOMDR_CORAL,
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 26, fontWeight: '800', color: '#fff',
    textAlign: 'center', lineHeight: 32, marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 10,
  },

  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.22)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  trialIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  trialTitle: { fontSize: 14, fontWeight: '800', color: ACCENT, marginBottom: 2 },
  trialSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 17 },

  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  billingChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
  },
  billingChipActive: {
    backgroundColor: ROOMDR_CORAL,
  },
  billingChipText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  billingChipTextActive: { color: '#fff', fontWeight: '600' },
  savePill: {
    backgroundColor: '#16A34A',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savePillText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  scheduledBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  scheduledTitle: { fontSize: 13, fontWeight: '700', color: ACCENT, marginBottom: 3 },
  scheduledBody: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 17 },
  reactivateBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  reactivateBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#242424',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    left: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ROOMDR_CORAL,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  popularBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  currentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentLabelText: { fontSize: 11, fontWeight: '600', color: ACCENT },
  planName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  planSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 4,
  },
  planPrice: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -2 },
  pricePeriod: { fontSize: 15, color: '#666', fontWeight: '400' },
  noCreditCard: { fontSize: 13, color: '#555', marginBottom: 16 },

  ctaBtnPrimary: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ctaBtnGold: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaBtnOutlined: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#333',
    marginBottom: 20,
  },
  ctaBtnOutlinedText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaBtnDisabled: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  ctaBtnDisabledText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.25)' },

  manageRow: { gap: 6, marginBottom: 16 },
  manageBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  manageBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  manageBtnCancel: { borderColor: 'rgba(239,68,68,0.3)' },
  manageBtnCancelText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  divider: {
    height: 1,
    backgroundColor: '#222',
    marginBottom: 16,
  },
  featuresLabel: {
    fontSize: 11, fontWeight: '700', color: '#555',
    letterSpacing: 1, marginBottom: 12,
  },
  featureList: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 2 },
  featureText: { fontSize: 13.5, color: '#ccc', flex: 1, lineHeight: 19 },
  lockedFeatureText: { color: 'rgba(255,255,255,0.2)' },
  upgradeNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  upgradeNudgeText: { fontSize: 12, color: ROOMDR_CORAL, flex: 1, lineHeight: 17 },

  finePrint: {
    textAlign: 'center',
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.18)',
    lineHeight: 16,
    marginTop: 4,
  },
});
