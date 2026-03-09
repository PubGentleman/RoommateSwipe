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
const GREEN = '#2ecc71';
const GOLD = '#ffd700';

type HostPlan = 'starter' | 'pro' | 'business';

interface PlanTier {
  id: HostPlan;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  recommended?: boolean;
  features: string[];
  icon: keyof typeof Feather.glyphMap;
  gradient: [string, string];
}

const HOST_PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    icon: 'home',
    gradient: ['#555', '#333'],
    features: [
      '1 active listing',
      '5 inquiry responses per month',
      'Basic listing views only',
      'Standard listing placement',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29.99,
    annualPrice: 299.90,
    recommended: true,
    icon: 'star',
    gradient: [ACCENT, '#e83a2a'],
    features: [
      '5 active listings',
      'Unlimited inquiry responses',
      'Full analytics dashboard',
      'Verified host badge',
      'Priority listing placement',
      'Renter compatibility scores',
      'Priority support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 79.99,
    annualPrice: 799.90,
    icon: 'briefcase',
    gradient: ['#ffd700', '#ff9500'],
    features: [
      'Unlimited active listings',
      'Unlimited inquiry responses',
      'Advanced analytics & reports',
      'Featured listing spots',
      'Priority search placement',
      'Dedicated account manager',
      'Custom branding options',
      'API access',
    ],
  },
];

export const HostPricingScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { getHostPlan, upgradeHostPlan, downgradeHostPlan, user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);
  const currentPlan = getHostPlan();

  const getPrice = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return 'Free';
    if (isAnnual) {
      const monthly = plan.annualPrice / 12;
      return `$${monthly.toFixed(2)}`;
    }
    return `$${plan.monthlyPrice.toFixed(2)}`;
  };

  const getBillingLabel = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return 'Forever';
    return isAnnual ? '/mo (billed annually)' : '/mo';
  };

  const getAnnualTotal = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0) return null;
    if (isAnnual) return `$${plan.annualPrice.toFixed(2)}/yr`;
    return null;
  };

  const getSavings = (plan: PlanTier) => {
    if (plan.monthlyPrice === 0 || !isAnnual) return null;
    const monthlyCost = plan.monthlyPrice * 12;
    const saved = monthlyCost - plan.annualPrice;
    return `Save $${saved.toFixed(2)}/yr`;
  };

  const planOrder: Record<HostPlan, number> = { starter: 0, pro: 1, business: 2 };

  const handleSelectPlan = async (plan: PlanTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (plan.id === currentPlan) {
      Alert.alert('Current Plan', `You are already on the ${plan.name} plan.`);
      return;
    }
    if (plan.id === 'starter' && currentPlan !== 'starter') {
      Alert.alert(
        `Downgrade to Starter`,
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
    Alert.alert(
      title,
      `${actionText} to ${plan.name} for ${price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: actionText, onPress: async () => {
          if (isUpgrade) {
            await upgradeHostPlan(plan.id as 'pro' | 'business');
          } else {
            await downgradeHostPlan(plan.id as 'starter' | 'pro');
          }
          Alert.alert('Success', `You are now on the ${plan.name} plan!`);
        }},
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Host Plans</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Choose the plan that fits your hosting needs</Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, !isAnnual ? styles.toggleActive : null]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.toggleText, !isAnnual ? styles.toggleTextActive : null]}>Monthly</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, isAnnual ? styles.toggleActive : null]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.toggleText, isAnnual ? styles.toggleTextActive : null]}>Annual</Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>2 months free</Text>
            </View>
          </Pressable>
        </View>

        {HOST_PLANS.map((plan) => {
          const savings = getSavings(plan);
          const annualTotal = getAnnualTotal(plan);

          return (
            <View key={plan.id} style={[styles.planCard, plan.recommended ? styles.planCardRecommended : null]}>
              {plan.recommended ? (
                <LinearGradient
                  colors={plan.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.recommendedBanner}
                >
                  <Feather name="award" size={12} color="#fff" />
                  <Text style={styles.recommendedText}>RECOMMENDED</Text>
                </LinearGradient>
              ) : null}

              <View style={styles.planHeader}>
                <LinearGradient
                  colors={plan.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.planIcon}
                >
                  <Feather name={plan.icon as any} size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.planTitleCol}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>{getPrice(plan)}</Text>
                    <Text style={styles.planPeriod}>{getBillingLabel(plan)}</Text>
                  </View>
                  {annualTotal ? <Text style={styles.annualTotal}>{annualTotal}</Text> : null}
                  {savings ? <Text style={styles.savingsText}>{savings}</Text> : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {plan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Feather
                      name="check-circle"
                      size={14}
                      color={plan.recommended ? ACCENT : GREEN}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[styles.selectBtn, plan.recommended ? styles.selectBtnRecommended : null, plan.id === currentPlan ? styles.selectBtnCurrent : null]}
                onPress={() => handleSelectPlan(plan)}
              >
                {plan.id === currentPlan ? (
                  <Text style={[styles.selectBtnText, { color: ACCENT }]}>Current Plan</Text>
                ) : plan.recommended ? (
                  <LinearGradient
                    colors={plan.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.selectBtnGradient}
                  >
                    <Text style={styles.selectBtnTextWhite}>
                      {planOrder[plan.id] > planOrder[currentPlan] ? 'Upgrade' : 'Switch'}
                    </Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.selectBtnText}>
                    {planOrder[plan.id] > planOrder[currentPlan] ? 'Upgrade' : planOrder[plan.id] < planOrder[currentPlan] ? 'Downgrade' : 'Get Started'}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Feather name="shield" size={14} color="rgba(255,255,255,0.3)" />
          <Text style={styles.footerText}>Cancel anytime. No hidden fees.</Text>
        </View>
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  toggleTextActive: {
    color: ACCENT,
  },
  saveBadge: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  saveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: GREEN,
  },
  planCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  planCardRecommended: {
    borderColor: 'rgba(255,107,91,0.35)',
    borderWidth: 1.5,
  },
  recommendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: -18,
    marginHorizontal: -18,
    marginBottom: 14,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleCol: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  planPeriod: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
  },
  annualTotal: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 1,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
    marginTop: 2,
  },
  featureList: {
    gap: 10,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    flex: 1,
  },
  selectBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectBtnCurrent: {
    borderColor: ACCENT,
    borderWidth: 1.5,
  },
  selectBtnRecommended: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  selectBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingVertical: 14,
  },
  selectBtnTextWhite: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});
