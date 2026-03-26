import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from './VectorIcons';

interface ChatActionCardProps {
  message: any;
  currentUserId: string;
  onConfirmVisit?: (messageId: string) => void;
  onDeclineVisit?: (messageId: string) => void;
  onProposeNewTime?: (messageId: string, metadata: any) => void;
  onAcceptBooking?: (messageId: string, metadata: any) => void;
  onDeclineBooking?: (messageId: string) => void;
  actionLoading?: string | null;
  agentInfo?: {
    name?: string;
    isVerifiedAgent?: boolean;
    companyName?: string;
  } | null;
  groupSize?: number;
  isGroupLeader?: boolean;
}

const GOLD = '#D4AF37';

export const ChatActionCard: React.FC<ChatActionCardProps> = ({
  message,
  currentUserId,
  onConfirmVisit,
  onDeclineVisit,
  onProposeNewTime,
  onAcceptBooking,
  onDeclineBooking,
  actionLoading,
  agentInfo,
  groupSize,
  isGroupLeader,
}) => {
  const metadata = message.metadata || {};
  const isOwn = message.senderId === currentUserId || message.sender_id === currentUserId;
  const status = metadata.status || 'pending';
  const isLoading = actionLoading === (message.id || message.messageId);

  if (message.message_type === 'visit_request') {
    return renderVisitCard();
  }
  if (message.message_type === 'booking_offer') {
    return renderBookingCard();
  }
  return null;

  function renderVisitCard() {
    const proposedDate = metadata.proposed_date
      ? new Date(metadata.proposed_date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
      : 'Date TBD';

    const proposedTime = metadata.proposed_time
      ? (() => {
          const [h, m] = metadata.proposed_time.split(':').map(Number);
          const d = new Date();
          d.setHours(h, m);
          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        })()
      : '';

    return (
      <View style={[s.card, s.visitCard]}>
        <View style={s.cardHeader}>
          <View style={s.cardIconWrap}>
            <Feather name="home" size={16} color="#ff6b5b" />
          </View>
          <Text style={s.cardTitle}>Visit Request</Text>
          {status !== 'pending' ? renderStatusBadge() : null}
        </View>
        {agentInfo?.isVerifiedAgent ? (
          <View style={s.verifiedBadge}>
            <Feather name="check-circle" size={10} color="#3b82f6" />
            <Text style={s.verifiedBadgeText}>Verified Agent</Text>
          </View>
        ) : null}
        <Text style={s.cardAddress} numberOfLines={2}>{metadata.address || 'Address pending'}</Text>
        <Text style={s.cardDateTime}>
          {proposedDate}{proposedTime ? ` \u00B7 ${proposedTime}` : ''}
        </Text>
        {groupSize && groupSize > 1 ? (
          <Text style={s.groupLabel}>Group of {groupSize}</Text>
        ) : null}
        {metadata.note ? <Text style={s.cardNote}>{`"${metadata.note}"`}</Text> : null}

        {status === 'pending' && !isOwn && (isGroupLeader !== false) ? (
          <View style={s.cardActions}>
            <Pressable
              style={[s.actionBtn, s.confirmBtn]}
              onPress={() => onConfirmVisit?.(message.id)}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={s.actionBtnText}>Confirm</Text>
              )}
            </Pressable>
            <Pressable
              style={[s.actionBtn, s.proposeBtn]}
              onPress={() => onProposeNewTime?.(message.id, metadata)}
              disabled={isLoading}
            >
              <Text style={s.proposeBtnText}>Propose New Time</Text>
            </Pressable>
            <Pressable
              style={[s.actionBtn, s.declineBtn]}
              onPress={() => onDeclineVisit?.(message.id)}
              disabled={isLoading}
            >
              <Text style={s.declineBtnText}>Decline</Text>
            </Pressable>
          </View>
        ) : null}
        {status === 'pending' && isGroupLeader === false ? (
          <Text style={s.readOnlyNote}>Only the group leader can respond</Text>
        ) : null}
      </View>
    );
  }

  function renderBookingCard() {
    const moveIn = metadata.move_in_date
      ? new Date(metadata.move_in_date + 'T12:00:00').toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Date TBD';

    return (
      <View style={[s.card, s.bookingCard]}>
        <View style={s.cardHeader}>
          <View style={[s.cardIconWrap, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
            <Feather name="key" size={16} color={GOLD} />
          </View>
          <Text style={s.cardTitle}>Booking Offer</Text>
          {status !== 'pending' ? renderStatusBadge() : null}
        </View>
        {agentInfo?.isVerifiedAgent ? (
          <View style={s.verifiedBadge}>
            <Feather name="check-circle" size={10} color="#3b82f6" />
            <Text style={s.verifiedBadgeText}>Verified Agent</Text>
          </View>
        ) : null}
        {agentInfo?.companyName ? (
          <Text style={s.companyNameText}>{agentInfo.companyName}</Text>
        ) : null}
        <Text style={s.cardAddress} numberOfLines={2}>{metadata.address || 'Property address'}</Text>
        <View style={s.bookingDetails}>
          <View style={s.bookingDetailRow}>
            <Text style={s.bookingLabel}>Move-in</Text>
            <Text style={s.bookingValue}>{moveIn}</Text>
          </View>
          <View style={s.bookingDetailRow}>
            <Text style={s.bookingLabel}>Lease</Text>
            <Text style={s.bookingValue}>{metadata.lease_length || 'TBD'}</Text>
          </View>
          <View style={s.bookingDetailRow}>
            <Text style={s.bookingLabel}>Rent</Text>
            <Text style={s.bookingValue}>${(metadata.monthly_rent || 0).toLocaleString()}/mo</Text>
          </View>
          {metadata.security_deposit ? (
            <View style={s.bookingDetailRow}>
              <Text style={s.bookingLabel}>Deposit</Text>
              <Text style={s.bookingValue}>${(metadata.security_deposit || 0).toLocaleString()}</Text>
            </View>
          ) : null}
        </View>
        {groupSize && groupSize > 1 ? (
          <View style={s.bookingDetailRow}>
            <Text style={s.bookingLabel}>Group</Text>
            <Text style={s.bookingValue}>Booking for a group of {groupSize}</Text>
          </View>
        ) : null}
        {metadata.note ? <Text style={s.cardNote}>{`"${metadata.note}"`}</Text> : null}

        {status === 'pending' && !isOwn && (isGroupLeader !== false) ? (
          <View style={s.cardActions}>
            <Pressable
              style={[s.actionBtn, s.confirmBtn, { flex: 1 }]}
              onPress={() => onAcceptBooking?.(message.id, metadata)}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={s.actionBtnText}>Accept Booking</Text>
              )}
            </Pressable>
            <Pressable
              style={[s.actionBtn, s.declineBtn]}
              onPress={() => onDeclineBooking?.(message.id)}
              disabled={isLoading}
            >
              <Text style={s.declineBtnText}>Decline</Text>
            </Pressable>
          </View>
        ) : null}
        {status === 'pending' && isGroupLeader === false ? (
          <Text style={s.readOnlyNote}>Only the group leader can respond</Text>
        ) : null}
      </View>
    );
  }

  function renderStatusBadge() {
    const configs: Record<string, { bg: string; text: string; label: string; icon: string }> = {
      confirmed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Visit Confirmed', icon: 'check-circle' },
      declined: { bg: 'rgba(100,100,100,0.15)', text: '#888', label: status === 'declined' && message.message_type === 'booking_offer' ? 'Booking Declined' : 'Visit Declined', icon: 'x-circle' },
      counter_proposed: { bg: 'rgba(255,165,0,0.15)', text: '#FFA500', label: 'New Time Proposed', icon: 'clock' },
      accepted: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Booking Confirmed', icon: 'check-circle' },
    };
    const cfg = configs[status] || configs.declined;
    return (
      <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon as any} size={12} color={cfg.text} />
        <Text style={[s.statusText, { color: cfg.text }]}>{cfg.label}</Text>
      </View>
    );
  }
};

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    maxWidth: 320,
  },
  visitCard: {
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
  },
  bookingCard: {
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  cardAddress: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  cardDateTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: '#22c55e',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proposeBtn: {
    backgroundColor: 'rgba(255,165,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,165,0,0.3)',
  },
  proposeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFA500',
  },
  declineBtn: {
    backgroundColor: 'rgba(100,100,100,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100,100,100,0.3)',
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bookingDetails: {
    gap: 4,
    marginBottom: 8,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  bookingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
  },
  companyNameText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 4,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  readOnlyNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
