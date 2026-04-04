import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { getMyReports } from '../../services/moderationService';

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: 'clock', color: '#f59e0b', label: 'Under Review' },
  reviewed: { icon: 'eye', color: '#3b82f6', label: 'Being Reviewed' },
  resolved: { icon: 'check-circle', color: '#22c55e', label: 'Resolved' },
  dismissed: { icon: 'x-circle', color: '#6b7280', label: 'Dismissed' },
};

const REASON_LABELS: Record<string, string> = {
  fake_listing: 'Fake listing',
  scam_fraud: 'Scam/fraud',
  fake_photos: 'Fake photos',
  stolen_photos: 'Stolen photos',
  wrong_info: 'Wrong info',
  already_rented: 'Already rented',
  discriminatory: 'Discriminatory',
  inappropriate_photos: 'Inappropriate photos',
  fake_profile: 'Fake profile',
  harassment: 'Harassment',
  scam: 'Scam',
  inappropriate: 'Inappropriate',
  underage: 'Underage',
  impersonation: 'Impersonation',
  spam: 'Spam',
  other: 'Other',
};

const TYPE_LABELS: Record<string, string> = {
  user: 'User',
  listing: 'Listing',
  group: 'Group',
};

export function MyReportsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [reports, setReports] = useState<Array<{
    id: string;
    reportedType: string;
    reason: string;
    status: string;
    createdAt: string;
    resolvedAt?: string;
    resolution?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getMyReports(user.id);
      setReports(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} tintColor={theme.primary} />}
      >
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="flag" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
              No reports submitted yet
            </ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs, textAlign: 'center' }]}>
              Reports you submit will appear here with their status
            </ThemedText>
          </View>
        ) : (
          reports.map(report => {
            const config = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
            const reasonLabel = REASON_LABELS[report.reason] || report.reason;
            const typeLabel = TYPE_LABELS[report.reportedType] || report.reportedType;

            return (
              <View key={report.id} style={[styles.reportCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <View style={styles.reportHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
                    <Feather name={config.icon as any} size={14} color={config.color} />
                    <ThemedText style={[Typography.caption, { color: config.color, fontWeight: '600', marginLeft: 4 }]}>
                      {config.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    {formatDate(report.createdAt)}
                  </ThemedText>
                </View>

                <ThemedText style={[Typography.body, { fontWeight: '600', marginTop: Spacing.sm }]}>
                  {typeLabel}: {reasonLabel}
                </ThemedText>

                {report.resolution ? (
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4, fontStyle: 'italic' }]}>
                    "{report.resolution}"
                  </ThemedText>
                ) : (
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
                    {report.status === 'pending' || report.status === 'reviewed'
                      ? 'Being reviewed by our team'
                      : 'No additional details'}
                  </ThemedText>
                )}

                {report.resolvedAt ? (
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                    Resolved {formatDate(report.resolvedAt)}
                  </ThemedText>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
});
