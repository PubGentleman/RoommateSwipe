import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { applyForAffiliate, getAffiliateForUser, COMMISSION_TABLE } from '../../services/affiliateService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const SURFACE = '#1a1a1a';
const ACCENT = '#f59e0b';

const EARNINGS_EXAMPLES = [
  { label: 'Refer a Plus renter', amount: '$6.99' },
  { label: 'Refer a Pro host', amount: '$34.99' },
  { label: 'Refer a Business agent', amount: '$104.30' },
];

const TERMS_TEXT = `ROOMMATESWIPE AFFILIATE PROGRAM
TERMS & CONDITIONS

Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

1. PROGRAM OVERVIEW

The RoommateSwipe Affiliate Program ("Program") allows registered users ("Affiliates") to earn referral commissions by referring new users to the RoommateSwipe platform. By participating in this Program, you agree to be bound by these Terms & Conditions.

2. ELIGIBILITY

To participate in the Program, you must:
  a) Be a registered RoommateSwipe user in good standing
  b) Have an active account with a verified email address
  c) Be at least 18 years of age
  d) Not have been previously removed from the Program for violations

3. REFERRAL CODE

Upon acceptance into the Program, you will receive a unique referral code ("Code") linked directly to your account. You may share this Code through personal channels, social media, word of mouth, or other lawful means. You may NOT:
  a) Use paid advertising that bids on RoommateSwipe branded keywords
  b) Misrepresent yourself as a RoommateSwipe employee or official representative
  c) Send unsolicited bulk messages (spam) containing your Code
  d) Create fake accounts to generate referral commissions
  e) Offer cashback, rebates, or kickbacks from your commission to incentivize signups

4. COMMISSION STRUCTURE

  a) You will earn a one-time commission equal to 70% of the referred user's first monthly plan cost when they subscribe to any paid plan.
  b) Commission is earned only when the referred user:
     - Signs up using your unique referral Code or link
     - Subscribes to a paid plan (free/basic plans do not qualify)
     - Maintains their paid subscription for at least 31 consecutive days (ensuring at least 2 billing cycles are completed)
  c) Commission amounts by plan:

     RENTER PLANS:
     - Plus ($9.99/mo): You earn $6.99
     - Elite ($19.99/mo): You earn $13.99

     HOST PLANS:
     - Starter ($19.99/mo): You earn $13.99
     - Pro ($49.99/mo): You earn $34.99
     - Business ($99.99/mo): You earn $69.99

     AGENT PLANS:
     - Agent Starter ($49/mo): You earn $34.30
     - Agent Pro ($99/mo): You earn $69.30
     - Agent Business ($149/mo): You earn $104.30

  d) If the referred user signs up on an annual or multi-month plan, the commission is calculated based on the equivalent monthly rate.
  e) Commissions are one-time per referred user. You do not earn recurring commissions on renewals.

5. PAYMENT

  a) Commissions become payable 31 days after the referred user's paid subscription begins ("Qualification Period"). This ensures the platform captures at least two full billing cycles before any commission is paid out.
  b) If the referred user cancels, requests a refund, or downgrades to a free plan within the 31-day Qualification Period, the commission is forfeited.
  c) Commissions are paid via your selected payout method (bank transfer, PayPal, or in-app credit).
  d) Minimum payout threshold: $10.00. Commissions below this amount accumulate until the threshold is met.
  e) Payouts are processed on the 1st and 15th of each month for all qualified commissions.

6. TRACKING & ATTRIBUTION

  a) A referral is attributed to your account when a new user enters your Code during signup or uses your unique referral link.
  b) Referral attribution expires after 30 days. If a user clicks your link but does not sign up within 30 days, the referral is not credited.
  c) If a user enters multiple referral codes, only the first code entered will be credited.
  d) You can track your referrals, pending commissions, and earnings in the Affiliate Dashboard within the app.

7. RESTRICTIONS

  a) Self-referrals are prohibited. You may not refer your own accounts or accounts you control.
  b) Referrals from the same household or IP address may be flagged for review.
  c) RoommateSwipe reserves the right to withhold or reverse commissions if fraud, manipulation, or abuse is detected.
  d) You may not create content that is misleading, defamatory, or harmful to the RoommateSwipe brand.

8. TERMINATION

  a) You may leave the Program at any time by deactivating your affiliate status in the app.
  b) RoommateSwipe may suspend or terminate your participation at any time for violation of these Terms, fraudulent activity, or at its sole discretion.
  c) Upon termination, any pending commissions that have passed the 31-day Qualification Period will still be paid out. Unqualified commissions are forfeited.
  d) RoommateSwipe reserves the right to modify, suspend, or discontinue the Program at any time with 30 days written notice to active Affiliates.

9. TAX RESPONSIBILITY

  a) You are solely responsible for reporting and paying any taxes owed on commissions earned through the Program.
  b) If you earn $600 or more in a calendar year, RoommateSwipe may require a W-9 form and will issue a 1099-NEC.

10. LIABILITY

  a) RoommateSwipe is not liable for any indirect, incidental, or consequential damages arising from your participation in the Program.
  b) The Program is provided "as is" without warranty of any kind.

11. MODIFICATIONS

  a) RoommateSwipe reserves the right to modify these Terms at any time.
  b) Continued participation in the Program after modifications constitutes acceptance of the updated Terms.
  c) Material changes to commission rates will be communicated with at least 30 days notice.

By tapping "I Agree & Apply," you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.`;

export const AffiliateApplyScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { alert } = useConfirm();
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAffiliateForUser(user.id).then((aff) => {
      if (aff) navigation.replace('AffiliateDashboard');
    });
  }, [user]);

  const handleTCScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 30;
    if (isBottom && !scrolledToBottom) setScrolledToBottom(true);
  };

  const canApply = scrolledToBottom && agreed;

  const handleApply = async () => {
    if (!user || !canApply) return;
    setIsSubmitting(true);
    try {
      const fullName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
      await applyForAffiliate(user.id, fullName);
      await alert({
        title: 'Welcome, Affiliate!',
        message: 'Your unique referral code has been generated. Share it with friends and start earning commissions!',
        variant: 'info',
      });
      navigation.replace('AffiliateDashboard');
    } catch (err: any) {
      await alert({ title: 'Error', message: err?.message || 'Failed to apply.', variant: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={st.backBtn}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </Pressable>
        <Text style={st.headerTitle}>Affiliate Program</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={st.scrollContent}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.heroSection}>
          <View style={st.heroIconWrap}>
            <Feather name="dollar-sign" size={28} color={ACCENT} />
          </View>
          <Text style={st.heroTitle}>Earn Money Referring Users</Text>
          <Text style={st.heroDesc}>
            Earn 70% of the first month's plan cost for every user you refer who subscribes to a paid plan.
          </Text>
        </View>

        <View style={st.earningsCard}>
          {EARNINGS_EXAMPLES.map((ex, i) => (
            <View key={i} style={[st.earningsRow, i < EARNINGS_EXAMPLES.length - 1 ? st.earningsRowBorder : null]}>
              <Text style={st.earningsLabel}>{ex.label}</Text>
              <Text style={st.earningsAmount}>{ex.amount}</Text>
            </View>
          ))}
        </View>

        <Text style={st.tcHeader}>Terms & Conditions</Text>
        <View style={st.tcContainer}>
          <ScrollView
            style={st.tcScroll}
            nestedScrollEnabled
            onScroll={handleTCScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
          >
            <Text style={st.tcText}>{TERMS_TEXT}</Text>
          </ScrollView>
        </View>

        <Pressable
          style={st.checkboxRow}
          onPress={() => { if (scrolledToBottom) setAgreed(!agreed); }}
        >
          <View style={[st.checkbox, agreed ? st.checkboxChecked : null]}>
            {agreed ? <Feather name="check" size={14} color="#000" /> : null}
          </View>
          <Text style={[st.checkboxLabel, !scrolledToBottom ? { opacity: 0.4 } : null]}>
            I have read and agree to the Terms & Conditions
          </Text>
        </Pressable>
        {!scrolledToBottom ? (
          <Text style={st.scrollHint}>Scroll to the bottom of the Terms to continue</Text>
        ) : null}

        <Pressable
          onPress={handleApply}
          disabled={!canApply || isSubmitting}
          style={[st.applyBtn, !canApply ? st.applyBtnDisabled : null]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Feather name="dollar-sign" size={18} color={canApply ? '#000' : '#666'} />
              <Text style={[st.applyBtnText, !canApply ? { color: '#666' } : null]}>
                I Agree & Apply
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 28 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  scrollContent: { flex: 1 },
  heroSection: { alignItems: 'center', paddingVertical: 20 },
  heroIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  earningsCard: { backgroundColor: CARD_BG, borderRadius: 14, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  earningsRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  earningsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  earningsAmount: { fontSize: 16, fontWeight: '700', color: ACCENT },
  tcHeader: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 10, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },
  tcContainer: { backgroundColor: SURFACE, borderRadius: 14, height: 280, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tcScroll: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  tcText: { fontSize: 13, color: '#aaa', lineHeight: 20 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkboxLabel: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  scrollHint: { fontSize: 12, color: 'rgba(245,158,11,0.6)', marginBottom: 12, fontStyle: 'italic' },
  applyBtn: { height: 52, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  applyBtnDisabled: { backgroundColor: '#333' },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
