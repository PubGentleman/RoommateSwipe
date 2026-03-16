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

interface PlanDisplayInfo {
  id: HostPlanType;
  subtitle: string;
  badge: string;
  badgeColor: string;
  ctaLabel: string;
  isPopular: boolean;
  gradientColors: [string, string];
  icon: 'user' | 'home' | 'trending-up' | 'briefcase';
}

const PLAN_DISPLAY: PlanDisplayInfo[] = [
  {
    id: 'free',
    subtitle: 'Just getting started',
    badge: 'Free',
    badgeColor: '#888888',
    ctaLabel: 'Get Started Free',
    isPopular: false,
    gradientColors: ['#666', '#444'],
    icon: 'user',
  },
  {
    id: 'starter',
    subtitle: 'Homeowner with 1 room to fill',
    badge: 'Individual',
    badgeColor: '#60A5FA',
    ctaLabel: 'Get Started',
    isPopular: false,
    gradientColors: ['#5b8cff', '#3b6ce8'],
    icon: 'home',
  },
  {
    id: 'pro',
    subtitle: 'Own 2-5 units or rooms',
    badge: 'Most Popular',
    badgeColor: '#A78BFA',
    ctaLabel: 'Get Started',
    isPopular: true,
    gradientColors: [PURPLE, '#8b3bd4'],
    icon: 'trending-up',
  },
  {
    id: 'business',
    subtitle: 'Landlord or property manager',
    badge: 'Professional',
    badgeColor: '#FBBF24',
    ctaLabel: 'Get Started',
    isPopular: false,
    gradientColors: [GOLD, '#d4a800'],
    icon: 'briefcase',
  },
];

export const HostSubscriptionScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [wantsAgentVerification, setWantsAgentVerification] = useState(false);

  useEffect(() => {
    if (!user) return;
    StorageService.getHostSubscription(user.id).then(sub => {
      setHostSub(sub);
      setWantsAgentVerification(sub.agentVerificationPaid);
    });
  }, [user]);

  const handleSelectPlan = async (plan: HostPlanType) => {
    if (!user || !hostSub) return;
    if (plan === hostSub.plan) return;
    if (isFreePlan(plan) && isFreePlan(hostSub.plan)) return;

    const planData = HOST_PLANS[plan];

    const applyPlan = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newSub = subscriptionFromPlan(plan, hostSub);
      if (wantsAgentVerification && plan === 'business') {
        newSub.agentVerificationPaid = true;
        newSub.isVerifiedAgent = true;
      }
      await StorageService.updateHostSubscription(user.id, newSub);
      setHostSub(newSub);
      await updateUser({
        hostSubscription: {
          ...user.hostSubscription,
          plan: isFreePlan(plan) ? 'free' as const : plan as 'starter' | 'pro' | 'business',
          status: 'active' as const,
          billingCycle: user.hostSubscription?.billingCycle || 'monthly' as const,
        },
      });
      Alert.alert(
        isFreePlan(plan) ? 'Downgraded to Free' : 'Plan Updated',
        isFreePlan(plan)
          ? 'Your host plan has been downgraded to Free.'
          : `You're now on the ${planData.label} plan!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    };

    if (isDev) {
      Alert.alert(
        'Dev Mode',
        isFreePlan(plan)
          ? 'Downgrade to Free plan (no charge).'
          : `Payment would process via Stripe: $${planData.price}/mo for ${planData.label}.${wantsAgentVerification && plan === 'business' ? ` + $${AGENT_VERIFICATION_FEE} agent verification.` : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm (Mock)', onPress: applyPlan },
        ]
      );
    } else {
      applyPlan();
    }
  };

  const handleAgentVerification = async () => {
    if (!user || !hostSub) return;
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
              await StorageService.updateHostSubscription(user.id, newSub);
              setHostSub(newSub);
              setWantsAgentVerification(true);
              Alert.alert('Verified', 'You are now a verified agent.');
            },
          },
        ]
      );
    }
  };

  if (!hostSub) return null;

  const currentPlanIsFree = isFreePlan(hostSub.plan);

  const renderPlanCard = (display: PlanDisplayInfo) => {
    const planKey = display.id;
    const plan = HOST_PLANS[planKey];
    const isCurrentPlan = hostSub.plan === planKey || (isFreePlan(hostSub.plan) && isFreePlan(planKey));
    const isFree = isFreePlan(planKey);
    const colors = display.gradientColors;

    const getCTAStyle = () => {
      if (isCurrentPlan) return 'disabled';
      if (isFree && !currentPlanIsFree) return 'outlined';
      if (isFree && currentPlanIsFree) return 'disabled';
      return 'gradient';
    };

    const ctaStyle = getCTAStyle();
    const ctaText = isCurrentPlan ? 'Current Plan' : (isFree && !currentPlanIsFree) ? 'Downgrade' : display.ctaLabel;

    return (
      <View
        key={planKey}
        style={[
          styles.planCard,
          isCurrentPlan ? { borderColor: colors[0], borderWidth: 2 } : null,
        ]}
      >
        <View style={styles.badgeRow}>
          <View style={[styles.tierBadge, { backgroundColor: `${display.badgeColor}20` }]}>
            <Text style={[styles.tierBadgeText, { color: display.badgeColor }]}>{display.badge}</Text>
          </View>
          {isCurrentPlan ? (
            <View style={styles.currentLabel}>
              <Feather name="check-circle" size={12} color={ACCENT} />
              <Text style={styles.currentLabelText}>Your current plan</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.planHeader}>
          <LinearGradient colors={colors} style={styles.planIcon}>
            <Feather name={display.icon} size={18} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{plan.label}</Text>
            <Text style={styles.planSubtitle}>{display.subtitle}</Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.planPrice}>
            {plan.price === 0 ? '$0' : `$${plan.price}`}
          </Text>
          <Text style={styles.pricePeriod}>/mo</Text>
          {isFree ? (
            <Text style={styles.noCreditCard}>No credit card required</Text>
          ) : null}
        </View>

        {planKey === 'business' ? (
          <View style={styles.overageNote}>
            <Feather name="alert-circle" size={12} color={GOLD} />
            <Text style={styles.overageNoteText}>+$5/listing/mo after 15 included</Text>
          </View>
        ) : null}

        <View style={styles.listingCap}>
          <Feather name="layers" size={14} color={colors[0]} />
          <Text style={[styles.listingCapText, { color: colors[0] }]}>
            {plan.listingsIncluded} listing{plan.listingsIncluded > 1 ? 's' : ''} included
          </Text>
        </View>

        <View style={styles.featureList}>
          {plan.features.included.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Feather name="check" size={14} color={isFree ? '#888' : colors[0]} />
              <Text style={[styles.featureText, isFree ? { color: 'rgba(255,255,255,0.5)' } : null]}>{f}</Text>
            </View>
          ))}
          {plan.features.locked.map((f, i) => (
            <View key={`locked-${i}`} style={styles.featureRow}>
              <Feather name="x" size={14} color="rgba(255,255,255,0.15)" />
              <Text style={styles.lockedFeatureText}>{f}</Text>
            </View>
          ))}
        </View>

        {ctaStyle === 'gradient' ? (
          <Pressable onPress={() => handleSelectPlan(planKey)}>
            <LinearGradient colors={colors} style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>{ctaText}</Text>
            </LinearGradient>
          </Pressable>
        ) : ctaStyle === 'outlined' ? (
          <Pressable onPress={() => handleSelectPlan(planKey)}>
            <View style={styles.ctaBtnOutlined}>
              <Text style={styles.ctaBtnOutlinedText}>{ctaText}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.ctaBtnDisabled}>
            <Text style={styles.ctaBtnDisabledText}>{ctaText}</Text>
          </View>
        )}

        {isFree && currentPlanIsFree ? (
          <View style={styles.upgradeNudge}>
            <Feather name="info" size={14} color={PURPLE} />
            <Text style={styles.upgradeNudgeText}>
              Upgrade to Starter to browse renter groups and fill your room faster
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
        <Text style={styles.headerTitle}>Host Plans</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {PLAN_DISPLAY.map(renderPlanCard)}

        {hostSub.plan === 'business' && !hostSub.agentVerificationPaid ? (
          <Pressable style={styles.agentCard} onPress={handleAgentVerification}>
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

        {!isFreePlan(hostSub.plan) ? (
          <View style={styles.costSummary}>
            <Text style={styles.costTitle}>Monthly Cost Summary</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Plan base</Text>
              <Text style={styles.costValue}>${HOST_PLANS[hostSub.plan].price.toFixed(2)}</Text>
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
                ${calculateHostMonthlyCost(hostSub.plan, hostSub.activeListingCount).toFixed(2)}/mo
              </Text>
            </View>
          </View>
        ) : null}

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
  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '700' },
  currentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentLabelText: { fontSize: 11, fontWeight: '600', color: ACCENT },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  planIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  planName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  planSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 10,
    paddingLeft: 4,
  },
  planPrice: { fontSize: 28, fontWeight: '800', color: '#fff' },
  pricePeriod: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  noCreditCard: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 10, alignSelf: 'center' },
  overageNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.15)',
  },
  overageNoteText: { fontSize: 11, color: '#FBBF24', fontWeight: '600' },
  listingCap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingLeft: 4,
  },
  listingCapText: { fontSize: 13, fontWeight: '600' },
  featureList: { gap: 8, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  featureText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 },
  lockedFeatureText: { fontSize: 13, color: 'rgba(255,255,255,0.2)', flex: 1 },
  ctaBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaBtnOutlined: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ctaBtnOutlinedText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  ctaBtnDisabled: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ctaBtnDisabledText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.25)' },
  upgradeNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  upgradeNudgeText: { fontSize: 12, color: 'rgba(168,85,247,0.8)', flex: 1, lineHeight: 17 },
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
