import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Alert, Modal, Text, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { useStripePayment } from '../../hooks/useStripePayment';

type PlansScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Plans'>;

const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';

const fmtDate = (d: Date | string) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

type BillingCycle = 'monthly' | '3month' | 'annual';

const PRICING: Record<BillingCycle, { plus: number; elite: number }> = {
  monthly: { plus: 14.99, elite: 29.99 },
  '3month': { plus: 40.47, elite: 80.97 },
  annual: { plus: 149.30, elite: 298.70 },
};

const STRIPE_PRICE_IDS: Record<string, string> = {
  plus_monthly: 'price_plus_monthly',
  plus_3month: 'price_plus_3month',
  plus_annual: 'price_plus_annual',
  elite_monthly: 'price_elite_monthly',
  elite_3month: 'price_elite_3month',
  elite_annual: 'price_elite_annual',
};

type Tier = 'basic' | 'plus' | 'elite';

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

export const PlansScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPlus, upgradeToElite, downgradeToPlan, cancelSubscriptionAtPeriodEnd, reactivateSubscription, canSendInterest, canRewind, canSuperLike } = useAuth();
  const { processPayment } = useStripePayment();
  const navigation = useNavigation<PlansScreenNavigationProp>();

  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'elite' | null>(null);
  const [downgradeTo, setDowngradeTo] = useState<'basic' | 'plus' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedTier, setSelectedTier] = useState<Tier>('plus');
  const [interestStats, setInterestStats] = useState<{ remaining: number; total: number }>({ remaining: 5, total: 5 });

  const scrollRef = useRef<ScrollView>(null);
  const cardRefs = useRef<Record<Tier, number>>({} as any);

  const currentPlan = (user?.subscription?.plan || 'basic') as Tier;
  const subscriptionStatus = user?.subscription?.status || 'active';
  const scheduledPlan = user?.subscription?.scheduledPlan;
  const scheduledChangeDate = user?.subscription?.scheduledChangeDate;

  useEffect(() => {
    const loadStats = async () => {
      const result = await canSendInterest();
      if (result.remaining >= 0) {
        setInterestStats({ remaining: result.remaining, total: 5 });
      } else {
        setInterestStats({ remaining: -1, total: -1 });
      }
    };
    loadStats();
  }, []);

  const getTotalPrice = (plan: 'plus' | 'elite') => PRICING[billingCycle][plan];
  const getMonthlyRate = (plan: 'plus' | 'elite') => {
    if (billingCycle === 'monthly') return PRICING.monthly[plan];
    if (billingCycle === '3month') return PRICING['3month'][plan] / 3;
    return PRICING.annual[plan] / 12;
  };
  const getPriceLabel = (plan: 'plus' | 'elite') => {
    const total = getTotalPrice(plan);
    if (billingCycle === 'annual') return `$${total.toFixed(2)}/yr`;
    if (billingCycle === '3month') return `$${total.toFixed(2)}/3mo`;
    return `$${total.toFixed(2)}/mo`;
  };
  const getBillingCtaSuffix = () => {
    if (billingCycle === '3month') return 'Billed Every 3 Months';
    if (billingCycle === 'annual') return 'Billed Annually';
    return 'Billed Monthly';
  };

  const handleUpgrade = (plan: 'plus' | 'elite') => {
    setSelectedPlan(plan);
    setShowUpgradeConfirm(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan || selectedPlan === currentPlan || !user) {
      setShowUpgradeConfirm(false);
      setSelectedPlan(null);
      return;
    }
    setShowUpgradeConfirm(false);
    setProcessing(true);

    try {
      const { success, subscriptionId } = await processPayment(user.id, user.email || '', selectedPlan, billingCycle);
      if (!success) {
        setProcessing(false);
        setSelectedPlan(null);
        return;
      }

      if (selectedPlan === 'plus') await upgradeToPlus(billingCycle, subscriptionId);
      else await upgradeToElite(billingCycle, subscriptionId);
      const planName = selectedPlan === 'plus' ? 'Plus' : 'Elite';
      Alert.alert('Success!', `Welcome to ${planName}! You now have access to all ${planName} features.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    }
    setProcessing(false);
    setSelectedPlan(null);
  };

  const handleDowngrade = (targetPlan: 'basic' | 'plus') => {
    setDowngradeTo(targetPlan);
    setShowDowngradeConfirm(true);
  };

  const confirmDowngrade = async () => {
    if (!downgradeTo) { setShowDowngradeConfirm(false); return; }
    setShowDowngradeConfirm(false);
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    await downgradeToPlan(downgradeTo);
    const expiryDate = user?.subscription?.expiresAt ? fmtDate(user.subscription.expiresAt) : 'the end of your billing period';
    const targetPlanName = downgradeTo.charAt(0).toUpperCase() + downgradeTo.slice(1);
    Alert.alert('Downgrade Scheduled', `Your plan will change to ${targetPlanName} on ${expiryDate}. You'll keep your current features until then.`);
    setProcessing(false);
    setDowngradeTo(null);
  };

  const confirmCancellation = async () => {
    setShowCancelConfirm(false);
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    await cancelSubscriptionAtPeriodEnd();
    const expiryDate = user?.subscription?.expiresAt ? fmtDate(user.subscription.expiresAt) : 'the end of your billing period';
    Alert.alert('Subscription Cancelled', `You'll keep your ${currentPlan === 'plus' ? 'Plus' : 'Elite'} features until ${expiryDate}.`);
    setProcessing(false);
  };

  const rewindInfo = canRewind();
  const superLikeInfo = canSuperLike();
  const interestUsed = interestStats.total > 0 ? interestStats.total - interestStats.remaining : 0;

  const selectTier = (tier: Tier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTier(tier);
    const y = cardRefs.current[tier];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: y - 20, animated: true });
    }
  };

  const renderTierStrip = () => (
    <View style={s.tierStrip}>
      {(['basic', 'plus', 'elite'] as Tier[]).map(tier => {
        const active = selectedTier === tier;
        const isBasic = tier === 'basic';
        const price = isBasic ? '$0' : `$${getMonthlyRate(tier as 'plus' | 'elite').toFixed(2)}`;
        const perLabel = isBasic ? 'forever' : '/mo';
        const showSaveBadge = !isBasic && billingCycle !== 'monthly';
        const saveBadgeLabel = billingCycle === '3month' ? 'SAVE 10%' : 'ANNUAL';
        return (
          <Pressable key={tier} style={[s.tierTile, active && s.tierTileActive]} onPress={() => selectTier(tier)}>
            {active ? <View style={s.tierDot} /> : null}
            <Text style={[s.tierName, active && s.tierNameActive]}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
            <Text style={s.tierPrice}>{price}</Text>
            <Text style={s.tierPer}>{perLabel}</Text>
            {showSaveBadge ? <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.tierSaveBadge}><Text style={s.tierSaveText}>{saveBadgeLabel}</Text></LinearGradient> : null}
          </Pressable>
        );
      })}
    </View>
  );

  const renderToggleOption = (cycle: BillingCycle, label: string, badge?: string) => {
    const active = billingCycle === cycle;
    return (
      <Pressable key={cycle} style={[s.toggleBtn]} onPress={() => setBillingCycle(cycle)}>
        {active ? (
          <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={s.toggleBtnInner}>
              <Text style={s.toggleBtnTextActive}>{label}</Text>
              {badge ? <View style={s.saveBadgeOnActive}><Text style={s.saveBadgeOnActiveText}>{badge}</Text></View> : null}
            </View>
          </LinearGradient>
        ) : (
          <View style={s.toggleBtnInner}>
            <Text style={s.toggleBtnText}>{label}</Text>
            {badge ? <View style={s.saveBadge}><Text style={s.saveBadgeText}>{badge}</Text></View> : null}
          </View>
        )}
      </Pressable>
    );
  };

  const renderBillingToggle = () => (
    <View style={s.billingToggle}>
      {renderToggleOption('monthly', 'Monthly')}
      {renderToggleOption('3month', '3 Months', 'SAVE 10%')}
      {renderToggleOption('annual', 'Annual', 'SAVE 17%')}
    </View>
  );

  const renderUsageCard = () => {
    if (currentPlan !== 'basic') return null;
    const rows = [
      { name: 'Interest Cards', icon: 'heart' as const, color: ACCENT, bgColor: 'rgba(255,107,91,0.11)', used: interestUsed, total: interestStats.total, gradient: [ACCENT, ACCENT_DARK] },
      { name: 'Rewinds', icon: 'rotate-ccw' as const, color: '#78c0ff', bgColor: 'rgba(100,180,255,0.1)', used: rewindInfo.limit - rewindInfo.remaining, total: rewindInfo.limit, gradient: ['#78c0ff', '#4a9eff'] },
      { name: 'Super Likes', icon: 'star' as const, color: '#ffd700', bgColor: 'rgba(255,215,0,0.09)', used: superLikeInfo.limit - superLikeInfo.remaining, total: superLikeInfo.limit, gradient: ['#ffd700', '#e6a800'] },
    ];

    return (
      <View style={s.usageCard}>
        <Text style={s.usageLabelRow}>TODAY'S USAGE</Text>
        {rows.map((row, i) => (
          <View key={i} style={s.usageRow}>
            <View style={[s.usageIcon, { backgroundColor: row.bgColor }]}>
              <Feather name={row.icon} size={13} color={row.color} />
            </View>
            <Text style={s.usageName}>{row.name}</Text>
            <View style={s.usageRight}>
              <Text style={s.usageCount}>{row.used} of {row.total} used</Text>
              <View style={s.usageBar}>
                <LinearGradient
                  colors={row.gradient as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.usageFill, { width: row.total > 0 ? `${Math.min((row.used / row.total) * 100, 100)}%` : '0%' }]}
                />
              </View>
            </View>
          </View>
        ))}
        <Text style={s.usageHint}>Upgrade to Plus or Elite for unlimited daily usage</Text>
      </View>
    );
  };

  const renderPlanCard = (tier: Tier) => {
    const isCurrent = currentPlan === tier;
    const isRec = tier === 'plus';
    const features = FEATURES[tier];
    const isBasic = tier === 'basic';

    let priceText = '$0';
    let periodText = '/ forever';
    let annualNote = isBasic ? 'No credit card required' : '';

    if (!isBasic) {
      const monthlyRate = getMonthlyRate(tier as 'plus' | 'elite');
      priceText = `$${monthlyRate.toFixed(2)}`;
      periodText = '/ mo';
      if (billingCycle === '3month') {
        const total = getTotalPrice(tier as 'plus' | 'elite');
        annualNote = `Billed $${total.toFixed(2)} every 3 months · Save 10%`;
      } else if (billingCycle === 'annual') {
        const total = getTotalPrice(tier as 'plus' | 'elite');
        annualNote = `Billed $${total.toFixed(2)}/yr · Save 17%`;
      } else if (tier === 'plus' && currentPlan === 'basic') {
        annualNote = 'Then $14.99/mo after free trial';
      } else if (tier === 'elite') {
        annualNote = 'Everything you need to find a roommate fast';
      }
    }

    let ctaLabel = '';
    let ctaStyle: 'primary' | 'outline' | 'ghost' = 'outline';
    if (isCurrent) {
      ctaLabel = 'Current Plan';
      ctaStyle = 'ghost';
    } else if (tier === 'plus' && currentPlan === 'basic') {
      ctaLabel = 'Start 7-Day Free Trial';
      ctaStyle = 'primary';
    } else if (tier === 'elite' && currentPlan !== 'elite') {
      ctaLabel = `Upgrade — ${getBillingCtaSuffix()}`;
      ctaStyle = 'outline';
    } else if (tier === 'plus' && currentPlan === 'elite') {
      ctaLabel = 'Downgrade to Plus';
      ctaStyle = 'outline';
    } else if (tier === 'basic') {
      ctaLabel = currentPlan === 'basic' ? 'Current Plan' : 'Downgrade to Basic';
      ctaStyle = currentPlan === 'basic' ? 'ghost' : 'outline';
    } else {
      ctaLabel = `Upgrade — ${getBillingCtaSuffix()}`;
      ctaStyle = 'outline';
    }

    const handleCta = () => {
      if (isCurrent) return;
      if (tier === 'basic' && currentPlan !== 'basic') {
        handleDowngrade('basic');
      } else if (tier === 'plus') {
        if (currentPlan === 'elite') handleDowngrade('plus');
        else handleUpgrade('plus');
      } else if (tier === 'elite') {
        handleUpgrade('elite');
      }
    };

    return (
      <View
        key={tier}
        onLayout={(e) => { cardRefs.current[tier] = e.nativeEvent.layout.y; }}
        style={[s.planCard, isRec && s.planCardRec]}
      >
        <View style={[s.planBand, isRec && s.planBandRec]}>
          <View style={s.planTopRow}>
            {isRec ? (
              <Text style={s.planNameCoral}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
            ) : (
              <Text style={s.planName}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
            )}
            {isRec ? (
              <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.recPill}>
                <Text style={s.recPillText}>MOST POPULAR</Text>
              </LinearGradient>
            ) : tier === 'elite' ? (
              <View style={s.bestValuePill}>
                <Text style={s.bestValueText}>BEST VALUE</Text>
              </View>
            ) : null}
          </View>
          <View style={s.priceRow}>
            <Text style={s.priceBig}>{priceText}</Text>
            <Text style={s.pricePeriod}>{periodText}</Text>
          </View>
          {annualNote ? <Text style={s.priceAnnualNote}>{annualNote}</Text> : null}
        </View>

        <View style={[s.planDivider, isRec && s.planDividerCoral]} />

        <View style={s.planFeatures}>
          {features.map((f, i) => (
            <View key={i} style={s.featRow}>
              <View style={[s.featIcon, f.included ? s.featIconOn : s.featIconOff]}>
                {f.included ? (
                  <Feather name="check" size={8} color={ACCENT} />
                ) : (
                  <Feather name="x" size={8} color="rgba(255,255,255,0.18)" />
                )}
              </View>
              <Text style={[s.featLabel, f.included ? s.featLabelOn : s.featLabelOff]}>{f.text}</Text>
            </View>
          ))}
        </View>

        {isCurrent && currentPlan !== 'basic' && subscriptionStatus === 'active' && !scheduledPlan ? (
          <View style={s.planManageRow}>
            {currentPlan === 'elite' ? (
              <Pressable style={s.manageBtn} onPress={() => handleDowngrade('plus')} disabled={processing}>
                <Text style={s.manageBtnText}>Downgrade to Plus</Text>
              </Pressable>
            ) : null}
            <Pressable style={[s.manageBtn, s.manageBtnCancel]} onPress={() => setShowCancelConfirm(true)} disabled={processing}>
              <Text style={s.manageBtnCancelText}>Cancel Subscription</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={[s.planCta, ctaStyle === 'primary' && s.ctaPrimary, ctaStyle === 'outline' && s.ctaOutline, ctaStyle === 'ghost' && s.ctaGhost]}
          onPress={handleCta}
          disabled={isCurrent || processing}
        >
          {ctaStyle === 'primary' ? (
            <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={[StyleSheet.absoluteFill, { borderRadius: 13 }]} />
          ) : null}
          <Text style={[s.ctaText, ctaStyle === 'primary' && s.ctaTextPrimary, ctaStyle === 'ghost' && s.ctaTextGhost]}>
            {processing && !isCurrent ? 'Processing...' : ctaLabel}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={15} color="rgba(255,255,255,0.65)" />
        </Pressable>
        <Text style={s.headerTitle}>Subscription</Text>
      </View>

      <ScrollView ref={scrollRef} style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={s.hero}>
          <Text style={s.heroTitle}>Choose Your <Text style={s.heroTitleAccent}>Plan</Text></Text>
          <Text style={s.heroSub}>Find your perfect roommate faster with premium</Text>
        </View>

        {currentPlan === 'basic' ? (
          <View style={s.trialBanner}>
            <View style={s.trialIcon}>
              <Feather name="gift" size={17} color="#ff7b6b" />
            </View>
            <View style={s.trialTextWrap}>
              <Text style={s.trialTitle}>Try Plus Free for 7 Days</Text>
              <Text style={s.trialSub}>Unlimited cards, AI matching & advanced filters. Cancel anytime.</Text>
            </View>
          </View>
        ) : null}

        {renderTierStrip()}
        {renderBillingToggle()}
        {renderUsageCard()}

        {scheduledPlan && scheduledChangeDate ? (
          <View style={s.scheduledBanner}>
            <Feather name="info" size={16} color={ACCENT} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.scheduledTitle}>
                {subscriptionStatus === 'cancelled' ? 'Subscription Cancelled' : 'Plan Change Scheduled'}
              </Text>
              <Text style={s.scheduledBody}>
                {subscriptionStatus === 'cancelled'
                  ? `Ends on ${fmtDate(scheduledChangeDate)}. Features remain until then.`
                  : `Changes to ${(scheduledPlan as string).charAt(0).toUpperCase() + (scheduledPlan as string).slice(1)} on ${fmtDate(scheduledChangeDate)}.`
                }
              </Text>
              <Pressable style={s.reactivateBtn} onPress={async () => {
                await reactivateSubscription();
                Alert.alert('Subscription Reactivated', 'Your subscription will continue on the current plan.');
              }}>
                <Text style={s.reactivateBtnText}>{subscriptionStatus === 'cancelled' ? 'Reactivate' : 'Cancel Change'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {renderPlanCard('basic')}
        {renderPlanCard('plus')}
        {renderPlanCard('elite')}

        <Text style={s.finePrint}>
          Cancel anytime in Account Settings  ·  Prices in USD{'\n'}
          Subscription renews automatically. Terms & Privacy apply.
        </Text>
      </ScrollView>

      <Modal visible={showUpgradeConfirm} transparent animationType="fade" onRequestClose={() => setShowUpgradeConfirm(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Upgrade to {selectedPlan === 'plus' ? 'Plus' : 'Elite'}</Text>
            <Text style={s.modalBody}>
              {selectedPlan === 'plus'
                ? `Unlock unlimited interest cards, advanced filters, and AI matching for ${getPriceLabel('plus')}.${currentPlan === 'basic' ? '\n\nIncludes a 7-day free trial!' : ''}`
                : `Get priority visibility, unlimited rewinds, and premium features for ${getPriceLabel('elite')}.`
              }
              {'\n\n'}Continue with upgrade?
            </Text>
            <View style={s.modalActions}>
              <Pressable style={s.modalBtn} onPress={() => { setShowUpgradeConfirm(false); setSelectedPlan(null); }}>
                <Text style={s.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, s.modalBtnPrimary]} onPress={confirmUpgrade}>
                <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                <Text style={s.modalBtnPrimaryText}>Upgrade</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDowngradeConfirm} transparent animationType="fade" onRequestClose={() => setShowDowngradeConfirm(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Downgrade to {downgradeTo === 'basic' ? 'Basic' : 'Plus'}</Text>
            <Text style={s.modalBody}>
              Your plan will change to {downgradeTo === 'basic' ? 'Basic' : 'Plus'} at the end of your billing period.
              {'\n\n'}You'll keep features until {user?.subscription?.expiresAt ? fmtDate(user.subscription.expiresAt) : 'the end of your billing period'}.
            </Text>
            <View style={s.modalActions}>
              <Pressable style={s.modalBtn} onPress={() => { setShowDowngradeConfirm(false); setDowngradeTo(null); }}>
                <Text style={s.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, { backgroundColor: '#F97316' }]} onPress={confirmDowngrade}>
                <Text style={s.modalBtnPrimaryText}>Downgrade</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCancelConfirm} transparent animationType="fade" onRequestClose={() => setShowCancelConfirm(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Cancel Subscription</Text>
            <Text style={s.modalBody}>
              Are you sure? You'll keep features until {user?.subscription?.expiresAt ? fmtDate(user.subscription.expiresAt) : 'the end of your billing period'}, then revert to Basic.
              {'\n\n'}You can re-subscribe at any time.
            </Text>
            <View style={s.modalActions}>
              <Pressable style={s.modalBtn} onPress={() => setShowCancelConfirm(false)}>
                <Text style={s.modalBtnText}>Keep Plan</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, { backgroundColor: '#EF4444' }]} onPress={confirmCancellation}>
                <Text style={s.modalBtnPrimaryText}>Cancel Subscription</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  hero: { marginBottom: 10 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, lineHeight: 28, marginBottom: 4 },
  heroTitleAccent: { color: ACCENT },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  trialBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: 'rgba(255,107,91,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,91,0.22)', borderRadius: 14, padding: 11, paddingHorizontal: 13, marginBottom: 10 },
  trialIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,107,91,0.18)', alignItems: 'center', justifyContent: 'center' },
  trialTextWrap: { flex: 1 },
  trialTitle: { fontSize: 13, fontWeight: '800', color: '#ff7b6b', marginBottom: 2 },
  trialSub: { fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 15 },

  tierStrip: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tierTile: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 10, paddingBottom: 11, alignItems: 'center', gap: 3, position: 'relative' as const },
  tierTileActive: { borderColor: 'rgba(255,107,91,0.45)', backgroundColor: 'rgba(255,107,91,0.07)' },
  tierDot: { position: 'absolute' as const, top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  tierName: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  tierNameActive: { color: '#ff8070' },
  tierPrice: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.5, lineHeight: 22 },
  tierPer: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  tierSaveBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  tierSaveText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  billingToggle: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 4, marginBottom: 10 },
  toggleBtn: { flex: 1, minHeight: 40, borderRadius: 10, overflow: 'hidden' as const, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: {},
  toggleBtnInner: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.38)', textAlign: 'center' as const },
  toggleBtnTextActive: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' as const },
  saveBadge: { backgroundColor: 'rgba(255,107,91,0.15)', borderWidth: 1, borderColor: 'rgba(255,107,91,0.25)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3 },
  saveBadgeText: { fontSize: 8, fontWeight: '800', color: ACCENT },
  saveBadgeOnActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3 },
  saveBadgeOnActiveText: { fontSize: 8, fontWeight: '800', color: '#fff' },

  usageCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 12, paddingHorizontal: 14, marginBottom: 10 },
  usageLabelRow: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  usageIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  usageName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  usageRight: { alignItems: 'flex-end', gap: 4 },
  usageCount: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  usageBar: { width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' as const },
  usageFill: { height: '100%', borderRadius: 99 },
  usageHint: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },

  scheduledBanner: { flexDirection: 'row', backgroundColor: 'rgba(255,107,91,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,91,0.2)', borderRadius: 14, padding: 12, marginBottom: 10 },
  scheduledTitle: { fontSize: 13, fontWeight: '700', color: ACCENT, marginBottom: 3 },
  scheduledBody: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 17 },
  reactivateBtn: { backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginTop: 8, alignSelf: 'flex-start' as const },
  reactivateBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  planCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' as const, marginBottom: 10 },
  planCardRec: { borderColor: 'rgba(255,107,91,0.4)' },
  planBand: { padding: 12, paddingHorizontal: 15, paddingBottom: 11 },
  planBandRec: { backgroundColor: 'rgba(255,107,91,0.06)' },
  planTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  planName: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  planNameCoral: { fontSize: 17, fontWeight: '900', color: ACCENT, letterSpacing: -0.3 },
  recPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3 },
  recPillText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  bestValuePill: { backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3 },
  bestValueText: { fontSize: 9, fontWeight: '800', color: 'rgba(255,215,0,0.7)' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceBig: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -1, lineHeight: 32 },
  pricePeriod: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  priceAnnualNote: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontWeight: '500' },
  planDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 15 },
  planDividerCoral: { backgroundColor: 'rgba(255,107,91,0.1)' },
  planFeatures: { padding: 11, paddingHorizontal: 15, paddingBottom: 13, gap: 7 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featIcon: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  featIconOn: { backgroundColor: 'rgba(255,107,91,0.15)' },
  featIconOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  featLabel: { fontSize: 12, fontWeight: '500' },
  featLabelOn: { color: 'rgba(255,255,255,0.78)' },
  featLabelOff: { color: 'rgba(255,255,255,0.22)', textDecorationLine: 'line-through' as const },
  planManageRow: { paddingHorizontal: 15, paddingBottom: 8, gap: 6 },
  manageBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  manageBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  manageBtnCancel: { borderColor: 'rgba(239,68,68,0.3)' },
  manageBtnCancelText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  planCta: { marginHorizontal: 15, marginBottom: 13, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' as const },
  ctaPrimary: {},
  ctaOutline: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.11)' },
  ctaGhost: { backgroundColor: 'rgba(255,255,255,0.04)' },
  ctaText: { fontSize: 13.5, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2 },
  ctaTextPrimary: { color: '#fff' },
  ctaTextGhost: { color: 'rgba(255,255,255,0.25)' },

  finePrint: { textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.18)', lineHeight: 16, paddingBottom: 10, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 12 },
  modalBody: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalBtnPrimary: { borderWidth: 0, overflow: 'hidden' as const },
  modalBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
