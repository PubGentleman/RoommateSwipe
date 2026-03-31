import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';

const ACCENT = '#ff6b5b';

interface GroupShortlistCardProps {
  listing: {
    id: string;
    title?: string;
    address?: string;
    city?: string;
    state?: string;
    rent?: number;
    bedrooms?: number;
    photos?: string[];
  } | null;
  likeCount: number;
  totalMembers: number;
  likedBy: { user_id: string; name?: string; avatar_url?: string }[];
  onPress?: () => void;
  onInquire?: () => void;
}

export function GroupShortlistCard({
  listing,
  likeCount,
  totalMembers,
  likedBy,
  onPress,
  onInquire,
}: GroupShortlistCardProps) {
  if (!listing) return null;

  const everyoneLiked = likeCount >= totalMembers && totalMembers > 0;
  const photo = listing.photos?.[0];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.noPhoto]}>
          <Feather name="home" size={24} color="#444" />
        </View>
      )}

      <View style={styles.likeBadge}>
        <Feather name="heart" size={10} color="#fff" />
        <Text style={styles.likeBadgeText}>
          {likeCount} of {totalMembers}
        </Text>
      </View>

      {everyoneLiked ? (
        <View style={styles.everyoneBadge}>
          <Feather name="award" size={10} color="#D4AF37" />
          <Text style={styles.everyoneBadgeText}>Everyone loves this!</Text>
        </View>
      ) : null}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title || listing.address || 'Listing'}
        </Text>

        <View style={styles.metaRow}>
          {listing.rent ? (
            <Text style={styles.price}>${listing.rent.toLocaleString()}/mo</Text>
          ) : null}
          {listing.bedrooms ? (
            <Text style={styles.meta}>{listing.bedrooms} BR</Text>
          ) : null}
          {listing.city ? (
            <Text style={styles.meta}>{listing.city}</Text>
          ) : null}
        </View>

        <View style={styles.avatarRow}>
          {likedBy.slice(0, 5).map((u, i) => (
            <View key={u.user_id} style={[styles.avatar, { marginLeft: i > 0 ? -8 : 0 }]}>
              {u.avatar_url ? (
                <Image source={{ uri: u.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {(u.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          ))}
          {likedBy.length > 5 ? (
            <Text style={styles.moreAvatars}>+{likedBy.length - 5}</Text>
          ) : null}
        </View>

        {everyoneLiked && onInquire ? (
          <Pressable style={styles.inquireBtn} onPress={onInquire}>
            <Feather name="send" size={12} color="#fff" />
            <Text style={styles.inquireBtnText}>Inquire as Group</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: 160,
  },
  noPhoto: {
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  likeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  everyoneBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  everyoneBadgeText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
  },
  info: {
    padding: 12,
    gap: 6,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  price: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 14,
  },
  meta: {
    color: '#888',
    fontSize: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatar: {
    zIndex: 1,
  },
  avatarImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  moreAvatars: {
    color: '#666',
    fontSize: 10,
    marginLeft: 4,
  },
  inquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  inquireBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
