import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { getTraitEmoji, type PublicProfile } from '../services/socialProfileService';

interface Props {
  profile: PublicProfile;
  compact?: boolean;
}

function VerificationIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    email: 'mail',
    phone: 'phone',
    instagram: 'camera',
    background_check: 'shield',
  };
  return (
    <View style={cardStyles.verifyBadge}>
      <Feather name={icons[type] || 'check'} size={10} color="#22C55E" />
    </View>
  );
}

export const ProfileShareCard = forwardRef<View, Props>(({ profile, compact }, ref) => {
  if (compact) {
    return (
      <View ref={ref} style={cardStyles.compactCard}>
        {profile.photo ? (
          <Image source={{ uri: profile.photo }} style={cardStyles.compactAvatar} />
        ) : (
          <View style={[cardStyles.compactAvatar, cardStyles.avatarPlaceholder]}>
            <Feather name="user" size={24} color="#A0A0A0" />
          </View>
        )}
        <View style={cardStyles.compactContent}>
          <Text style={cardStyles.compactName} numberOfLines={1}>{profile.name}{profile.age ? `, ${profile.age}` : ''}</Text>
          {profile.tagline ? <Text style={cardStyles.compactTagline} numberOfLines={1}>{profile.tagline}</Text> : null}
          {profile.traits.length > 0 ? (
            <Text style={cardStyles.compactTrait}>{getTraitEmoji(profile.traits[0].trait)} {profile.traits[0].trait}</Text>
          ) : null}
        </View>
        <Feather name="share-2" size={16} color="rgba(255,255,255,0.4)" />
      </View>
    );
  }

  const memberSince = profile.stats.memberSince
    ? new Date(profile.stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return (
    <View ref={ref} style={cardStyles.card}>
      <View style={cardStyles.photoWrap}>
        {profile.photo ? (
          <Image source={{ uri: profile.photo }} style={cardStyles.photo} />
        ) : (
          <View style={[cardStyles.photo, cardStyles.avatarPlaceholder]}>
            <Feather name="user" size={48} color="#A0A0A0" />
          </View>
        )}
        <View style={cardStyles.photoOverlay}>
          <Text style={cardStyles.photoName}>{profile.name}{profile.age ? `, ${profile.age}` : ''}</Text>
          {profile.tagline ? <Text style={cardStyles.photoTagline}>{profile.tagline}</Text> : null}
        </View>
      </View>

      {profile.verifications.length > 0 ? (
        <View style={cardStyles.verifyRow}>
          {profile.verifications.map(v => (
            <VerificationIcon key={v} type={v} />
          ))}
          <Text style={cardStyles.verifyText}>Verified</Text>
        </View>
      ) : null}

      <View style={cardStyles.statsRow}>
        <View style={cardStyles.statItem}>
          <Text style={cardStyles.statValue}>{profile.stats.matchCount}</Text>
          <Text style={cardStyles.statLabel}>Matches</Text>
        </View>
        <View style={cardStyles.statDivider} />
        <View style={cardStyles.statItem}>
          <Text style={cardStyles.statValue}>{profile.stats.groupCount}</Text>
          <Text style={cardStyles.statLabel}>Groups</Text>
        </View>
        <View style={cardStyles.statDivider} />
        <View style={cardStyles.statItem}>
          <Text style={cardStyles.statValue}>{memberSince}</Text>
          <Text style={cardStyles.statLabel}>Member since</Text>
        </View>
      </View>

      {profile.traits.length > 0 ? (
        <View style={cardStyles.traitsRow}>
          {profile.traits.slice(0, 3).map(t => (
            <View key={t.trait} style={cardStyles.traitPill}>
              <Text style={cardStyles.traitText}>{getTraitEmoji(t.trait)} {t.trait}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={cardStyles.footer}>
        <Text style={cardStyles.watermark}>Rhome</Text>
      </View>
    </View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  photoWrap: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
    backgroundColor: 'transparent',
  },
  photoName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  photoTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  verifyBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
    marginLeft: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#A0A0A0',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 6,
  },
  traitPill: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  traitText: {
    fontSize: 12,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  watermark: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,107,91,0.3)',
    letterSpacing: 2,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    gap: 12,
  },
  compactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  compactContent: {
    flex: 1,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  compactTagline: {
    fontSize: 12,
    color: '#A0A0A0',
    fontStyle: 'italic',
    marginTop: 1,
  },
  compactTrait: {
    fontSize: 11,
    color: '#ff6b5b',
    marginTop: 3,
  },
});
