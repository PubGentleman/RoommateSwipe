import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useStripePayment } from '../../hooks/useStripePayment';

const BG = '#111111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';
const GOLD = '#FFD700';

type BillingCycle = 'monthly' | '3month' | 'annual';

interface PlanOption {
  id: string;
  name: string;
  monthlyPrice: number;
  threeMonthPrice: number;
  annualPrice: number;
  badge?: string;
  badgeColor?: string;
  features: { text: string; included: boolean }[];
  isFree?: boolean;
}

const RENTER_PLANS: PlanOption[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 0,
    threeMonthPrice: 0,
    annualPrice: 0,
    isFree: true,
    features: [
      { text: '5 interest cards per day', included: true },
      { text: 'Basic match filters', included: true },
      { text: '10 listing views per day', included: true },
      { text: 'AI roommate assistant', included: false },
      { text: 'See who liked you', included: false },
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 14.99,
    threeMonthPrice: 40.47,
    annualPrice: 149.30,
    badge: 'MOST POPULAR',
    badgeColor: ACCENT,
    features: [
      { text: 'Unlimited interest cards', included: true },
      { text: 'Advanced filters', included: true },
      { text: 'AI roommate assistant', included: true },
      { text: 'See who liked you', included: true },
      { text: '5 rewinds & 3 super likes/day', included: true },
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    monthlyPrice: 29.99,
    threeMonthPrice: 80.97,
    annualPrice: 298.70,
    badge: 'BEST VALUE',
    badgeColor: GOLD,
    features: [
      { text: 'Everything in Plus', included: true },
      { text: 'Weekly profile boost', included: true },
      { text: 'Priority in match results', included: true },
      { text: 'Read receipts in chat', included: true },
      { text: 'Unlimited super likes & rewinds', included: true },
    ],
  },
];

const HOST_PLANS: PlanOption[] = [
  {
    id: 'free',
    name: 'Host Free',
    monthlyPrice: 0,
    threeMonthPrice: 0,
    annualPrice: 0,
    isFree: true,
    features: [
      { text: '1 active listing', included: true },
      { text: 'Basic inquiry management', included: true },
      { text: 'Standard placement in search', included: true },
      { text: 'Renter group browsing', included: false },
      { text: 'AI assistant', included: false },
      { text: 'Listing boosts', included: false },
      { text: 'Verified host badge', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Host Starter',
    monthlyPrice: 19.99,
    threeMonthPrice: 53.97,
    annualPrice: 191.88,
    features: [
      { text: '1 active listing', included: true },
      { text: 'Renter group browsing', included: true },
      { text: 'AI assistant (host modes)', included: true },
      { text: '1 free 24-hr boost/mo', included: true },
      { text: 'Verified host badge', included: true },
    ],
  },
  {
    id: 'pro',
    name: 'Host Pro',
    monthlyPrice: 49.99,
    threeMonthPrice: 134.97,
    annualPrice: 479.88,
    badge: 'MOST POPULAR',
    badgeColor: ACCENT,
    features: [
      { text: 'Up to 5 active listings', included: true },
      { text: 'Priority placement in search', included: true },
      { text: '2 free 72-hr boosts/mo', included: true },
      { text: 'Advanced analytics dashboard', included: true },
      { text: '3 simultaneous boosts', included: true },
    ],
  },
  {
    id: 'business',
    name: 'Host Business',
    monthlyPrice: 99,
    threeMonthPrice: 267.30,
    annualPrice: 948.00,
    badge: 'BEST VALUE',
    badgeColor: GOLD,
    features: [
      { text: 'Up to 15 listings (+$5 overage)', included: true },
      { text: '2 free 7-day boosts/mo', included: true },
      { text: '10 simultaneous boosts', included: true },
      { text: 'Full analytics suite', included: true },
      { text: 'Priority support', included: true },
    ],
  },
];

const getPrice = (plan: PlanOption, cycle: BillingCycle): number => {
  if (cycle === 'monthly') return plan.monthlyPrice;
  if (cycle === '3month') return plan.threeMonthPrice;
  return plan.annualPrice;
};

const getPerMonth = (plan: PlanOption, cycle: BillingCycle): string => {
  if (plan.isFree) return 'Free';
  if (cycle === 'monthly') return `$${plan.monthlyPrice.toFixed(2)}/mo`;
  if (cycle === '3month') return `$${(plan.threeMonthPrice / 3).toFixed(2)}/mo`;
  return `$${(plan.annualPrice / 12).toFixed(2)}/mo`;
};

export const PlanSelectionScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPlus, upgradeToElite, upgradeHostPlan, completeOnboardingStep } = useAuth();
  const { processPayment } = useStripePayment();
  const { alert } = useConfirm();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const isHost = user?.role === 'host';
  const plans = isHost ? HOST_PLANS : RENTER_PLANS;

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan?.isFree) {
      handleConfirmPlan(planId);
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirmPlan = async (planIdOverride?: string) => {
    const planId = planIdOverride || selectedPlanId;
    if (!planId || !user) return;

    const plan = plans.find(p => p.id === planId);
    if (plan?.isFree) {
      setProcessing(true);
      try {
        await completeOnboardingStep('complete');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setShowConfirm(false);
      setProcessing(false);
      return;
    }

    setProcessing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const stripePlan = isHost ? `host_${planId}` : planId;
      const { success, subscriptionId } = await processPayment(user.id, user.email || '', stripePlan, billingCycle);

      if (!success) {
        setProcessing(false);
        setShowConfirm(false);
        return;
      }

      if (isHost) {
        if (planId === 'starter') await upgradeHostPlan('starter', billingCycle);
        else if (planId === 'pro') await upgradeHostPlan('pro', billingCycle);
        else if (planId === 'business') await upgradeHostPlan('business', billingCycle);
      } else {
        if (planId === 'plus') await upgradeToPlus(billingCycle, subscriptionId);
        else if (planId === 'elite') await upgradeToElite(billingCycle, subscriptionId);
      }
      await completeOnboardingStep('complete');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      await alert({ title: 'Welcome!', message: `You're now on the ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan.`, variant: 'success' });
    } catch {
      setProcessing(false);
    }
    setShowConfirm(false);
    setProcessing(false);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Choose Your Plan</Text>
        <Text style={s.headerSub}>
          {isHost ? 'Select a plan to start hosting' : 'Select a plan to start matching'}
        </Text>
      </View>

      <View style={s.cycleRow}>
        {(isHost ? ['monthly', 'annual'] as BillingCycle[] : ['monthly', '3month', 'annual'] as BillingCycle[]).map(cycle => {
          const active = billingCycle === cycle;
          const label = cycle === 'monthly' ? 'Monthly' : cycle === '3month' ? '3 Months' : 'Annual';
          const save = isHost
            ? (cycle === 'annual' ? 'Save 20%' : null)
            : (cycle === '3month' ? 'Save 10%' : cycle === 'annual' ? 'Save 17%' : null);
          return (
            <Pressable
              key={cycle}
              style={[s.cycleBtn, active ? s.cycleBtnActive : null]}
              onPress={() => setBillingCycle(cycle)}
            >
              <Text style={[s.cycleBtnText, active ? s.cycleBtnTextActive : null]}>{label}</Text>
              {save ? <Text style={[s.cycleSave, active ? s.cycleSaveActive : null]}>{save}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {plans.map(plan => {
          const price = getPrice(plan, billingCycle);
          const perMonth = getPerMonth(plan, billingCycle);
          const isRecommended = plan.badge === 'MOST POPULAR';

          return (
            <View key={plan.id} style={[s.planCard, isRecommended ? s.planCardHighlight : null]}>
              {plan.badge ? (
                <View style={[s.badge, { backgroundColor: plan.badgeColor }]}>
                  <Text style={s.badgeText}>{plan.badge}</Text>
                </View>
              ) : null}

              <Text style={s.planName}>{plan.name}</Text>

              <View style={s.priceRow}>
                {plan.isFree ? (
                  <Text style={s.priceMain}>Free</Text>
                ) : (
                  <>
                    <Text style={s.priceMain}>${price.toFixed(2)}</Text>
                    <Text style={s.pricePer}>
                      {billingCycle === 'monthly' ? '/month' : billingCycle === '3month' ? '/3 months' : '/year'}
                    </Text>
                  </>
                )}
              </View>
              {!plan.isFree && billingCycle !== 'monthly' ? (
                <Text style={s.perMonthNote}>{perMonth}</Text>
              ) : null}

              <View style={s.featureList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <Feather
                      name={f.included ? 'check' : 'x'}
                      size={14}
                      color={f.included ? '#34c759' : 'rgba(255,255,255,0.25)'}
                    />
                    <Text style={[s.featureText, !f.included ? s.featureTextDim : null]}>{f.text}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  s.selectBtn,
                  plan.isFree ? s.selectBtnFree : null,
                  isRecommended ? s.selectBtnAccent : null,
                  pressed ? { opacity: 0.8 } : null,
                ]}
                onPress={() => handleSelectPlan(plan.id)}
              >
                {isRecommended ? (
                  <LinearGradient
                    colors={[ACCENT, ACCENT_DARK]}
                    style={s.selectBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={s.selectBtnText}>
                      {plan.isFree ? 'Start Free' : 'Select Plan'}
                    </Text>
                  </LinearGradient>
                ) : (
                  <Text style={[s.selectBtnText, plan.isFree ? s.selectBtnTextFree : null]}>
                    {plan.isFree ? 'Start Free' : 'Select Plan'}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}

        <Text style={s.footer}>
          {isHost
            ? 'You can change your plan anytime from your profile settings.'
            : 'Start with a 7-day free trial on Plus or Elite. Cancel anytime.'}
        </Text>
      </ScrollView>

      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Confirm Your Plan</Text>
            {selectedPlan ? (
              <>
                <Text style={s.modalPlanName}>{selectedPlan.name}</Text>
                <Text style={s.modalPrice}>
                  ${getPrice(selectedPlan, billingCycle).toFixed(2)}
                  {billingCycle === 'monthly' ? '/month' : billingCycle === '3month' ? ' for 3 months' : '/year'}
                </Text>
                <Text style={s.modalNote}>
                  {billingCycle !== 'monthly' ? `(${getPerMonth(selectedPlan, billingCycle)})` : ''}
                </Text>
              </>
            ) : null}

            <Pressable
              style={[s.modalConfirmBtn, processing ? { opacity: 0.6 } : null]}
              onPress={() => handleConfirmPlan()}
              disabled={processing}
            >
              <LinearGradient
                colors={[ACCENT, ACCENT_DARK]}
                style={s.modalConfirmGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalConfirmText}>Confirm & Pay</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              style={s.modalCancelBtn}
              onPress={() => { setShowConfirm(false); setSelectedPlanId(null); }}
            >
              <Text style={s.modalCancelText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  cycleRow: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, backgroundColor: CARD_BG, borderRadius: 12, padding: 4 },
  cycleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  cycleBtnActive: { backgroundColor: 'rgba(255,107,91,0.15)' },
  cycleBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  cycleBtnTextActive: { color: ACCENT },
  cycleSave: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  cycleSaveActive: { color: ACCENT },

  scroll: { flex: 1, paddingHorizontal: 16 },

  planCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  planCardHighlight: { borderColor: 'rgba(255,107,91,0.3)', borderWidth: 1.5 },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  planName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 4 },
  priceMain: { fontSize: 28, fontWeight: '900', color: '#fff' },
  pricePer: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  perMonthNote: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },

  featureList: { marginTop: 14, marginBottom: 16, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  featureTextDim: { color: 'rgba(255,255,255,0.3)' },

  selectBtn: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  selectBtnFree: { backgroundColor: 'rgba(255,255,255,0.06)' },
  selectBtnAccent: { borderWidth: 0 },
  selectBtnGradient: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  selectBtnTextFree: { color: 'rgba(255,255,255,0.7)' },

  footer: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8, marginBottom: 20, paddingHorizontal: 20, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: CARD_BG, borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16 },
  modalPlanName: { fontSize: 16, fontWeight: '700', color: ACCENT, marginBottom: 4 },
  modalPrice: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4 },
  modalNote: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 },
  modalConfirmBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  modalConfirmGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalCancelBtn: { paddingVertical: 12 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});
