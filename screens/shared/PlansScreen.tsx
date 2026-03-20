import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Text, ScrollView, Platform } from 'react-native';
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
import { RENTER_PLAN_CONFIGS } from '../../constants/purchaseConfig';
import { RENTER_PLAN_LIMITS, normalizeRenterPlan, type RenterPlan } from '../../constants/renterPlanLimits';

type PlansScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Plans'>;

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ROOMDR_CORAL = '#ff6b5b';
const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';

type BillingCycle = 'monthly' | '3month' | 'annual';

const PLAN_ORDER: RenterPlan[] = ['free', 'plus', 'elite'];

const PRICING: Record<BillingCycle, { plus: number; elite: number }> = {
  monthly: { plus: 14.99, elite: 29.99 },
  '3month': { plus: 40.47, elite: 80.97 },
  annual: { plus: 149.30, elite: 298.70 },
};

const PLAN_ACCENT: Record<RenterPlan, string> = {
  free: '#8E8E93',
  plus: '#6C63FF',
  elite: '#F59E0B',
};

const PLAN_ICON: Record<RenterPlan, string> = {
  free: 'user',
  plus: 'star',
  elite: 'zap',
};

const PLAN_FEATURES: Record<RenterPlan, { icon: string; label: string }[]> = {
  free: [
    { icon: 'repeat', label: '10 swipes per day' },
    { icon: 'users', label: '1 group membership' },
    { icon: 'search', label: 'Basic search filters' },
  ],
  plus: [
    { icon: 'repeat', label: 'Unlimited swipes' },
    { icon: 'users', label: 'Up to 3 group memberships' },
    { icon: 'sliders', label: 'Advanced search filters' },
    { icon: 'heart', label: 'See who liked your profile' },
    { icon: 'check-circle', label: 'Verified profile badge' },
  ],
  elite: [
    { icon: 'repeat', label: 'Unlimited swipes + unlimited groups' },
    { icon: 'bar-chart-2', label: 'Full match breakdown' },
    { icon: 'trending-up', label: 'Profile boost — appear higher in searches' },
    { icon: 'eye', label: 'Read receipts on messages' },
    { icon: 'eye-off', label: 'Incognito mode' },
    { icon: 'headphones', label: 'Dedicated support' },
  ],
};

interface PlanDisplayInfo {
  id: RenterPlan;
  badge: string;
  badgeColor: string;
  subtitle: string;
  isPopular: boolean;
  ctaLabel: string;
  ctaStyle: 'primary' | 'gold' | 'outline';
  icon: string;
  featuresLabel: string;
}

const PLAN_DISPLAY: PlanDisplayInfo[] = [
  {
    id: 'free',
    badge: 'FREE',
    badgeColor: '#888',
    subtitle: 'Get started with the basics',
    isPopular: false,
    ctaLabel: 'Free Forever',
    ctaStyle: 'outline',
    icon: 'user',
    featuresLabel: "What's included",
  },
  {
    id: 'plus',
    badge: 'PLUS',
    badgeColor: '#6C63FF',
    subtitle: 'More swipes, groups, and visibility',
    isPopular: false,
    ctaLabel: 'Subscribe Now',
    ctaStyle: 'primary',
    icon: 'star',
    featuresLabel: 'Everything in Free, plus',
  },
  {
    id: 'elite',
    badge: 'ELITE',
    badgeColor: '#F59E0B',
    subtitle: 'Every advantage in your search',
    isPopular: false,
    ctaLabel: 'Subscribe Now',
    ctaStyle: 'gold',
    icon: 'zap',
    featuresLabel: 'Everything in Plus, plus',
  },
];

export const PlansScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPlus, upgradeToElite, downgradeToPlan, cancelSubscriptionAtPeriodEnd, reactivateSubscription } = useAuth();
  const { processPayment } = useStripePayment();
  const navigation = useNavigation<PlansScreenNavigationProp>();

  const [processing, setProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'downgrade' | 'cancel'; target: 'basic' | 'plus' } | null>(null);

  const currentPlan = normalizeRenterPlan(user?.subscription?.plan);
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

  const handleSelectPlan = (plan: RenterPlan) => {
    if (plan === currentPlan) return;
    if (plan === 'free' && currentPlan !== 'free') {
      handleDowngrade('basic');
      return;
    }
    if (plan === 'plus' && currentPlan === 'elite') {
      handleDowngrade('plus');
      return;
    }
    setSelectedPlan(plan);
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

  const handleDowngrade = (targetPlan: 'basic' | 'plus') => {
    setPendingAction({ type: 'downgrade', target: targetPlan });
  };

  const handleCancel = () => {
    setPendingAction({ type: 'cancel', target: 'basic' });
  };

  const getActionModalConfig = (): PurchaseConfig | null => {
    if (!pendingAction) return null;
    if (pendingAction.type === 'cancel') {
      const expiryDate = user?.subscription?.expiresAt
        ? new Date(user.subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'the end of your billing period';
      return {
        id: 'renter_cancel',
        type: 'subscription',
        title: 'Cancel Subscription',
        targetLabel: 'Free',
        price: '$0',
        priceNote: `active until ${expiryDate}`,
        icon: 'x-circle',
        iconColor: '#EF4444',
        confirmLabel: 'Cancel Subscription',
        disclaimer: `You'll keep your current features until ${expiryDate}, then revert to the Free plan.`,
        perks: [
          '10 swipes per day',
          '1 group membership',
        ],
      };
    }
    const planLabel = pendingAction.target === 'basic' ? 'Free' : 'Plus';
    const targetPlan = pendingAction.target === 'basic' ? 'free' : 'plus';
    const accent = PLAN_ACCENT[targetPlan as RenterPlan];
    const icon = PLAN_ICON[targetPlan as RenterPlan];
    const features = PLAN_FEATURES[targetPlan as RenterPlan];
    return {
      id: `renter_downgrade_${pendingAction.target}`,
      type: 'subscription',
      title: 'Confirm Plan Change',
      targetLabel: planLabel,
      price: pendingAction.target === 'plus' ? `$${getMonthlyRate('plus').toFixed(2)}/mo` : '$0',
      priceNote: pendingAction.target === 'plus' ? 'changes at end of billing period' : 'changes at end of billing period',
      icon,
      iconColor: accent,
      confirmLabel: `Switch to ${planLabel}`,
      disclaimer: `Your plan will change to ${planLabel} at the end of your billing period. You'll keep your current features until then.`,
      perks: features.map(f => f.label),
    };
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setProcessing(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      if (pendingAction.type === 'cancel') {
        await cancelSubscriptionAtPeriodEnd();
        const expiryDate = user?.subscription?.expiresAt
          ? new Date(user.subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'the end of your billing period';
        const successMsg = `You'll keep your features until ${expiryDate}.`;
        if (Platform.OS === 'web') window.alert(successMsg);
        else Alert.alert('Subscription Cancelled', successMsg);
      } else {
        await downgradeToPlan(pendingAction.target);
        const planLabel = pendingAction.target === 'basic' ? 'Free' : 'Plus';
        const successMsg = `Your plan will change to ${planLabel} at the end of your billing period.`;
        if (Platform.OS === 'web') window.alert(successMsg);
        else Alert.alert('Downgrade Scheduled', successMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Something went wrong.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Error', errMsg);
    } finally {
      setProcessing(false);
      setPendingAction(null);
    }
  };

  function getPlanCTA(plan: RenterPlan): string {
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    const targetIndex = PLAN_ORDER.indexOf(plan);
    if (plan === currentPlan) return 'Current Plan';
    if (targetIndex > currentIndex) return 'Upgrade';
    return 'Downgrade';
  }

  const renderPlanCard = (display: PlanDisplayInfo) => {
    const plan = display.id;
    const limits = RENTER_PLAN_LIMITS[plan];
    const accent = PLAN_ACCENT[plan];
    const isCurrent = plan === currentPlan;
    const isPaid = plan !== 'free';
    const features = PLAN_FEATURES[plan];
    const cta = getPlanCTA(plan);

    let price = '$0';
    if (isPaid) {
      const monthlyRate = getMonthlyRate(plan as 'plus' | 'elite');
      price = `$${monthlyRate.toFixed(2)}`;
    }

    let priceSubtext = '';
    if (!isPaid) {
      priceSubtext = 'No credit card required';
    } else if (billingCycle === '3month') {
      const total = getTotalPrice(plan as 'plus' | 'elite');
      priceSubtext = `Billed $${total.toFixed(2)} every 3 months`;
    } else if (billingCycle === 'annual') {
      const total = getTotalPrice(plan as 'plus' | 'elite');
      priceSubtext = `Billed $${total.toFixed(2)}/yr`;
    } else {
      priceSubtext = 'billed monthly';
    }

    return (
      <View
        key={plan}
        style={[
          styles.planCard,
          isCurrent ? { borderColor: accent, borderWidth: 2 } : null,
        ]}
      >
        {isCurrent ? (
          <View style={[styles.currentBanner, { backgroundColor: accent }]}>
            <Feather name="check-circle" size={12} color="#fff" />
            <Text style={styles.currentBannerText}>Your Current Plan</Text>
          </View>
        ) : null}

        {plan === 'elite' && !isCurrent ? (
          <View style={[styles.bestValueBadge, { backgroundColor: '#F59E0B' }]}>
            <Feather name="zap" size={11} color="#fff" />
            <Text style={styles.bestValueBadgeText}>Best Value</Text>
          </View>
        ) : null}

        <View style={styles.cardHeader}>
          <View style={[styles.planIcon, { backgroundColor: accent + '18' }]}>
            <Feather name={PLAN_ICON[plan] as any} size={20} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.planLabel, { color: accent }]}>{limits.label}</Text>
            <Text style={styles.planSubtitle}>
              {isPaid ? `${limits.price} \u00B7 ${priceSubtext}` : 'Always free'}
            </Text>
          </View>
          {isPaid ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.planBigPrice, { color: accent }]}>{price}</Text>
              <Text style={styles.planPricePeriod}>/mo</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.divider, { marginHorizontal: 20 }]} />

        <View style={styles.featureList}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: accent + '18' }]}>
                <Feather name={f.icon as any} size={12} color={accent} />
              </View>
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {isPaid ? (
          <Pressable
            style={[
              styles.ctaBtn,
              {
                backgroundColor: isCurrent ? 'rgba(255,255,255,0.05)' : accent,
                opacity: isCurrent ? 0.6 : 1,
              },
            ]}
            onPress={() => !isCurrent && handleSelectPlan(plan)}
            disabled={isCurrent || processing}
          >
            <Text
              style={[
                styles.ctaBtnText,
                { color: isCurrent ? 'rgba(255,255,255,0.25)' : '#fff' },
              ]}
            >
              {processing && !isCurrent ? 'Processing...' : cta}
            </Text>
            {!isCurrent ? (
              <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: 6 }} />
            ) : null}
          </Pressable>
        ) : null}

        {isCurrent && currentPlan !== 'free' && subscriptionStatus === 'active' && !scheduledPlan ? (
          <View style={styles.manageRow}>
            <Pressable style={[styles.manageBtn, styles.manageBtnCancel]} onPress={handleCancel} disabled={processing}>
              <Text style={styles.manageBtnCancelText}>Cancel Subscription</Text>
            </Pressable>
          </View>
        ) : null}

        {plan === 'free' && currentPlan === 'free' ? (
          <View style={styles.upgradeNudge}>
            <Feather name="info" size={14} color={ROOMDR_CORAL} />
            <Text style={styles.upgradeNudgeText}>
              Plus members match 2.4x faster with unlimited swipes and advanced filters
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
            Find Your Perfect Home.{'\n'}
            <Text style={{ color: ROOMDR_CORAL }}>Match smarter.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Upgrade to get unlimited swipes, more groups,{'\n'}and tools that help you get seen first.
          </Text>
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

        {PLAN_DISPLAY.map(renderPlanCard)}

        <Text style={styles.finePrint}>
          Cancel anytime · No hidden fees{'\n'}
          {billingCycle === 'monthly'
            ? 'Subscriptions renew monthly.'
            : billingCycle === '3month'
              ? 'Subscriptions renew every 3 months.'
              : 'Subscriptions renew annually.'
          } Manage in Account Settings.
        </Text>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {selectedPlan && RENTER_PLAN_CONFIGS[selectedPlan] ? (
        <PurchaseConfirmModal
          visible={!!selectedPlan}
          config={getModalConfig(selectedPlan)}
          currentPlan={RENTER_PLAN_LIMITS[currentPlan].label}
          loading={subscribing}
          onConfirm={handleConfirmSubscription}
          onCancel={() => setSelectedPlan(null)}
        />
      ) : null}

      {pendingAction && getActionModalConfig() ? (
        <PurchaseConfirmModal
          visible={!!pendingAction}
          config={getActionModalConfig()!}
          currentPlan={RENTER_PLAN_LIMITS[currentPlan].label}
          loading={processing}
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
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

  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#242424',
    overflow: 'hidden',
  },
  currentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  currentBannerText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  bestValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    margin: 12,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  bestValueBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  planIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  planLabel: { fontSize: 15, fontWeight: '800' },
  planSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  planBigPrice: { fontSize: 24, fontWeight: '800' },
  planPricePeriod: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  divider: {
    height: 1,
    backgroundColor: '#222',
  },
  featureList: {
    padding: 20,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: 13.5, color: '#ccc', flex: 1, lineHeight: 19 },

  ctaBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700' },

  manageRow: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  manageBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  manageBtnCancel: { borderColor: 'rgba(239,68,68,0.3)' },
  manageBtnCancelText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  upgradeNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 20,
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
