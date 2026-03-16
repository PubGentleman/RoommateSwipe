import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { HostPlanType, HostSubscriptionData } from '../../types/models';
import { HOST_PLANS, AGENT_VERIFICATION_FEE, subscriptionFromPlan, calculateHostMonthlyCost, isFreePlan } from '../../utils/hostPricing';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GOLD = '#ffd700';
const PURPLE = '#a855f7';

type BillingCycle = 'monthly' | '3month' | 'annual';
type DisplayPlan = 'starter' | 'pro' | 'business';

const BILLING_CYCLES: { key: BillingCycle; label: string; savings?: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: '3month', label: '3 Months', savings: 'SAVE 10%' },
  { key: 'annual', label: 'Annual', savings: 'SAVE 17%' },
];

const PLAN_PILLS: { plan: DisplayPlan; label: string; priceLabel: string }[] = [
  { plan: 'starter', label: 'STARTER', priceLabel: '$0' },
  { plan: 'pro', label: 'PRO', priceLabel: '$29.99' },
  { plan: 'business', label: 'BUSINESS', priceLabel: '$79.99' },
];

const PLAN_SUBTITLES: Record<DisplayPlan, string> = {
  starter: 'No credit card required',
  pro: 'Unlimited inquiries, full analytics & verified badge',
  business: 'Everything in Pro, plus priority placement & bulk tools',
};

function billingPrice(base: number, cycle: BillingCycle): number {
  if (base === 0) return 0;
  if (cycle === '3month') return +(base * 0.9).toFixed(2);
  if (cycle === 'annual') return +(base * 0.83).toFixed(2);
  return base;
}

function billingPeriod(price: number, cycle: BillingCycle): string {
  if (price === 0) return 'forever';
  return '/mo';
}

function resolveCurrentDisplayPlan(plan: HostPlanType): DisplayPlan {
  if (isFreePlan(plan) || plan === 'starter') return 'starter';
  if (plan === 'pro') return 'pro';
  return 'business';
}

export const HostSubscriptionScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPill, setSelectedPill] = useState<DisplayPlan>('pro');

  useEffect(() => {
    if (!user) return;
    StorageService.getHostSubscription(user.id).then(sub => {
      setHostSub(sub);
      const current = resolveCurrentDisplayPlan(sub.plan);
      setSelectedPill(current === 'starter' ? 'pro' : current);
    });
  }, [user]);

  const handleSelectPlan = async (plan: DisplayPlan) => {
    if (!user || !hostSub) return;
    const targetPlan: HostPlanType = plan === 'starter' ? 'free' : plan;
    const currentDisplay = resolveCurrentDisplayPlan(hostSub.plan);
    if (plan === currentDisplay) return;

    const planData = HOST_PLANS[targetPlan];
    const price = billingPrice(planData.price, billingCycle);

    const applyPlan = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newSub = subscriptionFromPlan(targetPlan, hostSub);
      await StorageService.updateHostSubscription(user.id, newSub);
      setHostSub(newSub);
      await updateUser({
        hostSubscription: {
          ...user.hostSubscription,
          plan: isFreePlan(targetPlan) ? 'free' as const : targetPlan as 'starter' | 'pro' | 'business',
          status: 'active' as const,
          billingCycle: billingCycle === '3month' ? 'quarterly' as any : billingCycle === 'annual' ? 'annual' as any : 'monthly' as const,
        },
      });
      Alert.alert(
        plan === 'starter' ? 'Switched to Starter' : 'Plan Updated',
        plan === 'starter'
          ? 'Your host plan has been switched to Starter (Free).'
          : `You're now on the ${planData.label} plan at $${price}/mo!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    };

    if (isDev) {
      Alert.alert(
        'Dev Mode',
        plan === 'starter'
          ? 'Switch to Starter (Free) plan.'
          : `Payment would process via Stripe: $${price}/mo for ${planData.label}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm (Mock)', onPress: applyPlan },
        ]
      );
    } else {
      applyPlan();
    }
  };

  if (!hostSub) return null;

  const currentDisplay = resolveCurrentDisplayPlan(hostSub.plan);

  const renderPlanCard = (plan: DisplayPlan) => {
    const planKey: HostPlanType = plan === 'starter' ? 'free' : plan;
    const planData = HOST_PLANS[planKey];
    const price = billingPrice(planData.price, billingCycle);
    const isCurrentPlan = plan === currentDisplay;
    const isPopular = plan === 'pro';
    const borderColor = isCurrentPlan ? ACCENT : isPopular ? ACCENT : 'rgba(255,255,255,0.06)';

    const ctaText = isCurrentPlan
      ? 'Current Plan'
      : plan === 'starter'
        ? 'Switch to Starter'
        : `Switch to ${planData.label}`;

    return (
      <View
        key={plan}
        style={[
          styles.planCard,
          { borderColor, borderWidth: isCurrentPlan || isPopular ? 1.5 : 1 },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.planName, plan === 'pro' ? { color: ACCENT } : null]}>
            {planData.label}
          </Text>
          {isPopular ? (
            <View style={styles.popularBadge}>
              <Feather name="star" size={10} color="#fff" />
              <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.planPrice}>${price === 0 ? '0' : price.toFixed(2)}</Text>
          <Text style={styles.pricePeriod}>/ {billingPeriod(price, billingCycle)}</Text>
        </View>

        <Text style={styles.planSubtitle}>{PLAN_SUBTITLES[plan]}</Text>

        <View style={styles.divider} />

        <View style={styles.featureList}>
          {planData.features.included.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Feather name="check" size={14} color={ACCENT} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
          {planData.features.locked.map((f, i) => (
            <View key={`locked-${i}`} style={styles.featureRow}>
              <Feather name="x" size={14} color="rgba(255,255,255,0.15)" />
              <Text style={styles.lockedFeatureText}>{f}</Text>
            </View>
          ))}
        </View>

        {plan === 'business' ? (
          <View style={styles.overageNote}>
            <Feather name="alert-circle" size={12} color={GOLD} />
            <Text style={styles.overageNoteText}>+$5/listing/mo after 15 included</Text>
          </View>
        ) : null}

        {isCurrentPlan ? (
          <View style={styles.ctaBtnDisabled}>
            <Text style={styles.ctaBtnDisabledText}>{ctaText}</Text>
          </View>
        ) : (
          <Pressable onPress={() => handleSelectPlan(plan)}>
            <View style={styles.ctaBtnOutlined}>
              <Text style={styles.ctaBtnOutlinedText}>{ctaText}</Text>
            </View>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.hostModeBadge}>
          <Text style={styles.hostModeText}>HOST MODE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Grow Your <Text style={{ color: ACCENT }}>Listings</Text>
          </Text>
          <Text style={styles.heroSubtitle}>Reach more renters and fill vacancies faster</Text>
        </View>

        <View style={styles.pillRow}>
          {PLAN_PILLS.map(p => {
            const isActive = selectedPill === p.plan;
            const isCurrent = p.plan === currentDisplay;
            return (
              <Pressable
                key={p.plan}
                onPress={() => setSelectedPill(p.plan)}
                style={[
                  styles.pill,
                  isActive ? styles.pillActive : null,
                  isCurrent && !isActive ? styles.pillCurrent : null,
                ]}
              >
                <Text style={[styles.pillLabel, isActive ? styles.pillLabelActive : null]}>
                  {p.label}
                </Text>
                {p.plan === 'pro' && isActive ? (
                  <View style={styles.pillDot} />
                ) : null}
                <Text style={[styles.pillPrice, isActive ? styles.pillPriceActive : null]}>
                  {p.priceLabel}
                </Text>
                <Text style={[styles.pillPeriod, isActive ? styles.pillPeriodActive : null]}>
                  {p.plan === 'starter' ? 'forever' : '/mo'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.billingRow}>
          {BILLING_CYCLES.map(bc => {
            const isActive = billingCycle === bc.key;
            return (
              <Pressable
                key={bc.key}
                onPress={() => setBillingCycle(bc.key)}
                style={[styles.billingChip, isActive ? styles.billingChipActive : null]}
              >
                <Text style={[styles.billingChipText, isActive ? styles.billingChipTextActive : null]}>
                  {bc.label}
                </Text>
                {bc.savings ? (
                  <Text style={[styles.billingChipSavings, isActive ? styles.billingChipSavingsActive : null]}>
                    {bc.savings}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {(['starter', 'pro', 'business'] as DisplayPlan[]).map(renderPlanCard)}

        {hostSub.plan === 'business' && !hostSub.agentVerificationPaid ? (
          <Pressable
            style={styles.agentCard}
            onPress={() => {
              if (isDev) {
                Alert.alert(
                  'Agent Verification',
                  `One-time fee of $${AGENT_VERIFICATION_FEE}. Required to list properties on behalf of other owners.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Verify (Mock)',
                      onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        const newSub = { ...hostSub, agentVerificationPaid: true, isVerifiedAgent: true };
                        await StorageService.updateHostSubscription(user!.id, newSub);
                        setHostSub(newSub);
                        Alert.alert('Verified', 'You are now a verified agent.');
                      },
                    },
                  ]
                );
              }
            }}
          >
            <View style={styles.agentHeader}>
              <View style={styles.agentIcon}>
                <Feather name="shield" size={20} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.agentTitle}>Agent Verification</Text>
                <Text style={styles.agentPrice}>${AGENT_VERIFICATION_FEE} one-time</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </View>
            <Text style={styles.agentDesc}>
              Required to list properties on behalf of other owners. Includes verified agent badge.
            </Text>
          </Pressable>
        ) : null}

        {!isFreePlan(hostSub.plan) && hostSub.plan !== 'starter' ? (
          <View style={styles.costSummary}>
            <Text style={styles.costTitle}>Monthly Cost Summary</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Plan base</Text>
              <Text style={styles.costValue}>
                ${billingPrice(HOST_PLANS[hostSub.plan].price, billingCycle).toFixed(2)}
              </Text>
            </View>
            {hostSub.plan === 'business' && hostSub.activeListingCount > hostSub.listingsIncluded ? (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>
                  Overage ({hostSub.activeListingCount - hostSub.listingsIncluded} extra)
                </Text>
                <Text style={[styles.costValue, { color: ACCENT }]}>
                  +${((hostSub.activeListingCount - hostSub.listingsIncluded) * hostSub.overagePerListing).toFixed(2)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.costRow, styles.costTotal]}>
              <Text style={[styles.costLabel, { fontWeight: '700' }]}>Total</Text>
              <Text style={[styles.costValue, { fontWeight: '700', color: '#fff' }]}>
                ${billingPrice(calculateHostMonthlyCost(hostSub.plan, hostSub.activeListingCount), billingCycle).toFixed(2)}/mo
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 100 }} />
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
  hostModeBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hostModeText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 16 },

  heroSection: { marginBottom: 20, marginTop: 4 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },

  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  pillCurrent: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  pillLabelActive: { color: 'rgba(255,255,255,0.7)' },
  pillDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: ACCENT,
    position: 'absolute',
    top: 6,
    right: 6,
  },
  pillPrice: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  pillPriceActive: { color: '#fff' },
  pillPeriod: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 0 },
  pillPeriodActive: { color: 'rgba(255,255,255,0.5)' },

  billingRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 18,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 3,
  },
  billingChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  billingChipActive: {
    backgroundColor: ACCENT,
  },
  billingChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  billingChipTextActive: { color: '#fff' },
  billingChipSavings: { fontSize: 9, fontWeight: '700', color: ACCENT, marginTop: 1 },
  billingChipSavingsActive: { color: 'rgba(255,255,255,0.8)' },

  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  planName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popularBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 4,
  },
  planPrice: { fontSize: 32, fontWeight: '800', color: '#fff' },
  pricePeriod: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  planSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 14, lineHeight: 18 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  featureList: { gap: 10, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 2 },
  featureText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', flex: 1 },
  lockedFeatureText: { fontSize: 14, color: 'rgba(255,255,255,0.25)', flex: 1 },
  overageNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.15)',
  },
  overageNoteText: { fontSize: 12, color: '#FBBF24', fontWeight: '600' },
  ctaBtnOutlined: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ctaBtnOutlinedText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  ctaBtnDisabled: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ctaBtnDisabledText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.25)' },

  agentCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  agentIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  agentTitle: { fontSize: 15, fontWeight: '700', color: GOLD },
  agentPrice: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  agentDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },

  costSummary: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginTop: 6,
  },
  costTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 12 },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  costTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 6,
    paddingTop: 10,
  },
  costLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  costValue: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
