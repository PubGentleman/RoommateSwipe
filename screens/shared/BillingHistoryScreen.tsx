import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Linking } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { supabase } from '../../lib/supabase';

const BG = '#0d0d0d';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const GOLD = '#ffd700';

interface BillingEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  type: 'subscription' | 'boost' | 'one_time' | 'refund';
  receiptUrl?: string;
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  paid: { icon: 'check-circle', color: GREEN, label: 'Paid' },
  pending: { icon: 'clock', color: GOLD, label: 'Pending' },
  failed: { icon: 'alert-circle', color: RED, label: 'Failed' },
  refunded: { icon: 'rotate-ccw', color: BLUE, label: 'Refunded' },
};

export const BillingHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState({ label: 'Free', cycle: 'Monthly', price: 0, nextBilling: '' });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [historyResult, hostSub] = await Promise.all([
        supabase
          .from('host_transactions')
          .select('*')
          .eq('host_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(r => r.data || [])
          .catch(() => []),
        StorageService.getHostSubscription(user.id).catch(() => null),
      ]);

      const mapped: BillingEntry[] = historyResult.map((t: any) => ({
        id: t.id,
        date: t.created_at,
        description: t.description || 'Payment',
        amount: (t.amount_cents || 0) / 100,
        status: 'paid' as const,
        type: t.type === 'subscription_payment' ? 'subscription' as const
          : t.type === 'boost_purchase' ? 'boost' as const
          : 'one_time' as const,
        receiptUrl: t.metadata?.receipt_url,
      }));
      setEntries(mapped);

      if (hostSub) {
        const plan = hostSub.plan || 'free';
        const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1).replace(/_/g, ' ');
        setCurrentPlan({
          label: planLabel === 'Free' ? 'Free' : planLabel,
          cycle: hostSub.billingCycle || 'Monthly',
          price: hostSub.monthlyPrice || 0,
          nextBilling: hostSub.renewalDate || '',
        });
      }
    } catch (e) {
      console.error('BillingHistory load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalThisYear = entries
    .filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === new Date().getFullYear() && e.status === 'paid';
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const subscriptionEntries = entries.filter(e => e.type === 'subscription');
  const otherEntries = entries.filter(e => e.type !== 'subscription');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Billing History</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          <View style={styles.currentPlanCard}>
            <View style={styles.currentPlanTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.currentPlanName}>{currentPlan.label}</Text>
                <Text style={styles.currentPlanCycle}>
                  {currentPlan.price > 0 ? `$${currentPlan.price}/month` : 'No charge'}
                  {currentPlan.cycle !== 'Monthly' ? ` (${currentPlan.cycle})` : ''}
                </Text>
                {currentPlan.nextBilling ? (
                  <Text style={styles.currentPlanNext}>
                    Next billing: {formatDate(currentPlan.nextBilling)}
                  </Text>
                ) : null}
              </View>
              <Feather name="credit-card" size={20} color={ACCENT} />
            </View>
            <View style={styles.currentPlanActions}>
              <Pressable
                style={styles.currentPlanBtn}
                onPress={() => navigation.navigate('ManageSubscription')}
              >
                <Text style={styles.currentPlanBtnText}>Manage Plan</Text>
              </Pressable>
              <Pressable
                style={[styles.currentPlanBtn, { borderColor: BLUE + '30' }]}
                onPress={() => navigation.navigate('PlanComparison')}
              >
                <Text style={[styles.currentPlanBtnText, { color: BLUE }]}>Compare Plans</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {entries.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            {entries.map(entry => {
              const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.paid;
              return (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                      <Text style={styles.entryDesc} numberOfLines={1}>{entry.description}</Text>
                    </View>
                    <Text style={styles.entryAmount}>${entry.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.entryBottom}>
                    <View style={styles.statusBadge}>
                      <Feather name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                      <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                    {entry.type === 'subscription' ? (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>Subscription</Text>
                      </View>
                    ) : entry.type === 'boost' ? (
                      <View style={[styles.typeBadge, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                        <Text style={[styles.typeText, { color: '#a855f7' }]}>Boost</Text>
                      </View>
                    ) : null}
                    {entry.receiptUrl ? (
                      <Pressable onPress={() => Linking.openURL(entry.receiptUrl!)} hitSlop={8}>
                        <Text style={styles.receiptLink}>View Receipt</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : !loading ? (
          <View style={styles.emptyCard}>
            <Feather name="file-text" size={32} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>No billing history yet</Text>
            <Text style={styles.emptySubtext}>Your payments and invoices will appear here</Text>
          </View>
        ) : null}

        {totalThisYear > 0 ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total this year</Text>
            <Text style={styles.totalValue}>${totalThisYear.toFixed(2)}</Text>
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingHorizontal: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  currentPlanCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ACCENT + '15',
  },
  currentPlanTop: { flexDirection: 'row', alignItems: 'flex-start' },
  currentPlanName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  currentPlanCycle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  currentPlanNext: { fontSize: 12, color: BLUE, marginTop: 4 },
  currentPlanActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  currentPlanBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT + '30',
    alignItems: 'center',
  },
  currentPlanBtnText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  entryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  entryDate: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  entryDesc: { fontSize: 14, fontWeight: '600', color: '#fff', marginTop: 2 },
  entryAmount: { fontSize: 16, fontWeight: '700', color: '#fff' },
  entryBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  typeText: { fontSize: 10, fontWeight: '600', color: BLUE },
  receiptLink: { fontSize: 11, fontWeight: '600', color: ACCENT, textDecorationLine: 'underline' },
  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  emptySubtext: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
});
