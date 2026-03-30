import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from './VectorIcons';
import { PreformedGroupMember } from '../types/models';

interface Props {
  member: PreformedGroupMember;
  isLead?: boolean;
  isCurrentUser?: boolean;
  onRemove?: () => void;
  showRemove?: boolean;
}

export function GroupMemberCard({ member, isLead, isCurrentUser, onRemove, showRemove }: Props) {
  const statusColor = member.status === 'joined' ? '#22C55E' : member.status === 'declined' ? '#EF4444' : '#F59E0B';
  const statusLabel = member.status === 'joined' ? 'Joined' : member.status === 'declined' ? 'Declined' : 'Pending';

  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: `${statusColor}22` }]}>
        <Feather
          name={member.status === 'joined' ? 'user' : 'clock'}
          size={18}
          color={statusColor}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {isCurrentUser ? 'You' : member.name}
          </Text>
          {isLead ? (
            <View style={styles.leadBadge}>
              <Text style={styles.leadBadgeText}>Lead</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {showRemove && !isCurrentUser && !isLead ? (
        <Pressable style={styles.removeBtn} onPress={onRemove}>
          <Feather name="x" size={16} color="#EF4444" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  leadBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leadBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
