import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';
import { ShortlistItemWithVotes } from '../services/groupVotingService';

interface Props {
  item: ShortlistItemWithVotes;
  totalMembers: number;
  isSelected: boolean;
  onVoteUp: () => void;
  onVoteDown: () => void;
  onPress: () => void;
  onLongPress?: () => void;
}

const ShortlistVoteCard: React.FC<Props> = ({
  item, totalMembers, isSelected, onVoteUp, onVoteDown, onPress, onLongPress,
}) => {
  const { listing, upvotes, myVote, voters } = item;
  const votePct = totalMembers > 0 ? Math.round((upvotes / totalMembers) * 100) : 0;
  const isWinning = upvotes > (totalMembers / 2);

  return (
    <Pressable
      style={[styles.card, isSelected ? styles.cardSelected : null]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.photoRow}>
        {listing?.photos?.[0] ? (
          <Image source={{ uri: listing.photos[0] }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Feather name="home" size={32} color="rgba(255,255,255,0.15)" />
          </View>
        )}

        {isWinning ? (
          <View style={styles.consensusBadge}>
            <Feather name="check-circle" size={10} color="#3ECF8E" />
            <Text style={styles.consensusText}>Group Favorite</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.price}>
          ${(listing?.price || listing?.rent)?.toLocaleString()}<Text style={styles.pricePeriod}>/mo</Text>
        </Text>
        <Text style={styles.title} numberOfLines={1}>{listing?.title}</Text>
        <Text style={styles.location} numberOfLines={1}>
          {listing?.neighborhood ? `${listing.neighborhood}, ` : ''}{listing?.city}
          {listing?.bedrooms ? ` · ${listing.bedrooms} bd ${listing.bathrooms} ba` : ''}
        </Text>

        <View style={styles.voteProgress}>
          <View style={styles.voteBarTrack}>
            <View style={[styles.voteBarFill, { width: `${Math.max(3, votePct)}%` }]} />
          </View>
          <Text style={styles.votePctText}>{votePct}%</Text>
        </View>

        <View style={styles.voteRow}>
          <View style={styles.voteButtons}>
            <Pressable
              style={[styles.voteBtn, myVote === 1 ? styles.voteBtnActive : null]}
              onPress={onVoteUp}
            >
              <Feather name="thumbs-up" size={14} color={myVote === 1 ? '#3ECF8E' : 'rgba(255,255,255,0.4)'} />
              <Text style={[styles.voteBtnText, myVote === 1 ? { color: '#3ECF8E' } : null]}>{upvotes}</Text>
            </Pressable>
            <Pressable
              style={[styles.voteBtn, myVote === -1 ? styles.voteBtnActiveDown : null]}
              onPress={onVoteDown}
            >
              <Feather name="thumbs-down" size={14} color={myVote === -1 ? '#f87171' : 'rgba(255,255,255,0.4)'} />
            </Pressable>
          </View>

          <View style={styles.voterAvatars}>
            {voters.filter(v => v.vote === 1).slice(0, 3).map((v, i) => (
              <View key={v.userId} style={[styles.miniAvatar, i > 0 ? { marginLeft: -6 } : null]}>
                {v.avatarUrl ? (
                  <Image source={{ uri: v.avatarUrl }} style={styles.miniAvatarImg} />
                ) : (
                  <Text style={styles.miniAvatarText}>{v.userName.charAt(0)}</Text>
                )}
              </View>
            ))}
            {upvotes > 3 ? (
              <Text style={styles.moreVoters}>+{upvotes - 3}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.addedBy}>Added by {item.addedByName || 'a member'}</Text>
      </View>

      {isSelected ? (
        <View style={styles.selectedCheck}>
          <Feather name="check" size={14} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  cardSelected: {
    borderColor: '#ff6b5b',
    borderWidth: 2,
  },
  photoRow: { position: 'relative' },
  photo: { width: '100%', height: 160 },
  photoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  consensusBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  consensusText: { fontSize: 11, fontWeight: '700', color: '#3ECF8E' },
  body: { padding: 14, gap: 4 },
  price: { fontSize: 18, fontWeight: '800', color: '#fff' },
  pricePeriod: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.4)' },
  title: { fontSize: 14, fontWeight: '600', color: '#fff' },
  location: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  voteProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  voteBarTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  voteBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#3ECF8E' },
  votePctText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 30, textAlign: 'right' },
  voteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8,
  },
  voteButtons: { flexDirection: 'row', gap: 8 },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  voteBtnActive: { backgroundColor: 'rgba(62,207,142,0.12)' },
  voteBtnActiveDown: { backgroundColor: 'rgba(248,113,113,0.12)' },
  voteBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  voterAvatars: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#161616',
    overflow: 'hidden',
  },
  miniAvatarImg: { width: 22, height: 22, borderRadius: 11 },
  miniAvatarText: { fontSize: 9, fontWeight: '700', color: '#ff6b5b' },
  moreVoters: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 },
  addedBy: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 },
  selectedCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#ff6b5b',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default ShortlistVoteCard;
