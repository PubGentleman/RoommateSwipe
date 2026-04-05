import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Switch, Modal, FlatList } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { HostSubscriptionData, BoostCredits, Property } from '../../types/models';
import { BOOST_OPTIONS } from '../../utils/hostPricing';
import { getActiveBoost } from '../../services/boostService';
import { getMyListings } from '../../services/listingService';
import {
  getBoostHistory,
  getBoostSummary,
  getAutoBoostSchedules,
  createAutoBoostSchedule,
  toggleAutoBoostSchedule,
  deleteAutoBoostSchedule,
  type BoostHistoryEntry,
  type BoostSummary,
  type AutoBoostSchedule,
} from '../../services/boostManagementService';

const BG = '#0d0d0d';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#3ECF8E';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const PURPLE = '#a855f7';
const GOLD = '#ffd700';

const BOOST_COLORS: Record<string, string> = {
  quick: BLUE,
  standard: PURPLE,
  extended: GREEN,
};

const BOOST_LABELS: Record<string, string> = {
  quick: 'Quick',
  standard: 'Standard',
  extended: 'Extended',
};

const DURATION_LABELS: Record<string, string> = {
  quick: '6h',
  standard: '12h',
  extended: '24h',
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  every_3_days: 'Every 3 Days',
  weekly: 'Weekly',
};

export const BoostManagementScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<BoostCredits>({ quick: 0, standard: 0, extended: 0 });
  const [activeBoosts, setActiveBoosts] = useState<any[]>([]);
  const [summary, setSummary] = useState<BoostSummary | null>(null);
  const [history, setHistory] = useState<BoostHistoryEntry[]>([]);
  const [schedules, setSchedules] = useState<AutoBoostSchedule[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [listings, setListings] = useState<Property[]>([]);
  const [tick, setTick] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
      timerRef.current = setInterval(() => setTick(t => t + 1), 30000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [])
  );

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const hostSub = await StorageService.getHostSubscription(user.id);
      const creds = hostSub?.boostCredits || { quick: 0, standard: 0, extended: 0 };
      setCredits(creds);

      const [historyData, summaryData, schedulesData, activeData, listingsData] = await Promise.all([
        getBoostHistory(user.id, 20).catch(() => []),
        getBoostSummary(user.id, creds).catch(() => null),
        getAutoBoostSchedules(user.id).catch(() => []),
        getActiveBoost(user.id).catch(() => null),
        getMyListings(user.id).catch(() => []),
      ]);

      setHistory(historyData);
      setSummary(summaryData);
      setSchedules(schedulesData);
      setActiveBoosts(activeData ? [activeData] : []);
      setListings((listingsData || []).map((l: any) => ({
        id: l.id,
        title: l.title || '',
      })) as any[]);
    } catch (e) {
      console.error('BoostManagement load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', progress: 1, expired: true };
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const text = hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
    return { text, progress: 0, expired: false };
  };

  const getBoostProgress = (startedAt: string, expiresAt: string) => {
    const start = new Date(startedAt).getTime();
    const end = new Date(expiresAt).getTime();
    const now = Date.now();
    if (now >= end) return 1;
    return Math.min(1, (now - start) / (end - start));
  };

  const handleToggleSchedule = async (schedule: AutoBoostSchedule) => {
    try {
      await toggleAutoBoostSchedule(schedule.id, !schedule.isActive);
      setSchedules(prev => prev.map(s =>
        s.id === schedule.id ? { ...s, isActive: !s.isActive } : s
      ));
    } catch {
      showAlert({ title: 'Error', message: 'Failed to update schedule.', variant: 'warning' });
    }
  };

  const handleDeleteSchedule = async (schedule: AutoBoostSchedule) => {
    const ok = await confirm({
      title: 'Remove Auto-Boost',
      message: `Remove auto-boost schedule for "${schedule.listingTitle}"?`,
      confirmText: 'Remove',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await deleteAutoBoostSchedule(schedule.id);
      setSchedules(prev => prev.filter(s => s.id !== schedule.id));
    } catch {
      showAlert({ title: 'Error', message: 'Failed to remove schedule.', variant: 'warning' });
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const renderCreditBalance = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Credit Balance</Text>
      <View style={styles.creditsRow}>
        {(['quick', 'standard', 'extended'] as const).map(type => (
          <View key={type} style={[styles.creditCard, { borderColor: BOOST_COLORS[type] + '40' }]}>
            <Text style={[styles.creditCount, { color: BOOST_COLORS[type] }]}>{credits[type]}</Text>
            <Text style={styles.creditLabel}>{BOOST_LABELS[type]}</Text>
            <Text style={styles.creditDuration}>{DURATION_LABELS[type]}</Text>
          </View>
        ))}
      </View>
      <Pressable
        style={styles.buyMoreBtn}
        onPress={() => navigation.navigate('ListingBoost', { listingId: listings[0]?.id })}
      >
        <Feather name="plus-circle" size={14} color={ACCENT} />
        <Text style={styles.buyMoreText}>Buy More Credits</Text>
      </Pressable>
    </View>
  );

  const renderActiveBoosts = () => {
    const active = activeBoosts.filter(b => new Date(b.expires_at) > new Date());
    if (active.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Boosts</Text>
          <View style={styles.emptyCard}>
            <Feather name="zap" size={28} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>No active boosts</Text>
            <Text style={styles.emptySubtext}>Boost a listing to get more visibility</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Boosts</Text>
        {active.map((boost: any) => {
          const remaining = getTimeRemaining(boost.expires_at);
          const progress = getBoostProgress(boost.created_at, boost.expires_at);
          const boostType = boost.duration_hours <= 6 ? 'quick' : boost.duration_hours <= 12 ? 'standard' : 'extended';
          const color = BOOST_COLORS[boostType];

          return (
            <View key={boost.id} style={[styles.activeBoostCard, { borderColor: color + '30' }]}>
              <View style={styles.activeBoostHeader}>
                <Feather name="zap" size={16} color={color} />
                <Text style={styles.activeBoostTitle} numberOfLines={1}>
                  {boost.listing_title || 'Listing'}
                </Text>
                <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.typeBadgeText, { color }]}>{BOOST_LABELS[boostType]}</Text>
                </View>
              </View>
              <Text style={styles.activeBoostRemaining}>{remaining.text}</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderSummary = () => {
    if (!summary || summary.totalBoosts === 0) return null;

    const stats = [
      { label: 'Total Boosts', value: `${summary.totalBoosts}`, icon: 'zap' as const },
      { label: 'Avg View Lift', value: `+${summary.avgLiftPercentage}%`, icon: 'trending-up' as const, color: GREEN },
      { label: 'Avg Views/Boost', value: `${summary.avgViewsPerBoost}`, icon: 'eye' as const },
      { label: 'Avg Inquiries/Boost', value: `${summary.avgInquiriesPerBoost}`, icon: 'message-circle' as const },
      { label: 'Best Type', value: summary.bestBoostType ? BOOST_LABELS[summary.bestBoostType] : '--', icon: 'award' as const, color: GOLD },
      { label: 'Total Spent', value: `$${(summary.totalSpentCents / 100).toFixed(2)}`, icon: 'dollar-sign' as const },
    ];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Summary</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <View style={styles.statIconRow}>
                <Feather name={stat.icon} size={14} color={stat.color || 'rgba(255,255,255,0.4)'} />
              </View>
              <Text style={[styles.statValue, stat.color ? { color: stat.color } : null]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSchedules = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Auto-Boost Schedules</Text>
      </View>
      {schedules.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="clock" size={28} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No auto-boosts configured</Text>
          <Text style={styles.emptySubtext}>Set it and forget it</Text>
        </View>
      ) : (
        schedules.map(schedule => (
          <View key={schedule.id} style={styles.scheduleCard}>
            <View style={styles.scheduleTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleListing} numberOfLines={1}>{schedule.listingTitle}</Text>
                <Text style={styles.scheduleInfo}>
                  {BOOST_LABELS[schedule.boostType]} {' '} {FREQUENCY_LABELS[schedule.frequency]} {' '} {formatTime(schedule.preferredTime)}
                </Text>
                {schedule.nextBoostAt ? (
                  <Text style={styles.scheduleNext}>
                    Next: {formatDate(schedule.nextBoostAt)} at {formatTime(schedule.preferredTime)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.scheduleActions}>
                <Switch
                  value={schedule.isActive}
                  onValueChange={() => handleToggleSchedule(schedule)}
                  trackColor={{ false: '#333', true: GREEN + '60' }}
                  thumbColor={schedule.isActive ? GREEN : '#666'}
                />
                <Pressable onPress={() => handleDeleteSchedule(schedule)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color={RED} />
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
      <Pressable style={styles.addScheduleBtn} onPress={() => setShowSetupModal(true)}>
        <Feather name="plus" size={14} color={ACCENT} />
        <Text style={styles.addScheduleText}>Set Up Auto-Boost</Text>
      </Pressable>
    </View>
  );

  const renderHistory = () => {
    if (history.length === 0) return null;

    const recent = history.slice(0, 5);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Boost History</Text>
        {recent.map(entry => {
          const isPositive = entry.liftPercentage > 0;
          const liftColor = isPositive ? GREEN : entry.liftPercentage < 0 ? RED : 'rgba(255,255,255,0.4)';
          const paymentLabel = entry.usedFreeBoost ? 'Free boost' : entry.usedCredit ? 'Credit used' : `$${(entry.pricePaidCents / 100).toFixed(2)}`;

          return (
            <View key={entry.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{formatDate(entry.startedAt)}</Text>
                  <Text style={styles.historyListing} numberOfLines={1}>{entry.listingTitle}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: BOOST_COLORS[entry.boostType] + '20' }]}>
                  <Text style={[styles.typeBadgeText, { color: BOOST_COLORS[entry.boostType] }]}>
                    {BOOST_LABELS[entry.boostType]}
                  </Text>
                </View>
              </View>
              {entry.isExpired ? (
                <View style={styles.historyMetrics}>
                  <View style={styles.historyMetricItem}>
                    <Feather name="eye" size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.historyMetricText}>{entry.viewsDuring} views</Text>
                  </View>
                  <View style={styles.historyMetricItem}>
                    <Feather name="trending-up" size={12} color={liftColor} />
                    <Text style={[styles.historyMetricText, { color: liftColor }]}>
                      {isPositive ? '+' : ''}{entry.liftPercentage}%
                    </Text>
                  </View>
                  <View style={styles.historyMetricItem}>
                    <Feather name="message-circle" size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.historyMetricText}>Inq: {entry.inquiriesDuring}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.historyMetricText, { color: GREEN, marginTop: 4 }]}>Active</Text>
              )}
              <Text style={styles.historyPayment}>{paymentLabel}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Boost Manager</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderCreditBalance()}
        {renderActiveBoosts()}
        {renderSummary()}
        {renderSchedules()}
        {renderHistory()}
        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>

      <AutoBoostSetupModal
        visible={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        listings={listings}
        hostId={user?.id || ''}
        onCreated={() => {
          setShowSetupModal(false);
          loadData();
        }}
      />
    </View>
  );
};

interface SetupModalProps {
  visible: boolean;
  onClose: () => void;
  listings: any[];
  hostId: string;
  onCreated: () => void;
}

const AutoBoostSetupModal = ({ visible, onClose, listings, hostId, onCreated }: SetupModalProps) => {
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const [boostType, setBoostType] = useState<'quick' | 'standard' | 'extended'>('standard');
  const [frequency, setFrequency] = useState<'daily' | 'every_3_days' | 'weekly'>('daily');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const { alert: showAlert } = useConfirm();

  const handleSave = async () => {
    if (!selectedListing) {
      showAlert({ title: 'Select Listing', message: 'Please select a listing to auto-boost.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const listing = listings.find((l: any) => l.id === selectedListing);
      const result = await createAutoBoostSchedule({
        hostId,
        listingId: selectedListing,
        listingTitle: listing?.title || '',
        boostType,
        frequency,
        preferredTime,
      });
      if (!result.success) throw new Error(result.error);
      onCreated();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Failed to create schedule.', variant: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  const timeOptions = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.headerRow}>
            <Text style={modalStyles.title}>Set Up Auto-Boost</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Select Listing</Text>
            {listings.map((l: any) => (
              <Pressable
                key={l.id}
                style={[modalStyles.optionRow, selectedListing === l.id && modalStyles.optionSelected]}
                onPress={() => setSelectedListing(l.id)}
              >
                <Feather
                  name={selectedListing === l.id ? 'check-circle' : 'circle'}
                  size={16}
                  color={selectedListing === l.id ? ACCENT : '#555'}
                />
                <Text style={modalStyles.optionText} numberOfLines={1}>{l.title || 'Untitled'}</Text>
              </Pressable>
            ))}

            <Text style={modalStyles.label}>Boost Type</Text>
            <View style={modalStyles.chipRow}>
              {(['quick', 'standard', 'extended'] as const).map(t => (
                <Pressable
                  key={t}
                  style={[modalStyles.chip, boostType === t && { backgroundColor: BOOST_COLORS[t] + '30', borderColor: BOOST_COLORS[t] }]}
                  onPress={() => setBoostType(t)}
                >
                  <Text style={[modalStyles.chipText, boostType === t && { color: BOOST_COLORS[t] }]}>
                    {BOOST_LABELS[t]} ({DURATION_LABELS[t]})
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={modalStyles.label}>Frequency</Text>
            <View style={modalStyles.chipRow}>
              {(['daily', 'every_3_days', 'weekly'] as const).map(f => (
                <Pressable
                  key={f}
                  style={[modalStyles.chip, frequency === f && { backgroundColor: ACCENT + '30', borderColor: ACCENT }]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={[modalStyles.chipText, frequency === f && { color: ACCENT }]}>
                    {FREQUENCY_LABELS[f]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={modalStyles.label}>Preferred Time</Text>
            <View style={modalStyles.chipRow}>
              {timeOptions.map(t => {
                const [h] = t.split(':').map(Number);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const hr = h % 12 || 12;
                return (
                  <Pressable
                    key={t}
                    style={[modalStyles.chip, preferredTime === t && { backgroundColor: ACCENT + '30', borderColor: ACCENT }]}
                    onPress={() => setPreferredTime(t)}
                  >
                    <Text style={[modalStyles.chipText, preferredTime === t && { color: ACCENT }]}>
                      {hr} {ampm}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              <LinearGradient colors={[ACCENT, '#e83a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modalStyles.saveBtnInner}>
                <Text style={modalStyles.saveBtnText}>{saving ? 'Saving...' : 'Create Schedule'}</Text>
              </LinearGradient>
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  creditsRow: { flexDirection: 'row', gap: 10 },
  creditCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  creditCount: { fontSize: 28, fontWeight: '800' },
  creditLabel: { fontSize: 12, fontWeight: '600', color: '#fff', marginTop: 4 },
  creditDuration: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  buyMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT + '30',
    backgroundColor: ACCENT + '08',
  },
  buyMoreText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  emptySubtext: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  activeBoostCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  activeBoostHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  activeBoostTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  activeBoostRemaining: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '31%',
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statIconRow: { marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'center' },
  scheduleCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  scheduleTop: { flexDirection: 'row', alignItems: 'center' },
  scheduleListing: { fontSize: 14, fontWeight: '600', color: '#fff' },
  scheduleInfo: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  scheduleNext: { fontSize: 11, color: BLUE, marginTop: 4 },
  scheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT + '30',
    borderStyle: 'dashed',
  },
  addScheduleText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  historyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start' },
  historyDate: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  historyListing: { fontSize: 14, fontWeight: '600', color: '#fff', marginTop: 2 },
  historyMetrics: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  historyMetricItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyMetricText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  historyPayment: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: '#fff' },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: BG,
    marginBottom: 6,
  },
  optionSelected: { borderWidth: 1, borderColor: ACCENT + '40' },
  optionText: { fontSize: 14, color: '#fff', flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: '#333',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  saveBtn: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  saveBtnInner: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
