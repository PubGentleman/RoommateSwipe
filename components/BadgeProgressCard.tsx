import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { BADGE_CONFIG, HostBadgeType } from '../hooks/useHostBadge';

interface ProgressCheck {
  label: string;
  met: boolean;
}

interface BadgeProgressCardProps {
  badgeType: 'top_agent' | 'top_company';
  earned: boolean;
  checks: ProgressCheck[];
}

export function BadgeProgressCard({ badgeType, earned, checks }: BadgeProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = BADGE_CONFIG[badgeType];
  const metCount = checks.filter(c => c.met).length;
  const totalCount = checks.length;
  const almostThere = !earned && totalCount - metCount <= 2;

  return (
    <View style={[styles.card, { borderColor: earned ? `${config.color}4D` : 'rgba(255,255,255,0.08)' }]}>
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={[styles.iconWrap, { backgroundColor: earned ? `${config.color}1F` : 'rgba(255,255,255,0.05)' }]}>
          <Feather name={config.icon} size={18} color={earned ? config.color : '#666'} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, earned ? { color: config.color } : { color: '#fff' }]}>
            {config.detailLabel}
          </Text>
          <Text style={styles.progress}>
            {earned ? 'Badge earned' : `${metCount} of ${totalCount} criteria met`}
          </Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
      </Pressable>

      {almostThere && !earned ? (
        <View style={styles.encouragement}>
          <Feather name="zap" size={12} color="#F59E0B" />
          <Text style={styles.encouragementText}>You're almost there!</Text>
        </View>
      ) : null}

      {expanded ? (
        <View style={styles.checklist}>
          {checks.map((check, i) => (
            <View key={i} style={styles.checkRow}>
              <Feather
                name={check.met ? 'check-circle' : 'circle'}
                size={14}
                color={check.met ? '#22C55E' : '#444'}
              />
              <Text style={[styles.checkLabel, check.met ? styles.checkMet : styles.checkUnmet]}>
                {check.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${(metCount / totalCount) * 100}%`,
              backgroundColor: earned ? config.color : '#555',
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  progress: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  encouragement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 8,
  },
  encouragementText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  checklist: {
    marginTop: 12,
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontSize: 13,
    flex: 1,
  },
  checkMet: {
    color: '#ccc',
  },
  checkUnmet: {
    color: '#666',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#333',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
