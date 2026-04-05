import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, ActivityIndicator, Linking } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useStripePayment } from '../../hooks/useStripePayment';
import { useRevenueCat } from '../../contexts/RevenueCatContext';
import { getHostPlans, HostType } from '../../constants/hostPlansByType';
import { PLAN_LIMITS, COMPANY_PI_LIMITS } from '../../constants/planLimits';

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
  isContactSales?: boolean;
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

function buildHostPlans(hostType: HostType): PlanOption[] {
  const tiers = getHostPlans(hostType);
  return tiers.map((tier, idx) => {
    const isFree = tier.monthlyPrice === 0 && !tier.isContactSales;
    const isLast = idx === tiers.length - 1;
    return {
      id: tier.id,
      name: tier.name,
      monthlyPrice: tier.monthlyPrice,
      threeMonthPrice: tier.threeMonthPrice,
      annualPrice: tier.annualPrice,
      isFree: isFree || undefined,
      badge: tier.recommended ? 'MOST POPULAR' : (isLast && !tier.isContactSales ? 'BEST VALUE' : undefined),
      badgeColor: tier.recommended ? ACCENT : (isLast && !tier.isContactSales ? GOLD : undefined),
      isContactSales: tier.isContactSales,
      features: tier.features.map(f => ({ text: f.label, included: f.included })),
    } as PlanOption;
  });
}

const getPrice = (plan: PlanOption, cycle: BillingCycle): number => {
  if (cycle === 'monthly') return plan.monthlyPrice;
  if (cycle === '3month') return plan.threeMonthPrice;
  return plan.annualPrice;
};

const getPerMonth = (plan: PlanOption, cycle: BillingCycle): string => {
  if (plan.isContactSales) return 'Custom';
  if (plan.isFree) return 'Free';
  if (cycle === 'monthly') return `$${plan.monthlyPrice.toFixed(2)}/mo`;
  if (cycle === '3month') return `$${(plan.threeMonthPrice / 3).toFixed(2)}/mo`;
  return `$${(plan.annualPrice / 12).toFixed(2)}/mo`;
};

const getCompanyMetrics = (planId: string) => {
  const isEnterprise = planId.includes('enterprise');
  const companyKey = isEnterprise ? 'enterprise' : planId.includes('pro') ? 'pro' : planId.includes('starter') ? 'starter' : null;
  const planKey = isEnterprise ? 'company_enterprise' : planId.includes('pro') ? 'company_pro' : planId.includes('starter') ? 'company_starter' : 'free';
  const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
  const seats = companyKey ? COMPANY_PI_LIMITS[companyKey as keyof typeof COMPANY_PI_LIMITS]?.maxTeamMembers : 1;
  return {
    agentSeats: isEnterprise || seats === -1 ? 'Custom' : String(seats ?? 1),
    freeBoosts: isEnterprise ? 'Custom' : String(limits.freeBoostsPerMonth),
    piCalls: isEnterprise ? 'Custom' : (limits.piCallsPerMonth === -1 ? 'Custom' : String(limits.piCallsPerMonth)),
  };
};

const getAgentMetrics = (planId: string) => {
  const key = planId.includes('business') ? 'agent_business'
    : planId.includes('pro') ? 'agent_pro'
    : planId.includes('starter') ? 'agent_starter' : 'free';
  const limits = PLAN_LIMITS[key] || PLAN_LIMITS.free;
  return {
    freeBoosts: String(limits.freeBoostsPerMonth),
    piCalls: limits.piCallsPerMonth === -1 ? 'Custom' : String(limits.piCallsPerMonth),
  };
};

export const PlanSelectionScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPlus, upgradeToElite, upgradeHostPlan, completeOnboardingStep } = useAuth();
  const { processPayment } = useStripePayment();
  const { restore } = useRevenueCat();
  const { alert } = useConfirm();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [restoring, setRestoring] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const isHost = user?.role === 'host' || !!user?.hostType || !!user?.hostTypeLockedAt;
  const hostType = (user?.hostType as HostType) ?? 'individual';
  const plans = useMemo(() => isHost ? buildHostPlans(hostType) : RENTER_PLANS, [isHost, hostType]);

  useEffect(() => {
    if (user?.role === 'host' && user?.hostType === 'individual') {
      completeOnboardingStep('complete');
    }
  }, [user?.role, user?.hostType]);

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
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      } catch (err: any) {
        console.error('[PlanSelection] Free plan activation failed:', err);
        await alert({ title: 'Error', message: err?.message || 'Could not activate your plan. Please try again.', variant: 'warning' });
      } finally {
        setShowConfirm(false);
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const safetyTimeout = setTimeout(() => {
      setProcessing(false);
      setShowConfirm(false);
      alert({ title: 'Timed Out', message: 'Payment is taking too long. Please check your connection and try again.', variant: 'warning' });
    }, 30000);

    try {
      const stripePlan = planId;
      const planType = isHost ? 'host' : 'renter';
      const { success, subscriptionId, error: paymentError } = await processPayment(user.id, user.email || '', stripePlan, billingCycle, planType as any);

      if (!success) {
        clearTimeout(safetyTimeout);
        setProcessing(false);
        setShowConfirm(false);
        await alert({ title: 'Payment Failed', message: paymentError || 'Unable to process payment. Please try again.', variant: 'warning' });
        return;
      }

      if (isHost) {
        await upgradeHostPlan(planId, billingCycle);
      } else {
        if (planId === 'plus') await upgradeToPlus(billingCycle, subscriptionId);
        else if (planId === 'elite') await upgradeToElite(billingCycle, subscriptionId);
      }
      await completeOnboardingStep('complete');
      clearTimeout(safetyTimeout);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      await alert({ title: 'Welcome!', message: `You're now on the ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan.`, variant: 'success' });
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      await alert({ title: 'Error', message: err?.message || 'Something went wrong. Please try again.', variant: 'warning' });
    } finally {
      setShowConfirm(false);
      setProcessing(false);
    }
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
        {(['monthly', '3month', 'annual'] as BillingCycle[]).map(cycle => {
          const active = billingCycle === cycle;
          const label = cycle === 'monthly' ? 'Monthly' : cycle === '3month' ? '3 Months' : 'Annual';
          const save = cycle === '3month' ? 'Save 10%' : cycle === 'annual' ? 'Save 17%' : null;
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
                {plan.isContactSales ? (
                  <>
                    <Text style={s.priceMain}>Custom</Text>
                  </>
                ) : plan.isFree ? (
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
              {plan.isContactSales ? (
                <Text style={s.perMonthNote}>Tailored to your portfolio</Text>
              ) : !plan.isFree && billingCycle !== 'monthly' ? (
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

              {hostType === 'company' ? (() => {
                const m = getCompanyMetrics(plan.id);
                const isEnt = plan.id.includes('enterprise');
                const pillColor = plan.badgeColor || '#888';
                return (
                  <View style={s.metricsRow}>
                    <View style={s.metricPill}>
                      <Feather name="users" size={16} color={pillColor} />
                      <Text style={[s.metricValue, isEnt ? s.metricValueSmall : null]}>{m.agentSeats}</Text>
                      <Text style={s.metricLabel}>Agents</Text>
                    </View>
                    <View style={s.metricPill}>
                      <Feather name="zap" size={16} color={pillColor} />
                      <Text style={[s.metricValue, isEnt ? s.metricValueSmall : null]}>{m.freeBoosts}</Text>
                      <Text style={s.metricLabel}>Free Boosts</Text>
                    </View>
                    <View style={s.metricPill}>
                      <Feather name="message-circle" size={16} color={pillColor} />
                      <Text style={[s.metricValue, isEnt ? s.metricValueSmall : null]}>{m.piCalls}</Text>
                      <Text style={s.metricLabel}>PI Calls/mo</Text>
                    </View>
                  </View>
                );
              })() : null}

              {hostType === 'agent' ? (() => {
                const m = getAgentMetrics(plan.id);
                const pillColor = plan.badgeColor || '#888';
                return (
                  <View style={s.metricsRow}>
                    <View style={s.metricPill}>
                      <Feather name="zap" size={16} color={pillColor} />
                      <Text style={s.metricValue}>{m.freeBoosts}</Text>
                      <Text style={s.metricLabel}>Free Boosts</Text>
                    </View>
                    <View style={s.metricPill}>
                      <Feather name="message-circle" size={16} color={pillColor} />
                      <Text style={s.metricValue}>{m.piCalls}</Text>
                      <Text style={s.metricLabel}>PI Calls/mo</Text>
                    </View>
                  </View>
                );
              })() : null}

              {plan.isContactSales ? (
                <Pressable
                  style={({ pressed }) => [
                    s.selectBtn,
                    { backgroundColor: 'transparent', borderWidth: 1, borderColor: GOLD },
                    pressed ? { opacity: 0.8 } : null,
                  ]}
                  onPress={() => {
                    Linking.openURL('mailto:hello@rhomeapp.io?subject=Enterprise%20Plan%20Inquiry&body=Hi%2C%20I%27m%20interested%20in%20the%20Enterprise%20plan%20for%20my%20company.');
                  }}
                >
                  <Text style={[s.selectBtnText, { color: GOLD }]}>Contact Sales</Text>
                </Pressable>
              ) : (
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
              )}
            </View>
          );
        })}

        <Pressable
          style={[s.restoreBtn, restoring && { opacity: 0.5 }]}
          disabled={restoring}
          onPress={async () => {
            setRestoring(true);
            try {
              const result = await restore();
              if (result.success) {
                await alert({ title: 'Purchases Restored', message: 'Your previous purchases have been restored.', variant: 'success' });
              } else if (result.error) {
                await alert({ title: 'Restore Failed', message: result.error, variant: 'warning' });
              }
            } catch (e) {
              await alert({ title: 'Error', message: 'Could not restore purchases. Please try again.', variant: 'warning' });
            } finally {
              setRestoring(false);
            }
          }}
        >
          <Text style={s.restoreBtnText}>{restoring ? 'Restoring...' : 'Restore Purchases'}</Text>
        </Pressable>

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
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  metricValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  metricValueSmall: {
    fontSize: 14,
  },
  metricLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  selectBtn: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  selectBtnFree: { backgroundColor: 'rgba(255,255,255,0.06)' },
  selectBtnAccent: { borderWidth: 0 },
  selectBtnGradient: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  selectBtnTextFree: { color: 'rgba(255,255,255,0.7)' },

  restoreBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, marginBottom: 4 },
  restoreBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
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
