import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { HostPlanType, HostSubscriptionData } from '../../types/models';
import { HOST_PLANS, AGENT_VERIFICATION_FEE, subscriptionFromPlan, calculateHostMonthlyCost, isFreePlan } from '../../utils/hostPricing';
import { PurchaseConfirmModal } from '../../components/modals/PurchaseConfirmModal';
import { HOST_PLAN_CONFIGS, HOST_DOWNGRADE_CONFIG } from '../../constants/purchaseConfig';
import {
  HostType,
  getHostPlanDisplay,
  getHostPlans,
  HOST_TYPE_LABELS,
  openEnterpriseSalesContact,
} from '../../constants/hostPlansByType';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GOLD = '#ffd700';
const PURPLE = '#a855f7';
const ROOMDR_PURPLE = '#7B5EA7';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';

interface PlanDisplayInfo {
  id: HostPlanType;
  subtitle: string;
  badge: string;
  badgeColor: string;
  ctaLabel: string;
  isPopular: boolean;
  ctaStyle: 'outline' | 'primary' | 'gold';
  icon: 'user' | 'home' | 'trending-up' | 'briefcase';
  featuresLabel: string;
}

const DEFAULT_PLAN_DISPLAY: PlanDisplayInfo[] = [
  {
    id: 'free',
    subtitle: 'Just getting started',
    badge: 'Free',
    badgeColor: '#888888',
    ctaLabel: 'Get Started Free',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'user',
    featuresLabel: "What's included",
  },
  {
    id: 'starter',
    subtitle: 'Homeowner with 1 room to fill',
    badge: 'Host',
    badgeColor: '#60A5FA',
    ctaLabel: 'Get Started',
    isPopular: false,
    ctaStyle: 'outline',
    icon: 'home',
    featuresLabel: "What's included",
  },
  {
    id: 'pro',
    subtitle: 'Own 2-5 units or rooms',
    badge: 'Small Landlord',
    badgeColor: '#A78BFA',
    ctaLabel: 'Get Started',
    isPopular: true,
    ctaStyle: 'primary',
    icon: 'trending-up',
    featuresLabel: 'Everything in Starter, plus',
  },
  {
    id: 'business',
    subtitle: 'Landlord or property manager',
    badge: 'Professional',
    badgeColor: '#FBBF24',
    ctaLabel: 'Get Started',
    isPopular: false,
    ctaStyle: 'gold',
    icon: 'briefcase',
    featuresLabel: 'Everything in Pro, plus',
  },
];

function billingPrice(base: number, cycle: BillingCycle): number {
  if (base === 0) return 0;
  if (cycle === 'quarterly') return +(base * 0.9).toFixed(2);
  if (cycle === 'annual') return +(base * 0.8).toFixed(2);
  return base;
}

export const HostSubscriptionScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, updateUser, cancelHostSubscriptionAtPeriodEnd, reactivateHostSubscription, isFirstTimeHost, completeHostOnboarding } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const hostType = (user?.hostType as HostType) ?? 'individual';
  const planDisplayItems = getHostPlanDisplay(hostType);
  const PLAN_DISPLAY: PlanDisplayInfo[] = planDisplayItems.map(d => ({
    id: d.id as HostPlanType,
    subtitle: d.subtitle,
    badge: d.badge,
    badgeColor: d.badgeColor,
    ctaLabel: d.ctaLabel,
    isPopular: d.isPopular,
    ctaStyle: d.ctaStyle,
    icon: d.icon as PlanDisplayInfo['icon'],
    featuresLabel: d.featuresLabel,
  }));
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [processingCancel, setProcessingCancel] = useState(false);

  useEffect(() => {
    if (!user) return;
    StorageService.getHostSubscription(user.id).then(sub => {
      setHostSub(sub);
    });
  }, [user]);

  const handleSelectPlan = async (plan: HostPlanType | string) => {
    if (!user || !hostSub) return;
    const planDisplay = PLAN_DISPLAY.find(d => d.id === plan);
    if (planDisplay?.ctaLabel === 'Contact Sales') {
      openEnterpriseSalesContact();
      return;
    }
    if (isFirstTimeHost && isFreePlan(plan as HostPlanType)) {
      await completeHostOnboarding();
      navigation.goBack();
      return;
    }
    if (plan === hostSub.plan) return;
    if (isFreePlan(plan as HostPlanType) && isFreePlan(hostSub.plan)) return;

    if (isFreePlan(plan as HostPlanType)) {
      setShowDowngradeModal(true);
      return;
    }

    setSelectedPlan(plan);
  };

  const handleCancelHostSub = async () => {
    setShowCancelSheet(false);
    setProcessingCancel(true);
    await cancelHostSubscriptionAtPeriodEnd();
    setProcessingCancel(false);
    const expiryDate = user?.hostSubscription?.expiresAt
      ? new Date(user.hostSubscription.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await showAlert({ title: 'Subscription Cancelled', message: `You'll keep your features until ${expiryDate.toLocaleDateString()}. After that, your plan will switch to Free.`, variant: 'info' });
  };

  const handleReactivateHostSub = async () => {
    setProcessingCancel(true);
    await reactivateHostSubscription();
    setProcessingCancel(false);
  };

  const handleConfirmDowngrade = async () => {
    if (!user || !hostSub) return;
    setDowngrading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newSub = subscriptionFromPlan('free' as HostPlanType, hostSub);
      await StorageService.updateHostSubscription(user.id, newSub);
      setHostSub(newSub);
      await updateUser({
        hostSubscription: {
          ...user.hostSubscription,
          plan: 'free' as const,
          status: 'active' as const,
          billingCycle: 'monthly' as const,
        },
      });
      if (isFirstTimeHost) {
        await completeHostOnboarding();
      }
      setShowDowngradeModal(false);
      navigation.goBack();
    } catch (e) {
      console.error(e);
    } finally {
      setDowngrading(false);
    }
  };

  const handleConfirmSubscription = async () => {
    if (!selectedPlan || !user || !hostSub) return;
    setSubscribing(true);
    try {
      const plan = selectedPlan as HostPlanType;
      const planData = HOST_PLANS[plan];
      const price = billingPrice(planData.price, billingCycle);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newSub = subscriptionFromPlan(plan, hostSub);
      await StorageService.updateHostSubscription(user.id, newSub);
      setHostSub(newSub);
      await updateUser({
        hostSubscription: {
          ...user.hostSubscription,
          plan: plan as 'starter' | 'pro' | 'business',
          status: 'active' as const,
          billingCycle: billingCycle as any,
        },
      });
      if (isFirstTimeHost) {
        await completeHostOnboarding();
      }
      setSelectedPlan(null);
      await StorageService.addNotification({
        id: `notif-host-plan-${plan}-${Date.now()}`,
        userId: user.id,
        type: 'system',
        title: 'Plan Updated',
        body: `You're now on the ${planData.label} plan at $${price}/mo`,
        isRead: false,
        createdAt: new Date(),
        data: { plan },
      });
      const successMsg = `You're now on the ${planData.label} plan at $${price}/mo!`;
      await showAlert({ title: 'Plan Updated', message: successMsg, variant: 'success' });
      navigation.goBack();
    } catch (e) {
      console.error(e);
    } finally {
      setSubscribing(false);
    }
  };

  const handleAgentVerification = async () => {
    if (!user || !hostSub) return;
    if (isDev) {
      const confirmed = await confirm({
        title: 'Agent Verification',
        message: `One-time fee of $${AGENT_VERIFICATION_FEE}. Required to list properties on behalf of other owners.`,
        confirmText: 'Verify (Mock)',
        variant: 'info',
      });
      if (confirmed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const newSub = { ...hostSub, agentVerificationPaid: true, isVerifiedAgent: true };
        await StorageService.updateHostSubscription(user.id, newSub);
        setHostSub(newSub);
        await showAlert({ title: 'Verified', message: 'You are now a verified agent.', variant: 'success' });
      }
    }
  };

  if (!hostSub) return null;

  const currentPlanIsFree = isFreePlan(hostSub.plan);

  const hostTypePlans = getHostPlans(hostType);

  const renderPlanCard = (display: PlanDisplayInfo) => {
    const planKey = display.id;
    const hostPlanConfig = HOST_PLANS[planKey as HostPlanType];
    const typePlanConfig = hostTypePlans.find(p => p.id === planKey);
    const isContactSales = display.ctaLabel === 'Contact Sales';
    const isCurrentPlan = hostSub.plan === planKey || (isFreePlan(hostSub.plan) && isFreePlan(planKey as HostPlanType));

    const planLabel = typePlanConfig?.name ?? hostPlanConfig?.label ?? display.badge;
    const planPrice = isContactSales ? 0 : (hostPlanConfig?.price ?? typePlanConfig?.monthlyPrice ?? 0);
    const price = billingPrice(planPrice, billingCycle);
    const planFeatures = hostPlanConfig?.features ?? { included: typePlanConfig?.features.filter(f => f.included).map(f => f.label) ?? [], locked: typePlanConfig?.features.filter(f => !f.included).map(f => f.label) ?? [] };
    const listingsIncluded = hostPlanConfig?.listingsIncluded ?? 0;

    const ctaText = isContactSales
      ? 'Contact Sales'
      : isCurrentPlan
        ? 'Current Plan'
        : (isFreePlan(planKey as HostPlanType) && !currentPlanIsFree)
          ? 'Downgrade'
          : display.ctaLabel;

    return (
      <View
        key={planKey}
        style={[
          styles.planCard,
          isCurrentPlan ? { borderColor: ROOMDR_PURPLE, borderWidth: 2 } : null,
          display.isPopular ? { borderColor: ROOMDR_PURPLE, borderWidth: 1.5 } : null,
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

        <Text style={styles.planName}>{planLabel}</Text>
        <Text style={styles.planSubtitle}>{display.subtitle}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.planPrice}>
            {isContactSales ? 'Custom' : price === 0 ? '$0' : `$${price}`}
          </Text>
          {isContactSales ? null : <Text style={styles.pricePeriod}>/mo</Text>}
        </View>

        {isContactSales ? (
          <Text style={styles.noCreditCard}>Custom pricing for your organization</Text>
        ) : isFreePlan(planKey as HostPlanType) ? (
          <Text style={styles.noCreditCard}>No credit card required</Text>
        ) : (
          <Text style={styles.noCreditCard}>No overage fees</Text>
        )}

        {planKey === 'business' && hostType === 'individual' ? (
          <View style={styles.overageNote}>
            <Feather name="zap" size={12} color={GOLD} />
            <Text style={styles.overageNoteText}>+$5/listing/mo after 15</Text>
          </View>
        ) : null}

        {!isContactSales ? (
          <View style={styles.listingCap}>
            <Feather name="layers" size={16} color={display.badgeColor} />
            <View>
              <Text style={styles.listingCapStrong}>
                {listingsIncluded === 1 || (listingsIncluded === 0 && isFreePlan(planKey as HostPlanType)) ? '1 Active Listing' : !isFinite(listingsIncluded) || listingsIncluded === 0 ? 'Unlimited Active Listings' : `Up to ${listingsIncluded} Active Listings`}
              </Text>
              <Text style={styles.listingCapSub}>
                {isFreePlan(planKey as HostPlanType) ? 'Post and receive inquiries' :
                 'List as many properties as you need'}
              </Text>
            </View>
          </View>
        ) : null}

        {isCurrentPlan ? (
          <View style={styles.ctaBtnDisabled}>
            <Text style={styles.ctaBtnDisabledText}>{ctaText}</Text>
          </View>
        ) : display.ctaStyle === 'primary' ? (
          <Pressable onPress={() => handleSelectPlan(planKey)}>
            <View style={[styles.ctaBtnPrimary]}>
              <Text style={styles.ctaBtnText}>{ctaText}</Text>
            </View>
          </Pressable>
        ) : display.ctaStyle === 'gold' ? (
          <Pressable onPress={() => handleSelectPlan(planKey)}>
            <LinearGradient colors={['#D97706', '#B45309']} style={styles.ctaBtnGold}>
              <Text style={styles.ctaBtnText}>{ctaText}</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable onPress={() => handleSelectPlan(planKey)}>
            <View style={styles.ctaBtnOutlined}>
              <Text style={styles.ctaBtnOutlinedText}>{ctaText}</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.divider} />

        <Text style={styles.featuresLabel}>{display.featuresLabel}</Text>

        <View style={styles.featureList}>
          {planFeatures.included.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Feather
                name="check"
                size={14}
                color={isFreePlan(planKey as HostPlanType) ? '#555' : planKey.includes('business') || planKey.includes('enterprise') ? GOLD : ROOMDR_PURPLE}
              />
              <Text style={[styles.featureText, isFreePlan(planKey as HostPlanType) ? { color: 'rgba(255,255,255,0.5)' } : null]}>{f}</Text>
            </View>
          ))}
          {planFeatures.locked.map((f, i) => (
            <View key={`locked-${i}`} style={styles.featureRow}>
              <Feather name="x" size={14} color="rgba(255,255,255,0.15)" />
              <Text style={styles.lockedFeatureText}>{f}</Text>
            </View>
          ))}
        </View>

        {isFreePlan(planKey as HostPlanType) && currentPlanIsFree ? (
          <View style={styles.upgradeNudge}>
            <Feather name="info" size={14} color={ROOMDR_PURPLE} />
            <Text style={styles.upgradeNudgeText}>
              Hosts on Starter fill rooms 2.4x faster with renter group access
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
        <View style={styles.heroSection}>
          <View style={styles.heroEyebrow}>
            <Text style={styles.heroEyebrowText}>{hostType === 'agent' ? 'AGENT PLANS' : hostType === 'company' ? 'COMPANY PLANS' : 'HOST PLANS'}</Text>
          </View>
          <Text style={styles.heroTitle}>
            Find great tenants.{'\n'}
            <Text style={{ color: ROOMDR_PURPLE }}>Pay for outcomes.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            {HOST_TYPE_LABELS[hostType] ? `Plans for ${HOST_TYPE_LABELS[hostType]}` : 'From filling one spare room to managing a full portfolio'} - a plan built for how you operate.
          </Text>
        </View>

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
            onPress={() => setBillingCycle('quarterly')}
            style={[styles.billingChip, billingCycle === 'quarterly' ? styles.billingChipActive : null]}
          >
            <Text style={[styles.billingChipText, billingCycle === 'quarterly' ? styles.billingChipTextActive : null]}>
              3 Months
            </Text>
            {billingCycle !== 'quarterly' ? <View style={styles.saveBadgeInline}><Text style={styles.saveBadgeInlineText}>-10%</Text></View> : null}
          </Pressable>
          <Pressable
            onPress={() => setBillingCycle('annual')}
            style={[styles.billingChip, billingCycle === 'annual' ? styles.billingChipActive : null]}
          >
            <Text style={[styles.billingChipText, billingCycle === 'annual' ? styles.billingChipTextActive : null]}>
              Annual
            </Text>
            {billingCycle !== 'annual' ? <View style={styles.saveBadgeInline}><Text style={styles.saveBadgeInlineText}>-20%</Text></View> : null}
          </Pressable>
        </View>

        {PLAN_DISPLAY.map(renderPlanCard)}

        {hostSub.plan === 'business' && !hostSub.agentVerificationPaid ? (
          <Pressable style={styles.agentCard} onPress={handleAgentVerification}>
            <View style={styles.agentHeader}>
              <View style={styles.agentIcon}>
                <Feather name="shield" size={20} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.agentTitle}>Agent Verification Badge</Text>
                <Text style={styles.agentDesc}>
                  Required to list properties on behalf of other owners. Includes verified agent badge.
                </Text>
              </View>
            </View>
            <View style={styles.agentBottom}>
              <Text style={styles.agentPrice}>${AGENT_VERIFICATION_FEE} <Text style={styles.agentPriceSub}>one-time</Text></Text>
              <View style={styles.agentCta}>
                <Text style={styles.agentCtaText}>Get Verified</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {user?.hostSubscription?.status === 'cancelling' || user?.hostSubscription?.status === 'cancelled' ? (
          <View style={styles.cancelledBanner}>
            <View style={styles.cancelledBannerInner}>
              <Feather name="alert-circle" size={18} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelledBannerTitle}>
                  {user.hostSubscription.status === 'cancelled' ? 'Subscription Cancelled' : 'Cancellation Scheduled'}
                </Text>
                <Text style={styles.cancelledBannerDesc}>
                  {user.hostSubscription.scheduledChangeDate
                    ? `Your plan will switch to Free on ${new Date(user.hostSubscription.scheduledChangeDate).toLocaleDateString()}`
                    : 'Your plan will switch to Free at the end of your billing period'}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.reactivateBtn}
              onPress={handleReactivateHostSub}
              disabled={processingCancel}
            >
              <Text style={styles.reactivateBtnText}>{processingCancel ? 'Processing...' : 'Reactivate Plan'}</Text>
            </Pressable>
          </View>
        ) : !isFreePlan(hostSub.plan) ? (
          <Pressable
            style={styles.cancelBtn}
            onPress={() => setShowCancelSheet(true)}
            disabled={processingCancel}
          >
            <Text style={styles.cancelBtnText}>{processingCancel ? 'Processing...' : 'Cancel Subscription'}</Text>
          </Pressable>
        ) : null}

        {!isFreePlan(hostSub.plan) ? (
          <View style={styles.costSummary}>
            <Text style={styles.costTitle}>Monthly Cost Summary</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Plan base</Text>
              <Text style={styles.costValue}>${billingPrice(HOST_PLANS[hostSub.plan].price, billingCycle).toFixed(2)}</Text>
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

        <Pressable
          style={styles.restoreBtn}
          onPress={async () => {
            try {
              const { restorePurchases } = await import('../../lib/revenueCat');
              const result = await restorePurchases();
              if (result.success) {
                await showAlert({ title: 'Purchases Restored', message: 'Your previous purchases have been restored.', variant: 'success' });
              } else if (result.error) {
                await showAlert({ title: 'Restore Failed', message: result.error, variant: 'warning' });
              }
            } catch (e) {
              await showAlert({ title: 'Error', message: 'Could not restore purchases. Please try again.', variant: 'warning' });
            }
          }}
        >
          <Text style={styles.restoreBtnText}>Restore Purchases</Text>
        </Pressable>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {selectedPlan && HOST_PLAN_CONFIGS[selectedPlan] ? (
        <PurchaseConfirmModal
          visible={!!selectedPlan}
          config={HOST_PLAN_CONFIGS[selectedPlan]}
          currentPlan={currentPlanIsFree ? 'Free' : HOST_PLANS[hostSub.plan]?.label ?? 'Free'}
          loading={subscribing}
          onConfirm={handleConfirmSubscription}
          onCancel={() => setSelectedPlan(null)}
        />
      ) : null}

      {hostSub ? (
        <PurchaseConfirmModal
          visible={showDowngradeModal}
          config={HOST_DOWNGRADE_CONFIG}
          currentPlan={HOST_PLANS[hostSub.plan]?.label ?? 'Free'}
          loading={downgrading}
          onConfirm={handleConfirmDowngrade}
          onCancel={() => setShowDowngradeModal(false)}
        />
      ) : null}

      {showCancelSheet ? (
        <View style={styles.cancelOverlay}>
          <Pressable style={styles.cancelOverlayBg} onPress={() => setShowCancelSheet(false)} />
          <View style={styles.cancelSheet}>
            <Feather name="alert-circle" size={28} color="#f59e0b" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.cancelSheetTitle}>Cancel Subscription?</Text>
            <Text style={styles.cancelSheetDesc}>
              Your plan will remain active until the end of your current billing period. After that, it will switch to the Free plan. You can reactivate at any time before then.
            </Text>
            <Pressable style={styles.cancelSheetConfirmBtn} onPress={handleCancelHostSub}>
              <Text style={styles.cancelSheetConfirmText}>Yes, Cancel Plan</Text>
            </Pressable>
            <Pressable style={styles.cancelSheetKeepBtn} onPress={() => setShowCancelSheet(false)}>
              <Text style={styles.cancelSheetKeepText}>Keep My Plan</Text>
            </Pressable>
          </View>
        </View>
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
    backgroundColor: 'rgba(123,94,167,0.18)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  heroEyebrowText: {
    fontSize: 11, fontWeight: '700', color: ROOMDR_PURPLE,
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

  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  billingChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    alignItems: 'center' as const,
  },
  billingChipActive: {
    backgroundColor: ROOMDR_PURPLE,
  },
  billingChipText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  billingChipTextActive: { color: '#fff', fontWeight: '600' },
  saveBadge: {
    backgroundColor: '#16A34A',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saveBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  saveBadgeInline: {
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },
  saveBadgeInlineText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  planCard: {
    backgroundColor: '#161616',
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
    backgroundColor: ROOMDR_PURPLE,
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
  overageNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
  },
  overageNoteText: { fontSize: 12, color: '#FBBF24', fontWeight: '600' },
  listingCap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  listingCapStrong: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 1 },
  listingCapSub: { fontSize: 13, color: '#888' },
  ctaBtnPrimary: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ROOMDR_PURPLE,
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
  lockedFeatureText: { fontSize: 13.5, color: 'rgba(255,255,255,0.2)', flex: 1 },
  upgradeNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(123,94,167,0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.2)',
  },
  upgradeNudgeText: { fontSize: 12, color: ROOMDR_PURPLE, flex: 1, lineHeight: 17 },

  agentCard: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(61,53,0,1)',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  agentIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  agentTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  agentDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  agentBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentPrice: { fontSize: 22, fontWeight: '800', color: GOLD },
  agentPriceSub: { fontSize: 13, fontWeight: '400', color: '#888' },
  agentCta: {
    backgroundColor: 'rgba(217,119,6,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.4)',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  agentCtaText: { fontSize: 14, fontWeight: '700', color: GOLD },

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

  cancelledBanner: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  cancelledBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cancelledBannerTitle: { fontSize: 14, fontWeight: '700', color: '#f59e0b' },
  cancelledBannerDesc: { fontSize: 13, color: '#999', lineHeight: 18 },
  reactivateBtn: {
    backgroundColor: ROOMDR_PURPLE,
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactivateBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  cancelBtn: {
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    marginBottom: 16,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },

  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'underline' as const,
  },

  cancelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  cancelOverlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cancelSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  cancelSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  cancelSheetDesc: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  cancelSheetConfirmBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cancelSheetConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelSheetKeepBtn: {
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelSheetKeepText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
