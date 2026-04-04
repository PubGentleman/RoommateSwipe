import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { getModerationQueue, handleModerationAction, type ModerationReportItem } from '../../services/moderationService';

const SEVERITY_FILTERS = [
  { id: null, label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const TYPE_FILTERS = [
  { id: null, label: 'All' },
  { id: 'user', label: 'Users' },
  { id: 'listing', label: 'Listings' },
  { id: 'group', label: 'Groups' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#22c55e',
};

const REASON_LABELS: Record<string, string> = {
  fake_listing: 'Fake or misleading listing',
  scam_fraud: 'Scam or fraud attempt',
  fake_photos: "Photos don't match reality",
  stolen_photos: 'Stolen photos',
  wrong_info: 'Incorrect information',
  already_rented: 'Already rented',
  discriminatory: 'Discriminatory content',
  inappropriate_photos: 'Inappropriate photos',
  fake_profile: 'Fake profile',
  harassment: 'Harassment or threats',
  scam: 'Scam or fraud',
  inappropriate: 'Inappropriate content',
  underage: 'May be underage',
  impersonation: 'Impersonation',
  spam: 'Spam',
  inappropriate_name: 'Inappropriate group name',
  spam_group: 'Spam group',
  suspicious: 'Suspicious activity',
  other: 'Other',
};

export function ModerationQueueScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [reports, setReports] = useState<ModerationReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const data = await getModerationQueue({
        severity: severityFilter || undefined,
        type: typeFilter || undefined,
      });
      setReports(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severityFilter, typeFilter]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const onAction = async (reportId: string, action: 'dismiss' | 'hide_listing' | 'restrict_user' | 'warn') => {
    const labels: Record<string, string> = {
      dismiss: 'Dismiss this report?',
      hide_listing: 'Hide this listing from the platform?',
      restrict_user: 'Restrict this user account?',
      warn: 'Send a warning to this user?',
    };

    const confirmed = await confirm({
      title: 'Confirm Action',
      message: labels[action],
      confirmText: 'Confirm',
      variant: action === 'dismiss' ? 'default' : 'danger',
    });

    if (!confirmed || !user?.id) return;

    try {
      await handleModerationAction(reportId, action, user.id);
      await loadReports();
    } catch {}
  };

  const renderFilterChips = (
    items: Array<{ id: string | null; label: string }>,
    active: string | null,
    onSelect: (id: string | null) => void
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
      {items.map(item => (
        <Pressable
          key={item.label}
          onPress={() => onSelect(item.id)}
          style={[
            styles.filterChip,
            {
              backgroundColor: active === item.id ? theme.primary : theme.backgroundSecondary,
              borderColor: active === item.id ? theme.primary : theme.border,
            },
          ]}
        >
          <ThemedText style={[Typography.caption, { color: active === item.id ? '#FFF' : theme.textSecondary }]}>
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderReportCard = (report: ModerationReportItem) => {
    const severityColor = SEVERITY_COLORS[report.severity] || '#6b7280';
    const reasonLabel = REASON_LABELS[report.reason] || report.reason;
    const timeAgo = getTimeAgo(report.createdAt);

    return (
      <View key={report.id} style={[styles.reportCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <View style={styles.reportHeader}>
          <View style={[styles.severityBadge, { backgroundColor: severityColor + '20' }]}>
            <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
            <ThemedText style={[Typography.caption, { color: severityColor, fontWeight: '700', textTransform: 'uppercase' }]}>
              {report.severity}
            </ThemedText>
          </View>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {timeAgo}
          </ThemedText>
        </View>

        <ThemedText style={[Typography.body, { fontWeight: '600', marginTop: Spacing.sm }]}>
          {report.reportedType === 'listing' ? 'Listing' : report.reportedType === 'group' ? 'Group' : 'User'}: {report.reportedId.slice(0, 8)}...
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
          {reasonLabel} ({report.reportCount} {report.reportCount === 1 ? 'report' : 'reports'})
        </ThemedText>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
          Reporter: {report.reporterName}
        </ThemedText>

        {report.details ? (
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4, fontStyle: 'italic' }]} numberOfLines={2}>
            "{report.details}"
          </ThemedText>
        ) : null}

        {report.evidencePaths.length > 0 ? (
          <View style={styles.evidenceRow}>
            {report.evidencePaths.map((path, i) => (
              <View key={i} style={[styles.evidenceThumb, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="image" size={16} color={theme.textSecondary} />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, { borderColor: theme.border }]}
            onPress={() => onAction(report.id, 'dismiss')}
          >
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>Dismiss</ThemedText>
          </Pressable>

          {report.reportedType === 'listing' ? (
            <Pressable
              style={[styles.actionButton, { borderColor: '#ef4444', backgroundColor: '#ef444410' }]}
              onPress={() => onAction(report.id, 'hide_listing')}
            >
              <ThemedText style={[Typography.caption, { color: '#ef4444' }]}>Hide Listing</ThemedText>
            </Pressable>
          ) : null}

          {report.reportedType === 'user' ? (
            <Pressable
              style={[styles.actionButton, { borderColor: '#ef4444', backgroundColor: '#ef444410' }]}
              onPress={() => onAction(report.id, 'restrict_user')}
            >
              <ThemedText style={[Typography.caption, { color: '#ef4444' }]}>Restrict</ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.actionButton, { borderColor: '#f59e0b', backgroundColor: '#f59e0b10' }]}
            onPress={() => onAction(report.id, 'warn')}
          >
            <ThemedText style={[Typography.caption, { color: '#f59e0b' }]}>Warn</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundDefault }]}>
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
        {renderFilterChips(SEVERITY_FILTERS, severityFilter, setSeverityFilter)}
        {renderFilterChips(TYPE_FILTERS, typeFilter, setTypeFilter)}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} tintColor={theme.primary} />}
      >
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
              No pending reports
            </ThemedText>
          </View>
        ) : (
          reports.map(renderReportCard)
        )}
      </ScrollView>
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  reportCard: {
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  evidenceThumb: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
});
