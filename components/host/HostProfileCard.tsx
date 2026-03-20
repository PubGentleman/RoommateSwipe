import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Feather } from '../VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing } from '../../constants/theme';
import {
  shouldShowMatchScore,
  getHostBadgeLabel,
  getHostBadgeColor,
  getHostBadgeIcon,
  HostType,
} from '../../utils/hostTypeUtils';

interface HostProfileCardProps {
  host: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    hostType: HostType;
    companyName?: string;
    companyLogoUrl?: string;
    licenseNumber?: string;
    agencyName?: string;
    unitsManaged?: number;
    verifiedBusiness?: boolean;
    avgResponseHours?: number;
    zodiacSign?: string;
    matchScore?: number;
  };
}

export function HostProfileCard({ host }: HostProfileCardProps) {
  const { theme } = useTheme();
  const showMatch = shouldShowMatchScore(host.hostType);
  const badgeLabel = getHostBadgeLabel(host.hostType);
  const badgeColor = getHostBadgeColor(host.hostType);
  const badgeIcon = getHostBadgeIcon(host.hostType);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: theme.primary + '25' }]}>
          <Text style={[Typography.h3, { color: theme.primary }]}>
            {(host.companyName ?? host.fullName).charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[Typography.body, { fontWeight: '700', color: theme.text }]}>
            {host.hostType === 'company' ? host.companyName : host.fullName}
          </Text>

          {host.hostType === 'agent' && host.agencyName ? (
            <Text style={[Typography.small, { color: theme.textSecondary }]}>
              {host.agencyName}
            </Text>
          ) : null}
          {host.hostType === 'company' && host.unitsManaged ? (
            <Text style={[Typography.small, { color: theme.textSecondary }]}>
              {host.unitsManaged} units managed
            </Text>
          ) : null}
          {host.hostType === 'individual' && host.zodiacSign ? (
            <Text style={[Typography.small, { color: theme.textSecondary }]}>
              {host.zodiacSign}
            </Text>
          ) : null}
        </View>

        {host.hostType !== 'individual' ? (
          <View style={[styles.badge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
            <Feather name={badgeIcon} size={11} color={badgeColor} />
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {showMatch && host.matchScore !== undefined ? (
        <View style={[styles.matchRow, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '25' }]}>
          <Feather name="heart" size={14} color={theme.primary} />
          <Text style={[Typography.body, { color: theme.primary, fontWeight: '800', marginLeft: 6 }]}>
            {host.matchScore}% Match
          </Text>
        </View>
      ) : null}

      {host.hostType !== 'individual' ? (
        <View style={styles.statsRow}>
          {host.verifiedBusiness ? (
            <View style={[styles.statChip, { backgroundColor: '#22C55E15', borderColor: '#22C55E30' }]}>
              <Feather name="check-circle" size={11} color="#22C55E" />
              <Text style={[styles.statText, { color: '#22C55E' }]}>Verified</Text>
            </View>
          ) : null}
          {host.avgResponseHours !== undefined ? (
            <View style={[styles.statChip, { backgroundColor: theme.border + '60', borderColor: theme.border }]}>
              <Feather name="clock" size={11} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                Responds in {host.avgResponseHours < 1
                  ? '< 1hr'
                  : `${Math.round(host.avgResponseHours)}hrs`}
              </Text>
            </View>
          ) : null}
          {host.hostType === 'agent' && host.licenseNumber ? (
            <View style={[styles.statChip, { backgroundColor: theme.border + '60', borderColor: theme.border }]}>
              <Feather name="file-text" size={11} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                #{host.licenseNumber}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
