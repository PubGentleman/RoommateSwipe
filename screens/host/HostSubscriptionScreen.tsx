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
import { HOST_PLANS, AGENT_VERIFICATION_FEE, subscriptionFromPlan, calculateHostMonthlyCost } from '../../utils/hostPricing';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GOLD = '#ffd700';
const PURPLE = '#a855f7';

const PLAN_ORDER: HostPlanType[] = ['none', 'starter', 'pro', 'business'];
const PLAN_COLORS: Record<HostPlanType, [string, string]> = {
  none: ['#444', '#333'],
  starter: ['#5b8cff', '#3b6ce8'],
  pro: [PURPLE, '#8b3bd4'],
  business: [GOLD, '#d4a800'],
};

export const HostSubscriptionScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<HostPlanType>('none');
  const [wantsAgentVerification, setWantsAgentVerification] = useState(false);

  useEffect(() => {
    if (!user) return;
    StorageService.getHostSubscription(user.id).then(sub => {
      setHostSub(sub);
      setSelectedPlan(sub.plan);
      setWantsAgentVerification(sub.agentVerificationPaid);
    });
  }, [user]);

  const handleSelectPlan = async (plan: HostPlanType) => {
    if (!user || !hostSub) return;
    if (plan === hostSub.plan) return;

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
      setSelectedPlan(plan);
      await updateUser({
        hostSubscription: {
          ...user.hostSubscription,
          plan: plan === 'none' ? 'starter' as const : plan as 'starter' | 'pro' | 'business',
          status: 'active' as const,
          billingCycle: user.hostSubscription?.billingCycle || 'monthly' as const,
        },
      });
      Alert.alert(
        plan === 'none' ? 'Plan Cancelled' : 'Plan Updated',
        plan === 'none'
          ? 'Your host plan has been cancelled.'
          : `You're now on the ${planData.label} plan!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    };

    if (isDev) {
      Alert.alert(
        'Dev Mode',
        `Payment would process via Stripe: $${planData.price}/mo for ${planData.label}.${wantsAgentVerification && plan === 'business' ? ` + $${AGENT_VERIFICATION_FEE} agent verification.` : ''}`,
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
        {PLAN_ORDER.map(planKey => {
          const plan = HOST_PLANS[planKey];
          const isCurrentPlan = hostSub.plan === planKey;
          const isSelected = selectedPlan === planKey;
          const colors = PLAN_COLORS[planKey];
          const isMostPopular = planKey === 'pro';

          return (
            <Pressable
              key={planKey}
              style={[
                styles.planCard,
                isSelected ? { borderColor: colors[0], borderWidth: 2 } : null,
              ]}
              onPress={() => setSelectedPlan(planKey)}
            >
              {isMostPopular ? (
                <View style={styles.popularBadge}>
                  <Feather name="star" size={10} color={GOLD} />
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              ) : null}

              <View style={styles.planHeader}>
                <LinearGradient colors={colors} style={styles.planIcon}>
                  <Feather
                    name={planKey === 'none' ? 'x' : planKey === 'starter' ? 'home' : planKey === 'pro' ? 'trending-up' : 'briefcase'}
                    size={18}
                    color="#fff"
                  />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.label}</Text>
                  <Text style={styles.planPrice}>
                    {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                  </Text>
                </View>
                {isCurrentPlan ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                ) : null}
              </View>

              {plan.listingsIncluded > 0 ? (
                <View style={styles.listingCap}>
                  <Feather name="layers" size={14} color={colors[0]} />
                  <Text style={[styles.listingCapText, { color: colors[0] }]}>
                    {plan.listingsIncluded} listing{plan.listingsIncluded > 1 ? 's' : ''} included
                  </Text>
                  {planKey === 'business' ? (
                    <Text style={styles.overageText}>+$5/listing after</Text>
                  ) : null}
                </View>
              ) : null}

              {plan.features.length > 0 ? (
                <View style={styles.featureList}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Feather name="check" size={14} color={colors[0]} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noFeaturesText}>
                  No active host features
                </Text>
              )}

              {!isCurrentPlan && isSelected ? (
                <Pressable onPress={() => handleSelectPlan(planKey)}>
                  <LinearGradient colors={colors} style={styles.selectBtn}>
                    <Text style={styles.selectBtnText}>
                      {planKey === 'none' ? 'Cancel Plan' : hostSub.plan === 'none' ? 'Select Plan' : 'Switch Plan'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}

        {selectedPlan === 'business' && !hostSub.agentVerificationPaid ? (
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

        {hostSub.plan !== 'none' ? (
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
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
    gap: 4,
  },
  popularText: { fontSize: 10, fontWeight: '700', color: GOLD },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  planIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  planName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  planPrice: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  currentBadge: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: { fontSize: 11, fontWeight: '700', color: ACCENT },
  listingCap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingLeft: 4,
  },
  listingCapText: { fontSize: 13, fontWeight: '600' },
  overageText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 4 },
  featureList: { gap: 8, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  featureText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 },
  noFeaturesText: { fontSize: 13, color: 'rgba(255,255,255,0.3)', paddingLeft: 4, marginBottom: 14 },
  selectBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
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
