import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, Share, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import {
  getAffiliateForUser,
  getAffiliateReferrals,
  updatePaypalEmail,
  getNextPayoutDate,
  getDaysRemaining,
  COMMISSION_TABLE,
  Affiliate,
  AffiliateReferral,
} from '../../services/affiliateService';

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const ACCENT = '#f59e0b';
const GREEN = '#22c55e';
const RED = '#ef4444';

export const AffiliateDashboardScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { alert } = useConfirm();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const aff = await getAffiliateForUser(user.id);
      setAffiliate(aff);
      if (aff) {
        const refs = await getAffiliateReferrals(aff.id);
        setReferrals(refs);
        setEmailDraft(aff.paypal_email || '');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleCopyCode = async () => {
    if (!affiliate) return;
    await Clipboard.setStringAsync(affiliate.affiliate_code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await alert({ title: 'Copied!', message: 'Referral code copied to clipboard.', variant: 'info' });
  };

  const handleShareLink = async () => {
    if (!affiliate) return;
    try {
      await Share.share({
        message: `Join Rhome and find your perfect place! Use my referral code ${affiliate.affiliate_code} to get started: https://rhomeapp.io/ref/${affiliate.affiliate_code}`,
      });
    } catch (_) {}
  };

  const handleSharePlatform = async (platform: string) => {
    if (!affiliate) return;
    const msg = `Check out Rhome for finding roommates & housing! Use my code ${affiliate.affiliate_code}: https://rhomeapp.io/ref/${affiliate.affiliate_code}`;
    switch (platform) {
      case 'sms':
        Linking.openURL(`sms:?body=${encodeURIComponent(msg)}`);
        break;
      case 'email':
        Linking.openURL(`mailto:?subject=${encodeURIComponent('Join Rhome!')}&body=${encodeURIComponent(msg)}`);
        break;
      case 'copy':
        await Clipboard.setStringAsync(msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      default:
        await Share.share({ message: msg });
    }
  };

  const handleSaveEmail = async () => {
    if (!affiliate) return;
    if (!emailDraft.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft.trim())) {
      await alert({ title: 'Invalid Email', message: 'Please enter a valid PayPal email.', variant: 'warning' });
      return;
    }
    setSavingEmail(true);
    try {
      await updatePaypalEmail(affiliate.id, emailDraft.trim());
      setAffiliate({ ...affiliate, paypal_email: emailDraft.trim(), payout_method: 'paypal' });
      setEditingEmail(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      await alert({ title: 'Error', message: err?.message || 'Failed to update.', variant: 'warning' });
    } finally {
      setSavingEmail(false);
    }
  };

  const totalEarned = referrals
    .filter(r => r.status === 'qualified' || r.status === 'paid')
    .reduce((sum, r) => sum + (r.commission || 0), 0);
  const activeCount = referrals.filter(r => r.status === 'pending' || r.status === 'qualified').length;
  const totalCount = referrals.length;
  const pendingPayout = referrals
    .filter(r => r.status === 'qualified')
    .reduce((sum, r) => sum + (r.commission || 0), 0);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'qualified':
        return { icon: 'check-circle' as const, color: GREEN, bg: 'rgba(34,197,94,0.12)', label: 'Qualified' };
      case 'paid':
        return { icon: 'check-circle' as const, color: GREEN, bg: 'rgba(34,197,94,0.12)', label: 'Paid' };
      case 'forfeited':
        return { icon: 'x-circle' as const, color: RED, bg: 'rgba(239,68,68,0.12)', label: 'Forfeited' };
      default:
        return { icon: 'clock' as const, color: ACCENT, bg: 'rgba(245,158,11,0.12)', label: 'Pending' };
    }
  };

  const renderReferralItem = ({ item }: { item: AffiliateReferral }) => {
    const sc = getStatusConfig(item.status);
    const planLabel = COMMISSION_TABLE[item.plan]?.label || item.plan;
    const signupDate = new Date(item.signup_at || item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const daysLeft = item.status === 'pending' ? getDaysRemaining(item.qualification_date) : 0;
    const name = item.referred_name || 'User';
    const firstNameInitial = name.split(' ').length > 1
      ? `${name.split(' ')[0]} ${name.split(' ')[1]?.[0] || ''}.`
      : name;

    let statusLine = '';
    if (item.status === 'qualified') statusLine = `Qualified`;
    else if (item.status === 'paid') statusLine = `Paid ${item.paid_at ? new Date(item.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`;
    else if (item.status === 'forfeited') statusLine = item.forfeited_reason || 'User cancelled';
    else statusLine = `${daysLeft} days remaining`;

    return (
      <View style={st.referralCard}>
        <View style={st.referralTop}>
          <View style={[st.referralAvatar, { backgroundColor: sc.bg }]}>
            <Feather name="user" size={14} color={sc.color} />
          </View>
          <View style={st.referralInfo}>
            <Text style={st.referralName}>{firstNameInitial}</Text>
            <Text style={st.referralPlan}>{planLabel}</Text>
          </View>
          <Text style={st.referralCommission}>${(item.commission || 0).toFixed(2)}</Text>
        </View>
        <View style={st.referralBottom}>
          <Text style={st.referralDate}>Signed up {signupDate}</Text>
          <View style={[st.statusBadge, { backgroundColor: sc.bg }]}>
            <Feather name={sc.icon} size={12} color={sc.color} />
            <Text style={[st.statusText, { color: sc.color }]}>{statusLine}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={st.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={28} color="#fff" /></Pressable>
          <Text style={st.headerTitle}>Affiliate Program</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={st.loadingWrap}><ActivityIndicator color={ACCENT} size="large" /></View>
      </View>
    );
  }

  if (!affiliate) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={st.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={28} color="#fff" /></Pressable>
          <Text style={st.headerTitle}>Affiliate Program</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={st.loadingWrap}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>No affiliate record found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={28} color="#fff" /></Pressable>
        <Text style={st.headerTitle}>Affiliate Program</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={referrals}
        keyExtractor={(item) => item.id}
        renderItem={renderReferralItem}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={st.codeCard}>
              <Text style={st.codeLabel}>YOUR REFERRAL CODE</Text>
              <Text style={st.codeText}>{affiliate.affiliate_code}</Text>
              <View style={st.codeBtnRow}>
                <Pressable onPress={handleCopyCode} style={st.codeBtn}>
                  <Feather name="copy" size={15} color={ACCENT} />
                  <Text style={st.codeBtnText}>Copy Code</Text>
                </Pressable>
                <Pressable onPress={handleShareLink} style={st.codeBtn}>
                  <Feather name="share-2" size={15} color={ACCENT} />
                  <Text style={st.codeBtnText}>Share Link</Text>
                </Pressable>
              </View>
            </View>

            <View style={st.statsRow}>
              <View style={st.statCard}>
                <Text style={st.statValue}>${totalEarned.toFixed(0)}</Text>
                <Text style={st.statLabel}>Earned</Text>
              </View>
              <View style={st.statCard}>
                <Text style={st.statValue}>{activeCount}</Text>
                <Text style={st.statLabel}>Active</Text>
              </View>
              <View style={st.statCard}>
                <Text style={st.statValue}>{totalCount}</Text>
                <Text style={st.statLabel}>Total</Text>
              </View>
            </View>

            {referrals.length > 0 ? (
              <Text style={st.sectionTitle}>Recent Referrals</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <Feather name="users" size={32} color="rgba(255,255,255,0.15)" />
            <Text style={st.emptyText}>No referrals yet. Share your code to start earning!</Text>
          </View>
        }
        ListFooterComponent={
          <>
            <Text style={st.sectionTitle}>Payout Settings</Text>
            <View style={st.payoutCard}>
              <View style={st.payoutRow}>
                <Text style={st.payoutLabel}>Payout method</Text>
                <Text style={st.payoutValue}>{affiliate.payout_method === 'paypal' ? 'PayPal' : affiliate.payout_method === 'bank_transfer' ? 'Bank Transfer' : affiliate.payout_method === 'in_app_credit' ? 'In-App Credit' : 'Not set'}</Text>
              </View>
              <View style={st.payoutDivider} />
              <View style={st.payoutRow}>
                <Text style={st.payoutLabel}>Next payout</Text>
                <Text style={st.payoutValue}>{getNextPayoutDate()} {pendingPayout > 0 ? `\u00B7 $${pendingPayout.toFixed(2)}` : ''}</Text>
              </View>
              <View style={st.payoutDivider} />
              {editingEmail ? (
                <View style={st.emailEditRow}>
                  <TextInput
                    style={st.emailInput}
                    value={emailDraft}
                    onChangeText={setEmailDraft}
                    placeholder="your@paypal.com"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Pressable onPress={handleSaveEmail} disabled={savingEmail} style={st.emailSaveBtn}>
                    {savingEmail ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="check" size={16} color="#fff" />}
                  </Pressable>
                  <Pressable onPress={() => setEditingEmail(false)} style={st.emailCancelBtn}>
                    <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => { setEditingEmail(true); setEmailDraft(affiliate.paypal_email || ''); }} style={st.payoutRow}>
                  <Text style={st.payoutLabel}>PayPal email</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={st.payoutValue}>{affiliate.paypal_email || 'Not set'}</Text>
                    <Feather name="edit-2" size={13} color={ACCENT} />
                  </View>
                </Pressable>
              )}
            </View>

            <Text style={st.sectionTitle}>Quick Share</Text>
            <View style={st.shareRow}>
              {[
                { key: 'share', icon: 'share' as const, label: 'Share' },
                { key: 'sms', icon: 'message-circle' as const, label: 'SMS' },
                { key: 'email', icon: 'mail' as const, label: 'Email' },
                { key: 'copy', icon: 'clipboard' as const, label: 'Copy' },
              ].map((item) => (
                <Pressable key={item.key} style={st.shareItem} onPress={() => handleSharePlatform(item.key)}>
                  <View style={st.shareIconWrap}>
                    <Feather name={item.icon} size={18} color="#fff" />
                  </View>
                  <Text style={st.shareLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: insets.bottom + 40 }} />
          </>
        }
      />
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  codeCard: { backgroundColor: CARD_BG, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  codeLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, marginBottom: 12 },
  codeText: { fontSize: 24, fontWeight: '800', color: ACCENT, letterSpacing: 2, marginBottom: 16 },
  codeBtnRow: { flexDirection: 'row', gap: 12 },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  codeBtnText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: CARD_BG, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  referralCard: { backgroundColor: CARD_BG, borderRadius: 14, padding: 14, marginBottom: 8 },
  referralTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  referralAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  referralInfo: { flex: 1 },
  referralName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  referralPlan: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  referralCommission: { fontSize: 17, fontWeight: '700', color: GREEN },
  referralBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  referralDate: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 250 },
  payoutCard: { backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginBottom: 16 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  payoutLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  payoutValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  payoutDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 },
  emailEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  emailInput: { flex: 1, backgroundColor: '#0d0d0d', borderRadius: 10, height: 40, paddingHorizontal: 12, color: '#fff', fontSize: 14 },
  emailSaveBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  emailCancelBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  shareRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  shareItem: { alignItems: 'center', gap: 6 },
  shareIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  shareLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
});
