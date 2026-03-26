import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, Share, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  getAffiliateForUser,
  getAffiliateReferrals,
  updatePaypalEmail,
  Affiliate,
  AffiliateReferral,
} from '../../services/affiliateService';
import { TextInput } from 'react-native';

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
    await alert({ title: 'Copied', message: 'Your affiliate code has been copied to clipboard.', variant: 'info' });
  };

  const handleShare = async () => {
    if (!affiliate) return;
    try {
      await Share.share({
        message: `Join Rhome and find your perfect place! Use my code ${affiliate.affiliate_code} to get started: https://rhomeapp.io`,
      });
    } catch (_) {}
  };

  const handleSaveEmail = async () => {
    if (!affiliate) return;
    if (!emailDraft.trim() || !emailDraft.includes('@')) {
      await alert({ title: 'Invalid Email', message: 'Please enter a valid PayPal email.', variant: 'warning' });
      return;
    }
    setSavingEmail(true);
    try {
      await updatePaypalEmail(affiliate.id, emailDraft.trim());
      setAffiliate({ ...affiliate, paypal_email: emailDraft.trim() });
      setEditingEmail(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      await alert({ title: 'Error', message: err?.message || 'Failed to update email.', variant: 'warning' });
    } finally {
      setSavingEmail(false);
    }
  };

  const renderReferralItem = ({ item }: { item: AffiliateReferral }) => {
    const isPaid = item.status === 'paid';
    const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return (
      <View style={styles.referralRow}>
        <View style={styles.referralLeft}>
          <View style={[styles.referralIcon, { backgroundColor: isPaid ? 'rgba(46,204,113,0.15)' : 'rgba(245,158,11,0.15)' }]}>
            <Feather name={isPaid ? 'check-circle' : 'clock'} size={14} color={isPaid ? '#2ecc71' : '#f59e0b'} />
          </View>
          <View>
            <Text style={styles.referralPlan}>{item.plan === 'elite' ? 'Elite' : 'Plus'} signup</Text>
            <Text style={styles.referralDate}>{date}</Text>
          </View>
        </View>
        <View style={styles.referralRight}>
          <Text style={styles.referralAmount}>${item.commission}</Text>
          <View style={[styles.referralStatusBadge, { backgroundColor: isPaid ? 'rgba(46,204,113,0.15)' : 'rgba(245,158,11,0.15)' }]}>
            <Text style={[styles.referralStatusText, { color: isPaid ? '#2ecc71' : '#f59e0b' }]}>{isPaid ? 'Paid' : 'Pending'}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={28} color="#fff" /></Pressable>
          <Text style={styles.headerTitle}>Affiliate Dashboard</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingWrap}><ActivityIndicator color="#ff6b5b" size="large" /></View>
      </View>
    );
  }

  if (!affiliate) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={28} color="#fff" /></Pressable>
          <Text style={styles.headerTitle}>Affiliate Program</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>No affiliate record found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={28} color="#fff" /></Pressable>
        <Text style={styles.headerTitle}>Affiliate Dashboard</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={referrals}
        keyExtractor={(item) => item.id}
        renderItem={renderReferralItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Pressable onPress={handleCopyCode} style={styles.codeCard}>
              <Text style={styles.codeLabel}>YOUR AFFILIATE CODE</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{affiliate.affiliate_code}</Text>
                <View style={styles.copyBtn}>
                  <Feather name="copy" size={16} color="#ff6b5b" />
                </View>
              </View>
              <Text style={styles.codeTap}>Tap to copy</Text>
            </Pressable>

            <Pressable onPress={handleShare}>
              <LinearGradient
                colors={['#ff6b5b', '#e83a2a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shareBtn}
              >
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={styles.shareBtnText}>Share Your Code</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{affiliate.total_referrals}</Text>
                <Text style={styles.statLabel}>Referrals</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>${Number(affiliate.total_earned).toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
            </View>

            <View style={styles.paypalCard}>
              <View style={styles.paypalHeader}>
                <Text style={styles.paypalTitle}>PayPal Email</Text>
                {!editingEmail ? (
                  <Pressable onPress={() => { setEditingEmail(true); setEmailDraft(affiliate.paypal_email || ''); }} hitSlop={8}>
                    <Feather name="edit-2" size={14} color="#ff6b5b" />
                  </Pressable>
                ) : null}
              </View>
              {editingEmail ? (
                <View style={styles.paypalEditRow}>
                  <TextInput
                    style={styles.paypalInput}
                    value={emailDraft}
                    onChangeText={setEmailDraft}
                    placeholder="your@paypal.com"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Pressable onPress={handleSaveEmail} disabled={savingEmail} style={styles.paypalSaveBtn}>
                    {savingEmail ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="check" size={16} color="#fff" />}
                  </Pressable>
                  <Pressable onPress={() => setEditingEmail(false)} style={styles.paypalCancelBtn}>
                    <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.paypalEmail}>{affiliate.paypal_email || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.commissionInfo}>
              <Feather name="info" size={14} color="rgba(255,255,255,0.4)" />
              <Text style={styles.commissionInfoText}>$10 per Plus signup, $20 per Elite signup. Commissions are paid via PayPal.</Text>
            </View>

            {referrals.length > 0 ? (
              <Text style={styles.referralsTitle}>Recent Referrals</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="users" size={32} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No referrals yet. Share your code to start earning!</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: insets.bottom + 40 }} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  codeCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,107,91,0.15)' },
  codeLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeText: { fontSize: 28, fontWeight: '800', color: '#ff6b5b', letterSpacing: 2 },
  copyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,107,91,0.12)', justifyContent: 'center', alignItems: 'center' },
  codeTap: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 },
  shareBtn: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 16 },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 14, padding: 18, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  paypalCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, marginBottom: 12 },
  paypalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  paypalTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  paypalEmail: { fontSize: 15, color: '#fff' },
  paypalEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paypalInput: { flex: 1, backgroundColor: '#111', borderRadius: 10, height: 40, paddingHorizontal: 12, color: '#fff', fontSize: 14 },
  paypalSaveBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2ecc71', justifyContent: 'center', alignItems: 'center' },
  paypalCancelBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  commissionInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 20 },
  commissionInfoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  referralsTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12 },
  referralRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 8 },
  referralLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  referralIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  referralPlan: { fontSize: 14, fontWeight: '600', color: '#fff' },
  referralDate: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  referralRight: { alignItems: 'flex-end', gap: 4 },
  referralAmount: { fontSize: 16, fontWeight: '700', color: '#2ecc71' },
  referralStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  referralStatusText: { fontSize: 11, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 250 },
});
