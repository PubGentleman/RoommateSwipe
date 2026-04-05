import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { getTraitEmoji, type PublicProfile } from '../services/socialProfileService';

interface Props {
  profile: PublicProfile;
}

export const RoommateResumeCard = forwardRef<View, Props>(({ profile }, ref) => {
  const memberSince = profile.stats.memberSince
    ? new Date(profile.stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  return (
    <View ref={ref} style={styles.card}>
      <View style={styles.headerSection}>
        <Text style={styles.label}>ROOMMATE RESUME</Text>
      </View>

      <View style={styles.profileRow}>
        {profile.photo ? (
          <Image source={{ uri: profile.photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Feather name="user" size={28} color="#A0A0A0" />
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{profile.name}{profile.age ? `, ${profile.age}` : ''}</Text>
          {profile.occupation ? <Text style={styles.occupation}>{profile.occupation}</Text> : null}
          {profile.neighborhood || profile.city ? (
            <Text style={styles.location}>
              {[profile.neighborhood, profile.city].filter(Boolean).join(', ')}
            </Text>
          ) : null}
        </View>
      </View>

      {profile.tagline ? <Text style={styles.tagline}>"{profile.tagline}"</Text> : null}

      {profile.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text>
        </View>
      ) : null}

      {profile.interests && profile.interests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsRow}>
            {profile.interests.slice(0, 5).map(i => (
              <View key={i} style={styles.interestPill}>
                <Text style={styles.interestText}>{i}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {profile.traits.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Traits</Text>
          <View style={styles.traitsRow}>
            {profile.traits.slice(0, 4).map(t => (
              <View key={t.trait} style={styles.traitPill}>
                <Text style={styles.traitText}>{getTraitEmoji(t.trait)} {t.trait}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {profile.verifications.length > 0 ? (
        <View style={styles.verifyRow}>
          {profile.verifications.map(v => (
            <View key={v} style={styles.verifyItem}>
              <Feather name="check-circle" size={12} color="#22C55E" />
              <Text style={styles.verifyLabel}>
                {v === 'email' ? 'Email' : v === 'phone' ? 'Phone' : v === 'instagram' ? 'Instagram' : 'Background'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.stats.matchCount}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.stats.groupCount}</Text>
          <Text style={styles.statLabel}>Groups</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{memberSince}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
      </View>

      {profile.testimonials.length > 0 ? (
        <View style={styles.testimonialSection}>
          <Text style={styles.testimonialContent} numberOfLines={2}>
            "{profile.testimonials[0].content}"
          </Text>
          <Text style={styles.testimonialAuthor}>- {profile.testimonials[0].authorName}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Rhome</Text>
        <Text style={styles.footerLink}>rhome.app/u/{profile.slug}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    padding: 20,
    alignSelf: 'center',
  },
  headerSection: {
    marginBottom: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff6b5b',
    letterSpacing: 2,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  occupation: {
    fontSize: 13,
    color: '#A0A0A0',
    marginTop: 2,
  },
  location: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    marginBottom: 14,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A0A0A0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bio: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestPill: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  interestText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitPill: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  traitText: {
    fontSize: 12,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  verifyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  verifyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifyLabel: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  statItem: {
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
  testimonialSection: {
    marginBottom: 14,
  },
  testimonialContent: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  testimonialAuthor: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,107,91,0.3)',
    letterSpacing: 2,
  },
  footerLink: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
});
