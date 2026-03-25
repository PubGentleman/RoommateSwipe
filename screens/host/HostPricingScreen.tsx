import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useStripePayment } from '../../hooks/useStripePayment';
import { useRevenueCat } from '../../contexts/RevenueCatContext';
import {
  HostType,
  HostPlanTier,
  getHostPlans,
  getPlanOrder,
  HOST_TYPE_LABELS,
  openEnterpriseSalesContact,
} from '../../constants/hostPlansByType';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GOLD = '#ffd700';

type BillingCycle = 'monthly' | '3month' | 'annual';

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

export const HostPricingScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, getHostPlan, upgradeHostPlan, downgradeHostPlan, purchaseListingBoost, purchaseHostVerification, purchaseSuperInterest } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const { processPayment } = useStripePayment();
  const { restore } = useRevenueCat();
  const hostType = (user?.hostType as HostType) ?? 'individual';
  const plans = getHostPlans(hostType);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [restoring, setRestoring] = useState(false);
  const defaultSelected = plans.find(p => p.recommended)?.id ?? plans[1]?.id ?? 'pro';
  const [selectedTier, setSelectedTier] = useState<string>(defaultSelected);
  const currentPlan = getHostPlan();

  const getMonthlyRate = (plan: HostPlanTier) => {
    if (plan.monthlyPrice === 0) return 0;
    if (billingCycle === 'annual') return plan.annualPrice / 12;
    return plan.monthlyPrice;
  };

  const getDisplayPrice = (plan: HostPlanTier) => {
    if (plan.isContactSales) return 'Custom';
    if (plan.monthlyPrice === 0) return '$0';
    return `$${getMonthlyRate(plan).toFixed(2)}`;
  };

  const getStripPer = (plan: HostPlanTier) => {
    if (plan.isContactSales) return '';
    if (plan.monthlyPrice === 0) return 'forever';
    return '/mo';
  };

  const getCardPeriod = (plan: HostPlanTier) => {
    if (plan.isContactSales) return '';
    if (plan.monthlyPrice === 0) return '/ forever';
    return '/ mo';
  };

  const getBillingCtaSuffix = () => {
    if (billingCycle === 'annual') return 'Billed Annually';
    return 'Billed Monthly';
  };

  const handleSelectPlan = async (plan: HostPlanTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (plan.isContactSales) {
      openEnterpriseSalesContact();
      return;
    }
    if (plan.id === currentPlan) {
      await showAlert({ title: 'Current Plan', message: `You are already on the ${plan.name} plan.`, variant: 'info' });
      return;
    }
    if (plan.id === 'free' && currentPlan !== 'free') {
      const confirmed = await confirm({
        title: 'Downgrade to Free',
        message: 'Your current plan benefits will continue until the end of your billing period.',
        confirmText: 'Downgrade',
        variant: 'danger',
      });
      if (confirmed) {
        await downgradeHostPlan('free');
        await showAlert({ title: 'Scheduled', message: 'You will be moved to the Free plan at the end of your billing period.', variant: 'info' });
      }
      return;
    }
    const isUpgrade = getPlanOrder(plan.id) > getPlanOrder(currentPlan);
    let price: string;
    if (billingCycle === 'annual') price = `$${plan.annualPrice.toFixed(2)}/year`;
    else price = `$${plan.monthlyPrice.toFixed(2)}/month`;
    const title = isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`;
    const actionText = isUpgrade ? 'Subscribe' : 'Switch';
    const confirmed = await confirm({
      title,
      message: `${actionText} to ${plan.name} for ${price}?`,
      confirmText: actionText,
      variant: 'info',
    });
    if (confirmed) {
      if (isUpgrade) {
        if (user) {
          const planPrefix = plan.id === 'free' ? '' : plan.id.startsWith('agent_') || plan.id.startsWith('company_') ? plan.id : `host_${plan.id}`;
          const { success } = await processPayment(user.id, user.email || '', planPrefix, billingCycle);
          if (!success) return;
        }
        await upgradeHostPlan(plan.id as any, billingCycle);
      } else {
        await downgradeHostPlan(plan.id as any);
      }
      await showAlert({ title: 'Success', message: `You are now on the ${plan.name} plan!`, variant: 'success' });
    }
  };

  const handlePurchase = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (id === 'boost') {
      const confirmed = await confirm({ title: 'Listing Boost', message: 'Boost a listing for $4.99 (7 days)?', confirmText: 'Purchase', variant: 'info' });
      if (confirmed) {
        purchaseListingBoost('');
        await showAlert({ title: 'Purchased', message: 'Listing Boost activated for 7 days!', variant: 'success' });
      }
    } else if (id === 'verify') {
      const confirmed = await confirm({ title: 'Host Verification', message: 'Get verified for $9.99 (one-time)? You will need to complete ID verification to activate your badge.', confirmText: 'Purchase', variant: 'info' });
      if (confirmed) {
        const result = await purchaseHostVerification();
        if (result.success) {
          const goVerify = await confirm({ title: 'Payment Successful', message: 'Complete your ID verification to activate the Host Verification Badge.', confirmText: 'Verify Now', cancelText: 'Later', variant: 'success' });
          if (goVerify) {
            navigation.navigate('Profile', { screen: 'Verification', params: { fromHostPurchase: true } });
          }
        } else {
          await showAlert({ title: 'Notice', message: result.message, variant: 'info' });
        }
      }
    } else if (id === 'super') {
      const confirmed = await confirm({ title: 'Super Interest', message: 'Purchase Super Interest for $0.99?', confirmText: 'Purchase', variant: 'info' });
      if (confirmed) {
        purchaseSuperInterest();
        await showAlert({ title: 'Purchased', message: 'Super Interest ready to use!', variant: 'success' });
      }
    }
  };

  const getCTAStyle = (plan: HostPlanTier) => {
    if (plan.isContactSales) return 'primary';
    if (plan.id === currentPlan) return 'ghost';
    if (plan.recommended) return 'primary';
    return 'outline';
  };

  const getCTALabel = (plan: HostPlanTier) => {
    if (plan.isContactSales) return 'Contact Sales';
    if (plan.id === currentPlan) return 'Current Plan';
    if (getPlanOrder(plan.id) > getPlanOrder(currentPlan)) return `Upgrade — ${getBillingCtaSuffix()}`;
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
          <Text style={s.heroHostType}>Plans for {HOST_TYPE_LABELS[hostType] ?? 'Hosts'}</Text>
        </View>

        <View style={s.tierStrip}>
          {plans.map(plan => {
            const active = selectedTier === plan.id;
            const showSaveBadge = plan.monthlyPrice > 0 && billingCycle !== 'monthly';
            const saveBadgeLabel = 'SAVE 20%';
            return (
              <Pressable
                key={plan.id}
                style={[s.tierTile, active ? s.tierTileActive : null]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier(plan.id); }}
              >
                {active ? <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.tDot} /> : null}
                <Text style={[s.tName, active ? s.tNameActive : null]}>{plan.name.toUpperCase()}</Text>
                <Text style={s.tPrice}>{getDisplayPrice(plan)}</Text>
                <Text style={s.tPer}>{getStripPer(plan)}</Text>
                {showSaveBadge ? <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.tSaveBadge}><Text style={s.tSaveText}>{saveBadgeLabel}</Text></LinearGradient> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={s.billingToggle}>
          {([
            { cycle: 'monthly' as BillingCycle, label: 'Monthly', badge: undefined },
            { cycle: 'annual' as BillingCycle, label: 'Annual', badge: 'SAVE 20%' },
          ]).map(opt => {
            const active = billingCycle === opt.cycle;
            return (
              <Pressable key={opt.cycle} style={s.toggleBtn} onPress={() => setBillingCycle(opt.cycle)}>
                {active ? (
                  <LinearGradient colors={[ACCENT, '#e83a2a']} style={s.toggleGradient}>
                    <Text style={s.toggleActiveText}>{opt.label}</Text>
                    {opt.badge ? <View style={s.saveBadgeOn}><Text style={s.saveBadgeOnText}>{opt.badge}</Text></View> : null}
                  </LinearGradient>
                ) : (
                  <View style={s.toggleInnerRow}>
                    <Text style={s.toggleInactiveText}>{opt.label}</Text>
                    {opt.badge ? <View style={s.saveBadgeOff}><Text style={s.saveBadgeOffText}>{opt.badge}</Text></View> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {plans.map(plan => {
          const isRec = plan.recommended;
          let priceNote = plan.monthlyNote;
          if (plan.monthlyPrice > 0 && billingCycle === 'annual') {
            priceNote = `Billed $${plan.annualPrice.toFixed(2)}/yr · Save 20%`;
          }
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
                  <Text style={s.priceBig}>{getDisplayPrice(plan)}</Text>
                  <Text style={s.pricePeriod}>{getCardPeriod(plan)}</Text>
                </View>
                <Text style={s.priceNote}>{priceNote}</Text>
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

        <Pressable
          style={[s.restoreBtn, restoring && { opacity: 0.5 }]}
          disabled={restoring}
          onPress={async () => {
            setRestoring(true);
            try {
              const result = await restore();
              if (result.success) {
                await showAlert({ title: 'Purchases Restored', message: 'Your previous purchases have been restored.', variant: 'success' });
              } else if (result.error) {
                await showAlert({ title: 'Restore Failed', message: result.error, variant: 'warning' });
              }
            } catch (e) {
              await showAlert({ title: 'Error', message: 'Could not restore purchases. Please try again.', variant: 'warning' });
            } finally {
              setRestoring(false);
            }
          }}
        >
          <Text style={s.restoreBtnText}>{restoring ? 'Restoring...' : 'Restore Purchases'}</Text>
        </Pressable>

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
  heroHostType: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  tSaveBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  tSaveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
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
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  toggleActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center' as const,
  },
  toggleInactiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center' as const,
  },
  toggleInnerRow: {
    minHeight: 40,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  saveBadgeOff: {
    backgroundColor: 'rgba(255,107,91,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.22)',
    borderRadius: 5,
    paddingVertical: 1,
    paddingHorizontal: 5,
    marginTop: 3,
  },
  saveBadgeOffText: {
    fontSize: 8,
    fontWeight: '800',
    color: ACCENT,
  },
  saveBadgeOn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 5,
    paddingVertical: 1,
    paddingHorizontal: 5,
    marginTop: 3,
  },
  saveBadgeOnText: {
    fontSize: 8,
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
    textDecorationLine: 'underline',
  },
  finePrint: {
    textAlign: 'center',
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.18)',
    lineHeight: 16,
    paddingBottom: 2,
  },
});
