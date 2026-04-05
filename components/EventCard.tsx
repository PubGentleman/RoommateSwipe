import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from './VectorIcons';
import { RhomeEvent, getEventTypeInfo, formatEventDate } from '../services/eventService';

interface EventCardProps {
  event: RhomeEvent;
  onPress: () => void;
  compact?: boolean;
  onRsvp?: (status: 'going' | 'maybe' | 'not_going') => void;
}

export function EventCard({ event, onPress, compact, onRsvp }: EventCardProps) {
  const typeInfo = getEventTypeInfo(event.eventType);
  const d = new Date(event.startsAt);
  const dayNum = d.getDate();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthStr = months[d.getMonth()];

  if (compact) {
    return (
      <Pressable style={styles.compactCard} onPress={onPress}>
        <View style={[styles.compactDate, { borderLeftColor: typeInfo.color }]}>
          <Text style={styles.compactDayNum}>{dayNum}</Text>
          <Text style={styles.compactMonth}>{monthStr}</Text>
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.compactMeta} numberOfLines={1}>
            {formatEventDate(event.startsAt)}
          </Text>
          {event.locationName ? (
            <Text style={styles.compactLocation} numberOfLines={1}>
              {event.locationName}
            </Text>
          ) : null}
        </View>
        <View style={styles.compactRight}>
          {event.myRsvp === 'going' ? (
            <View style={[styles.compactRsvpBadge, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
              <Feather name="check" size={10} color="#ff6b5b" />
            </View>
          ) : (
            <Text style={styles.compactAttendees}>{event.attendeeCount}</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.coverWrap}>
        {event.coverPhoto ? (
          <Image source={{ uri: event.coverPhoto }} style={styles.coverImage} />
        ) : (
          <LinearGradient
            colors={[typeInfo.color + '33', typeInfo.color + '11']}
            style={styles.coverPlaceholder}
          >
            <View style={[styles.coverIconWrap, { backgroundColor: typeInfo.color + '44' }]}>
              <Feather name={typeInfo.icon} size={28} color={typeInfo.color} />
            </View>
          </LinearGradient>
        )}
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + 'DD' }]}>
          <Feather name={typeInfo.icon} size={10} color="#fff" />
          <Text style={styles.typeBadgeText}>{typeInfo.label}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeDay}>{dayNum}</Text>
          <Text style={styles.dateBadgeMonth}>{monthStr}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        {event.locationName ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.metaText} numberOfLines={1}>{event.locationName}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Feather name="clock" size={12} color="rgba(255,255,255,0.4)" />
          <Text style={styles.metaText}>{formatEventDate(event.startsAt)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.attendeesRow}>
            <Feather name="users" size={12} color="rgba(255,255,255,0.35)" />
            <Text style={styles.attendeesText}>
              {event.attendeeCount} going
              {event.maxAttendees ? ` · ${event.maxAttendees - event.attendeeCount} spots left` : ''}
            </Text>
          </View>
          {onRsvp ? (
            event.myRsvp === 'going' ? (
              <View style={styles.rsvpGoingBtn}>
                <Feather name="check" size={12} color="#ff6b5b" />
                <Text style={styles.rsvpGoingText}>Going</Text>
              </View>
            ) : (
              <Pressable
                style={styles.rsvpBtn}
                onPress={() => onRsvp('going')}
              >
                <Text style={styles.rsvpBtnText}>RSVP</Text>
              </Pressable>
            )
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverWrap: {
    height: 140,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  dateBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  dateBadgeDay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  dateBadgeMonth: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendeesText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  rsvpBtn: {
    borderWidth: 1,
    borderColor: '#ff6b5b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  rsvpGoingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rsvpGoingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  compactDate: {
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: 8,
  },
  compactDayNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  compactMonth: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  compactContent: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  compactMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },
  compactLocation: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  compactRight: {
    alignItems: 'center',
  },
  compactRsvpBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAttendees: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
});
