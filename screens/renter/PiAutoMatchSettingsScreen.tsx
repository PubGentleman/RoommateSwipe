import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { PiAutoGroup } from '../../types/models';
import {
  isAutoMatchEnabled,
  setAutoMatchEnabled,
  getAutoMatchStats,
  getUserAutoGroups,
} from '../../services/piAutoMatchService';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type AutoMatchStatusType = 'forming' | 'pending_acceptance' | 'partial' | 'ready' | 'invited' | 'claimed' | 'placed' | 'expired' | 'dissolved';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  forming: { label: 'Forming', color: '#fbbf24', icon: 'loader' },
  pending_acceptance: { label: 'Pending', color: '#f59e0b', icon: 'clock' },
  partial: { label: 'Partial', color: '#fb923c', icon: 'users' },
  ready: { label: 'Ready', color: '#4ade80', icon: 'check-circle' },
  invited: { label: 'Invited', color: '#60a5fa', icon: 'send' },
  claimed: { label: 'Claimed', color: '#a78bfa', icon: 'home' },
  placed: { label: 'Placed', color: '#34d399', icon: 'award' },
  expired: { label: 'Expired', color: '#6b7280', icon: 'x-circle' },
  dissolved: { label: 'Dissolved', color: '#ef4444', icon: 'slash' },
};

export const PiAutoMatchSettingsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const planLimits = getRenterPlanLimits(renterPlan);

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [stats, setStats] = useState<{
    totalGroups: number;
    activeGroup: PiAutoGroup | null;
    pendingInvites: number;
    lastMatchAttempt: string | null;
  } | null>(null);
  const [groups, setGroups] = useState<PiAutoGroup[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [isEnabled, matchStats, userGroups] = await Promise.all([
        isAutoMatchEnabled(user.id),
        getAutoMatchStats(user.id),
        getUserAutoGroups(user.id),
      ]);
      setEnabled(isEnabled);
      setStats(matchStats);
      setGroups(userGroups);
    } catch {
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (value: boolean) => {
    if (!user?.id) return;
    setToggling(true);
    setEnabled(value);
    try {
      const success = await setAutoMatchEnabled(user.id, value);
      if (!success) {
        setEnabled(!value);
        Alert.alert('Error', 'Could not update setting. Please try again.');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      setEnabled(!value);
    } finally {
      setToggling(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] ?? { label: status, color: '#6b7280', icon: 'help-circle' };
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={28} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Pi Auto-Match</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Pi Auto-Match</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.heroCard}
        >
          <View style={styles.piIconWrapper}>
            <Text style={styles.piIcon}>π</Text>
          </View>
          <ThemedText style={styles.heroTitle}>Pi Auto-Match</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Let Pi automatically find and group you with compatible roommates based on your profile and preferences.
          </ThemedText>
        </LinearGradient>

        <View style={[styles.settingCard, { backgroundColor: theme.card }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Enable Auto-Match</ThemedText>
              <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>
                Pi will scan for compatible roommates and invite you to groups automatically
              </ThemedText>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              disabled={toggling}
              trackColor={{ false: '#3e3e3e', true: '#ff6b5b' + '80' }}
              thumbColor={enabled ? '#ff6b5b' : '#888'}
            />
          </View>
        </View>

        <View style={[styles.planCard, { backgroundColor: theme.card }]}>
          <View style={styles.planHeader}>
            <Feather name="zap" size={16} color={theme.primary} />
            <ThemedText style={styles.planTitle}>Your Plan: {planLimits.label}</ThemedText>
          </View>
          <View style={styles.planDetails}>
            <View style={styles.planRow}>
              <ThemedText style={[styles.planLabel, { color: theme.textSecondary }]}>
                Max pending groups
              </ThemedText>
              <ThemedText style={styles.planValue}>
                {planLimits.maxPendingAutoGroups}
              </ThemedText>
            </View>
            <View style={styles.planRow}>
              <ThemedText style={[styles.planLabel, { color: theme.textSecondary }]}>
                Match priority
              </ThemedText>
              <ThemedText style={[styles.planValue, { color: theme.primary }]}>
                {planLimits.autoMatchPriority === 'highest'
                  ? 'Highest'
                  : planLimits.autoMatchPriority === 'priority'
                  ? 'Priority'
                  : 'Standard'}
              </ThemedText>
            </View>
            <View style={styles.planRow}>
              <ThemedText style={[styles.planLabel, { color: theme.textSecondary }]}>
                Pi messages/day
              </ThemedText>
              <ThemedText style={styles.planValue}>
                {planLimits.piMessagesPerDay === -1 ? 'Unlimited' : planLimits.piMessagesPerDay}
              </ThemedText>
            </View>
          </View>
          {renterPlan === 'free' ? (
            <Pressable
              style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Profile', { screen: 'Plans' })}
            >
              <Feather name="arrow-up-circle" size={16} color="#fff" />
              <Text style={styles.upgradeBtnText}>Upgrade for priority matching</Text>
            </Pressable>
          ) : null}
        </View>

        {stats ? (
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={16} color={theme.primary} />
              <ThemedText style={styles.sectionTitle}>Activity</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{stats.totalGroups}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Groups
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{stats.pendingInvites}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Pending
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statNumber, { fontSize: 13 }]}>
                  {formatDate(stats.lastMatchAttempt)}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Last Match
                </ThemedText>
              </View>
            </View>
          </View>
        ) : null}

        {groups.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="layers" size={16} color={theme.primary} />
              <ThemedText style={styles.sectionTitle}>Your Pi Groups</ThemedText>
            </View>
            {groups.map(group => {
              const statusConf = getStatusConfig(group.status);
              return (
                <View
                  key={group.id}
                  style={[styles.groupCard, { backgroundColor: theme.card }]}
                >
                  <View style={styles.groupHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConf.color + '20' }]}>
                      <Feather name={statusConf.icon as any} size={12} color={statusConf.color} />
                      <Text style={[styles.statusText, { color: statusConf.color }]}>
                        {statusConf.label}
                      </Text>
                    </View>
                    <ThemedText style={[styles.groupDate, { color: theme.textSecondary }]}>
                      {formatDate(group.created_at)}
                    </ThemedText>
                  </View>
                  <View style={styles.groupDetails}>
                    <View style={styles.groupDetailRow}>
                      <Feather name="users" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.groupDetailText, { color: theme.textSecondary }]}>
                        {group.max_members} {group.max_members === 1 ? 'member' : 'members'} max
                      </ThemedText>
                    </View>
                    {group.city ? (
                      <View style={styles.groupDetailRow}>
                        <Feather name="map-pin" size={14} color={theme.textSecondary} />
                        <ThemedText style={[styles.groupDetailText, { color: theme.textSecondary }]}>
                          {group.city}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.infoSection}>
          <Feather name="info" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Pi runs periodically to assemble groups. You will receive a notification when a match is found. Invites expire after 48 hours if not accepted.
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: Spacing.md,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  piIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  piIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  settingCard: {
    borderRadius: BorderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    borderRadius: BorderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  planDetails: {
    gap: 8,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLabel: {
    fontSize: 14,
  },
  planValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: 14,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsCard: {
    borderRadius: BorderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupCard: {
    borderRadius: BorderRadius.md,
    padding: 14,
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupDate: {
    fontSize: 12,
  },
  groupDetails: {
    gap: 6,
  },
  groupDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupDetailText: {
    fontSize: 13,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
