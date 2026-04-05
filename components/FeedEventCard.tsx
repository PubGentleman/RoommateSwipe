import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from './VectorIcons';
import type { FeedEvent } from '../services/activityFeedService';

interface Props {
  event: FeedEvent;
  onPress: () => void;
  index?: number;
}

const EVENT_CONFIG: Record<string, { icon: string; iconColor: string; iconBg: string; cardBg?: string }> = {
  new_match: { icon: 'heart', iconColor: '#ff6b5b', iconBg: 'rgba(255,107,91,0.15)', cardBg: 'rgba(255,107,91,0.04)' },
  listing_price_drop: { icon: 'trending-down', iconColor: '#22C55E', iconBg: 'rgba(34,197,94,0.15)' },
  group_member_added: { icon: 'users', iconColor: '#6C5CE7', iconBg: 'rgba(108,92,231,0.15)' },
  group_joined: { icon: 'user-plus', iconColor: '#6C5CE7', iconBg: 'rgba(108,92,231,0.15)' },
  group_formed: { icon: 'users', iconColor: '#6C5CE7', iconBg: 'rgba(108,92,231,0.15)' },
  group_property_linked: { icon: 'link', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.15)' },
  profile_view: { icon: 'eye', iconColor: '#A855F7', iconBg: 'rgba(168,85,247,0.15)' },
  match_milestone: { icon: 'award', iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.15)', cardBg: 'rgba(245,158,11,0.03)' },
  super_interest_received: { icon: 'star', iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.15)', cardBg: 'rgba(245,158,11,0.03)' },
  listing_saved: { icon: 'bookmark', iconColor: '#ff6b5b', iconBg: 'rgba(255,107,91,0.15)' },
  listing_new_in_area: { icon: 'map-pin', iconColor: '#3ECF8E', iconBg: 'rgba(62,207,142,0.15)' },
  compatibility_update: { icon: 'bar-chart-2', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.15)' },
  roommate_moved: { icon: 'home', iconColor: '#A0A0A0', iconBg: 'rgba(160,160,160,0.15)' },
  weekly_digest: { icon: 'calendar', iconColor: '#ff6b5b', iconBg: 'rgba(255,107,91,0.15)' },
};

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRightIcon(eventType: string): string {
  switch (eventType) {
    case 'new_match': return 'heart';
    case 'listing_price_drop': return 'arrow-down';
    case 'profile_view': return 'chevron-right';
    case 'super_interest_received': return 'chevron-right';
    default: return 'chevron-right';
  }
}

export function FeedEventCard({ event, onPress, index = 0 }: Props) {
  const config = EVENT_CONFIG[event.eventType] || { icon: 'bell', iconColor: '#A0A0A0', iconBg: 'rgba(160,160,160,0.15)' };
  const photo = event.metadata?.otherUserPhoto || event.metadata?.photo || event.metadata?.memberPhoto || event.metadata?.viewerPhoto;
  const compatScore = event.metadata?.compatibilityScore;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300).springify()}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          config.cardBg ? { backgroundColor: config.cardBg } : null,
          !event.read ? styles.unreadCard : null,
          pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null,
        ]}
      >
        {!event.read ? <View style={styles.unreadDot} /> : null}

        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
            <Feather name={config.icon} size={20} color={config.iconColor} />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
          {event.body ? <Text style={styles.body} numberOfLines={2}>{event.body}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={styles.time}>{getTimeAgo(event.createdAt)}</Text>
            {compatScore ? (
              <View style={styles.scorePill}>
                <Text style={styles.scoreText}>{Math.round(compatScore)}% match</Text>
              </View>
            ) : null}
            {event.eventType === 'listing_price_drop' && event.metadata?.oldPrice && event.metadata?.newPrice ? (
              <View style={styles.priceRow}>
                <Text style={styles.oldPrice}>${event.metadata.oldPrice.toLocaleString()}</Text>
                <Feather name="arrow-right" size={10} color="#A0A0A0" />
                <Text style={styles.newPrice}>${event.metadata.newPrice.toLocaleString()}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.rightAction}>
          <Feather name={getRightIcon(event.eventType)} size={16} color="rgba(255,255,255,0.3)" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b5b',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff6b5b',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    color: '#A0A0A0',
    marginTop: 2,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  time: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  scorePill: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  oldPrice: {
    fontSize: 12,
    color: '#A0A0A0',
    textDecorationLine: 'line-through',
  },
  newPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
  },
  rightAction: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
