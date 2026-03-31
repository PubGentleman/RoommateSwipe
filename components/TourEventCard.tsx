import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from './VectorIcons';
import { Image } from 'expo-image';

const ACCENT = '#ff6b5b';

interface TourRSVP {
  user_id: string;
  status: 'going' | 'maybe' | 'not_going' | 'pending';
  responded_at?: string;
}

interface TourEventCardProps {
  tour: {
    id: string;
    tour_date: string;
    tour_time: string;
    duration_minutes: number;
    location?: string;
    notes?: string;
    status: string;
    rsvps?: TourRSVP[];
    creator?: { full_name: string; avatar_url?: string };
    listing?: { title?: string; address?: string; city?: string; photos?: string[] };
  };
  currentUserId?: string;
  onRSVP?: (tourId: string, status: 'going' | 'maybe' | 'not_going') => void;
  onCancel?: (tourId: string) => void;
  isCreator?: boolean;
}

export function TourEventCard({ tour, currentUserId, onRSVP, onCancel, isCreator }: TourEventCardProps) {
  const rsvps = tour.rsvps || [];
  const goingCount = rsvps.filter(r => r.status === 'going').length;
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;
  const pendingCount = rsvps.filter(r => r.status === 'pending').length;
  const userRsvp = rsvps.find(r => r.user_id === currentUserId);
  const isCancelled = tour.status === 'cancelled';

  const dateStr = formatTourDate(tour.tour_date);
  const timeStr = formatTourTime(tour.tour_time);

  return (
    <View style={[styles.card, isCancelled && styles.cardCancelled]}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Feather name="calendar" size={16} color={isCancelled ? '#666' : ACCENT} />
        </View>
        <Text style={[styles.headerText, isCancelled && { color: '#666' }]}>
          {isCancelled ? 'Tour Cancelled' : 'Tour Scheduled'}
        </Text>
        {isCreator && !isCancelled ? (
          <Pressable onPress={() => onCancel?.(tour.id)} hitSlop={8}>
            <Feather name="x" size={16} color="#666" />
          </Pressable>
        ) : null}
      </View>

      {tour.listing ? (
        <View style={styles.listingRow}>
          {tour.listing.photos?.[0] ? (
            <Image source={{ uri: tour.listing.photos[0] }} style={styles.listingThumb} />
          ) : null}
          <Text style={styles.listingTitle} numberOfLines={1}>
            {tour.listing.title || tour.listing.address || 'Listing'}
          </Text>
        </View>
      ) : null}

      <View style={styles.detailRow}>
        <Feather name="clock" size={13} color="#999" />
        <Text style={styles.detailText}>{dateStr} at {timeStr}</Text>
      </View>

      {tour.location ? (
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={13} color="#999" />
          <Text style={styles.detailText}>{tour.location}</Text>
        </View>
      ) : null}

      <View style={styles.detailRow}>
        <Feather name="clock" size={13} color="#999" />
        <Text style={styles.detailText}>{tour.duration_minutes} min</Text>
      </View>

      {tour.notes ? (
        <View style={styles.detailRow}>
          <Feather name="file-text" size={13} color="#999" />
          <Text style={styles.detailText}>{tour.notes}</Text>
        </View>
      ) : null}

      {!isCancelled ? (
        <>
          <View style={styles.rsvpButtons}>
            {(['going', 'maybe', 'not_going'] as const).map(status => {
              const isActive = userRsvp?.status === status;
              const label = status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't make it";
              const colors: Record<string, string> = {
                going: '#22C55E',
                maybe: '#F59E0B',
                not_going: '#EF4444',
              };
              return (
                <Pressable
                  key={status}
                  style={[
                    styles.rsvpBtn,
                    isActive && { backgroundColor: colors[status] + '20', borderColor: colors[status] },
                  ]}
                  onPress={() => onRSVP?.(tour.id, status)}
                >
                  <Text style={[
                    styles.rsvpBtnText,
                    isActive && { color: colors[status] },
                  ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.rsvpSummary}>
            {goingCount} going
            {maybeCount > 0 ? ` \u00B7 ${maybeCount} maybe` : ''}
            {pendingCount > 0 ? ` \u00B7 ${pendingCount} pending` : ''}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function formatTourDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTourTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return timeStr;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    gap: 8,
  },
  cardCancelled: {
    borderColor: '#333',
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  listingThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  listingTitle: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#bbb',
    fontSize: 13,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rsvpBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  rsvpBtnText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  rsvpSummary: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
});
