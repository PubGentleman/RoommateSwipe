import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';
import { RecommendedListing } from '../services/recommendationService';

interface Props {
  item: RecommendedListing;
  onPress: () => void;
  onSave?: () => void;
  isSaved?: boolean;
}

const REASON_ICONS: Record<string, string> = {
  'dollar-sign': 'dollar-sign',
  'map-pin': 'map-pin',
  'check-circle': 'check-circle',
  'clock': 'clock',
  'star': 'star',
  'shield': 'shield',
};

export default function ForYouCard({ item, onPress, onSave, isSaved }: Props) {
  const { listing, score, reasons } = item;
  const photo = listing.photos?.[0];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Feather name="home" size={32} color="#444" />
        </View>
      )}

      <View style={[styles.scoreBadge, {
        backgroundColor: score >= 80 ? '#3ECF8E' : score >= 60 ? '#F39C12' : '#6C5CE7',
      }]}>
        <Text style={styles.scoreText}>{score}% match</Text>
      </View>

      {onSave ? (
        <Pressable style={styles.saveButton} onPress={onSave} hitSlop={8}>
          <Feather name="heart" size={20} color={isSaved ? '#ff6b5b' : '#fff'} />
        </Pressable>
      ) : null}

      <View style={styles.body}>
        <Text style={styles.price}>
          ${(listing.price ?? (listing as any).rent)?.toLocaleString()}/mo
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title || `${listing.bedrooms} BR in ${listing.neighborhood}`}
        </Text>
        <Text style={styles.subtitle}>
          {listing.neighborhood}{listing.bedrooms ? ` · ${listing.bedrooms} bed` : ''}{listing.bathrooms ? ` · ${listing.bathrooms} bath` : ''}
        </Text>

        {reasons.length > 0 ? (
          <View style={styles.reasons}>
            {reasons.map((reason, i) => (
              <View key={i} style={styles.reasonChip}>
                {reason.icon && REASON_ICONS[reason.icon] ? (
                  <Feather name={REASON_ICONS[reason.icon] as any} size={11} color="#6C5CE7" />
                ) : null}
                <Text style={styles.reasonText}>{reason.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 16,
  },
  photo: { width: '100%', height: 180 },
  photoPlaceholder: { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  saveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 12 },
  price: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  title: { color: '#ccc', fontSize: 14, marginBottom: 2 },
  subtitle: { color: '#A0A0A0', fontSize: 12, marginBottom: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(108,92,231,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reasonText: { color: '#6C5CE7', fontSize: 11, fontWeight: '500' },
});
