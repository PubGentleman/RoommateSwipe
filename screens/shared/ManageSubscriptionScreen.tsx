import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Modal } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useEntitlements } from '../../hooks/useEntitlements';

const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  '3month': 'Every 3 Months',
  annual: 'Annual',
};

export const ManageSubscriptionScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, cancelSubscriptionAtPeriodEnd, reactivateSubscription, getSubscriptionDetails } = useAuth();
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [processing, setProcessing] = useState(false);

  const sub = user?.subscription;
  const plan = sub?.plan || 'basic';
  const status = sub?.status || 'active';
  const details = getSubscriptionDetails();
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const isCancelling = status === 'cancelling' || status === 'cancelled';
  const { hostTier, renterTier, subscriptionSource, isAnyHost } = useEntitlements();

  const handleCancel = async () => {
    setShowCancelSheet(false);
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    await cancelSubscriptionAtPeriodEnd();
    setProcessing(false);
  };

  const handleReactivate = async () => {
    setProcessing(true);
    await new Promise(r => setTimeout(r, 800));
    await reactivateSubscription();
    setProcessing(false);
  };

  if (plan === 'basic') {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={15} color="rgba(255,255,255,0.65)" />
          </Pressable>
          <Text style={s.headerTitle}>Manage Subscription</Text>
        </View>
        <View style={s.emptyWrap}>
          <Feather name="credit-card" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={s.emptyText}>No active subscription</Text>
          <Text style={s.emptySub}>Upgrade to Plus or Elite to manage your plan here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={15} color="rgba(255,255,255,0.65)" />
        </Pressable>
        <Text style={s.headerTitle}>Manage Subscription</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={s.planCard}>
          <View style={s.planRow}>
            <View>
              <Text style={s.planLabel}>Current Plan</Text>
              <Text style={s.planName}>{planName}</Text>
            </View>
            <View style={s.planBadge}>
              <Text style={s.planBadgeText}>{isCancelling ? 'CANCELLING' : 'ACTIVE'}</Text>
            </View>
          </View>
          {isAnyHost && subscriptionSource === 'host' && renterTier !== 'free' ? (
            <View style={s.bundleRow}>
              <Feather name="gift" size={12} color="#6C63FF" />
              <Text style={s.bundleRowText}>
                Includes Renter {renterTier === 'elite' ? 'Elite' : 'Plus'} access
              </Text>
            </View>
          ) : null}
          <View style={s.divider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Billing Cycle</Text>
            <Text style={s.detailValue}>{CYCLE_LABELS[details.billingCycle] || 'Monthly'}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>{isCancelling ? 'Access Until' : 'Next Renewal'}</Text>
            <Text style={s.detailValue}>{details.nextRenewalDate}</Text>
          </View>
          {!isCancelling ? (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Renewal Amount</Text>
              <Text style={s.detailValue}>${details.renewalAmount.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>

        {isCancelling ? (
          <View style={s.cancellingCard}>
            <Feather name="info" size={16} color={ACCENT} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.cancellingTitle}>Subscription Ending</Text>
              <Text style={s.cancellingBody}>
                Your {planName} plan ends on {details.nextRenewalDate}. You'll keep full access until then.
              </Text>
              <Pressable style={s.reactivateBtn} onPress={handleReactivate} disabled={processing}>
                <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
                <Text style={s.reactivateBtnText}>{processing ? 'Processing...' : 'Resubscribe'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={s.quickLinksRow}>
          <Pressable style={s.quickLinkBtn} onPress={() => navigation.navigate('PlanComparison')}>
            <Feather name="columns" size={16} color="#6C5CE7" />
            <Text style={s.quickLinkText}>Compare All Plans</Text>
            <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.25)" />
          </Pressable>
          <Pressable style={s.quickLinkBtn} onPress={() => navigation.navigate('BillingHistory')}>
            <Feather name="file-text" size={16} color="#3b82f6" />
            <Text style={s.quickLinkText}>Full Billing History</Text>
            <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.25)" />
          </Pressable>
        </View>

        <Text style={s.sectionLabel}>RECENT BILLING</Text>
        <View style={s.historyCard}>
          {details.billingHistory.length > 0 ? (
            details.billingHistory.slice(0, 3).map((entry, i) => (
              <View key={i} style={[s.historyRow, i < Math.min(details.billingHistory.length, 3) - 1 ? s.historyRowBorder : null]}>
                <View>
                  <Text style={s.historyDesc}>{entry.description}</Text>
                  <Text style={s.historyDate}>
                    {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <Text style={s.historyAmount}>${entry.amount.toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <View style={s.historyEmpty}>
              <Text style={s.historyEmptyText}>No billing history yet</Text>
            </View>
          )}
        </View>

        {!isCancelling ? (
          <Pressable style={s.cancelBtn} onPress={() => setShowCancelSheet(true)} disabled={processing}>
            <Feather name="x-circle" size={16} color="#EF4444" />
            <Text style={s.cancelBtnText}>{processing ? 'Processing...' : 'Cancel Plan'}</Text>
          </Pressable>
        ) : null}

        <Text style={s.finePrint}>
          Changes take effect at the end of your billing period.{'\n'}
          Contact support for billing questions.
        </Text>
      </ScrollView>

      <Modal visible={showCancelSheet} transparent animationType="slide" onRequestClose={() => setShowCancelSheet(false)}>
        <Pressable style={s.sheetOverlay} onPress={() => setShowCancelSheet(false)}>
          <Pressable style={[s.sheetContent, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Are you sure?</Text>
            <Text style={s.sheetBody}>
              You'll keep access to {planName} until {details.nextRenewalDate}. After that, your plan will revert to Basic (free).
            </Text>
            <Pressable style={s.keepBtn} onPress={() => setShowCancelSheet(false)}>
              <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={[StyleSheet.absoluteFill, { borderRadius: 13 }]} />
              <Text style={s.keepBtnText}>Keep My Plan</Text>
            </Pressable>
            <Pressable style={s.cancelAnyway} onPress={handleCancel}>
              <Text style={s.cancelAnywayText}>Cancel Anyway</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  emptySub: { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingHorizontal: 40 },

  planCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 16, marginBottom: 12 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  planName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  planBadge: { backgroundColor: 'rgba(255,107,91,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,91,0.25)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  planBadgeText: { fontSize: 10, fontWeight: '800', color: '#ff7b6b' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailLabel: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  detailValue: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },

  cancellingCard: { flexDirection: 'row', backgroundColor: 'rgba(255,107,91,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,91,0.2)', borderRadius: 16, padding: 14, marginBottom: 16 },
  cancellingTitle: { fontSize: 14, fontWeight: '700', color: ACCENT, marginBottom: 4 },
  cancellingBody: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
  reactivateBtn: { marginTop: 10, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', alignSelf: 'flex-start', paddingHorizontal: 20 },
  reactivateBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  historyCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  historyDesc: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  historyDate: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  historyAmount: { fontSize: 14, fontWeight: '800', color: '#fff' },
  historyEmpty: { padding: 20, alignItems: 'center' },
  historyEmptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 14, height: 48, marginBottom: 16 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },

  finePrint: { textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.18)', lineHeight: 16, marginBottom: 10 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 24 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 10 },
  sheetBody: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 24 },
  keepBtn: { height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 },
  keepBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelAnyway: { height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.11)', marginBottom: 8 },
  cancelAnywayText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },

  quickLinksRow: { gap: 8, marginBottom: 16 },
  quickLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 2,
  },
  quickLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  bundleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  bundleRowText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(108,99,255,0.9)',
  },
});
