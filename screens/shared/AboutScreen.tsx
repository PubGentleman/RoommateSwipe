import React from 'react';
import { View, StyleSheet, Text, Pressable, Linking } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { Spacing } from '../../constants/theme';

const ACCENT = '#ff6b5b';
const ACCENT_DARK = '#e83a2a';
const BG = '#111111';
const CARD_BG = '#1a1a1a';
const STATS_BG = '#141414';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#ffffff';
const TEXT_BODY = 'rgba(255,255,255,0.75)';
const TEXT_DIM = 'rgba(255,255,255,0.5)';
const TEXT_MUTED = 'rgba(255,255,255,0.45)';
const TEXT_FAINT = 'rgba(255,255,255,0.4)';

const FEATURES = [
  { icon: 'heart', title: 'Lifestyle & Habits', desc: 'Match with people who share your living style and daily rhythms.' },
  { icon: 'dollar-sign', title: 'Rent Budget', desc: 'Find options that fit your financial comfort zone -- no surprises.' },
  { icon: 'star', title: 'Cleanliness Preferences', desc: 'Connect with people who value the same standards at home.' },
  { icon: 'clock', title: 'Work Hours', desc: 'Align schedules for a harmonious, conflict-free living environment.' },
  { icon: 'cpu', title: 'Personality Traits', desc: 'Science-backed matching for deeper, longer-lasting compatibility.' },
  { icon: 'map-pin', title: 'Neighborhood Preference', desc: 'Find homes in the exact areas you actually want to live.' },
  { icon: 'clipboard', title: 'Compatibility Answers', desc: 'Structured questionnaires for better, more accurate results.' },
  { icon: 'home', title: 'Housing Expectations', desc: 'Clear communication and aligned expectations from the very start.' },
];

const AUDIENCES = [
  { icon: 'search', title: 'Renters', desc: 'Looking for a roommate or a room to share in the city.' },
  { icon: 'home', title: 'Hosts', desc: 'Listing a room, sublet, or property and finding the right tenant.' },
  { icon: 'users', title: 'Groups', desc: 'Teams of people searching for a place to live together.' },
];

const STATS = [
  { value: '8+', label: 'Matching Factors' },
  { value: '2', label: 'User Roles -- Renter & Host' },
  { value: '100%', label: 'Built for Modern City Life' },
];

function SectionHeader({ icon, title }: { icon: keyof typeof Feather.glyphMap; title: string }) {
  return (
    <View style={s.sectionLabel}>
      <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.sectionIcon}>
        <Feather name={icon} size={18} color="#fff" />
      </LinearGradient>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function AboutScreen() {
  return (
    <ScreenScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={s.hero}>
        <View style={s.heroLabelWrap}>
          <Text style={s.heroLabelText}>ABOUT ROOMDR</Text>
        </View>
        <Text style={s.heroTitle}>Finding home{'\n'}shouldn't feel like{'\n'}a gamble</Text>
        <Text style={s.heroSub}>Roomdr was built to solve one of the biggest problems in city living -- finding a roommate you actually get along with.</Text>
        <Pressable onPress={() => Linking.openURL('mailto:support@roomdr.app')}>
          <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.heroCta}>
            <Text style={s.heroCtaText}>Get in Touch</Text>
            <Feather name="arrow-right" size={15} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      <View style={s.statsBar}>
        <View style={s.statsInner}>
          {STATS.map((stat, i) => (
            <View key={i} style={[s.stat, i < STATS.length - 1 && s.statBorder]}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.main}>
        <View style={s.introBlock}>
          <Text style={s.introText}>
            Traditional listing sites only show <Text style={s.highlight}>photos and prices</Text>. Roomdr goes deeper -- matching people by lifestyle, habits, budget, neighborhood preference, and personality fit.
          </Text>
          <Text style={s.introText}>
            Our platform uses <Text style={s.highlight}>smart algorithms</Text>, user profiles, and neighborhood-based location matching to help renters and hosts connect with the right people faster. No scams. No endless scrolling. No mismatches.
          </Text>
          <Text style={s.introText}>
            Roomdr isn't just another housing app. It's a <Text style={s.highlight}>smarter, safer, more human</Text> way to find where -- and who -- you call home.
          </Text>
          <View style={s.quote}>
            <Text style={s.quoteText}>"Finding a roommate or a place to live shouldn't feel like gambling with your peace, safety, or money. Roomdr was created to fix that."</Text>
          </View>
        </View>

        <View style={s.section}>
          <SectionHeader icon="target" title="Our Mission" />
          <View style={s.missionCard}>
            <Text style={s.missionMain}>Build a safer, smarter, more human housing experience -- one compatible match at a time.</Text>
            <Text style={s.missionSub}>Whether you're moving across the city or across the country, Roomdr helps you find the right room, the right people, and the right fit.</Text>
          </View>
        </View>

        <View style={s.section}>
          <SectionHeader icon="zap" title="What Makes Roomdr Different" />
          <View style={s.featuresGrid}>
            {FEATURES.map((f, i) => (
              <View key={i} style={s.featureCard}>
                <Feather name={f.icon as any} size={22} color={ACCENT} style={{ marginBottom: 10 }} />
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
          <Text style={s.featuresCaption}>We also designed Roomdr to reflect the reality of modern housing. Cities move fast, neighborhoods shift constantly, and people need tools that understand their pace of life. Roomdr automatically sorts profiles by location, shows you people who want to live where you want to live, and keeps your matches relevant based on your preferences.</Text>
        </View>

        <View style={s.section}>
          <SectionHeader icon="users" title="Who Roomdr Is For" />
          <View style={s.audienceGrid}>
            {AUDIENCES.map((a, i) => (
              <View key={i} style={s.audienceCard}>
                <Feather name={a.icon as any} size={28} color={ACCENT} style={{ marginBottom: 12 }} />
                <Text style={s.audienceTitle}>{a.title}</Text>
                <Text style={s.audienceDesc}>{a.desc}</Text>
              </View>
            ))}
          </View>
          <Text style={s.featuresCaption}>Whether you're looking for a roommate, a room, a sublet, or tenants for your listing -- Roomdr brings clarity, connection, and community to the housing search.</Text>
        </View>

        <Pressable style={s.contactCard} onPress={() => Linking.openURL('mailto:support@roomdr.app')}>
          <View style={s.contactText}>
            <Text style={s.contactTitle}>Have questions about Roomdr?</Text>
            <Text style={s.contactSub}>Our team is here to help. Reach out any time.</Text>
          </View>
          <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={s.contactBtn}>
            <Text style={s.contactBtnText}>Contact Support</Text>
            <Feather name="arrow-right" size={14} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>2025 Roomdr. All rights reserved.</Text>
      </View>
    </ScreenScrollView>
  );
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 52,
  },
  heroLabelWrap: {
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 20,
  },
  heroLabelText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 20,
  },
  heroSub: {
    fontSize: 16,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 28,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 100,
  },
  heroCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  statsBar: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: STATS_BG,
  },
  statsInner: {
    flexDirection: 'row',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: TEXT_FAINT,
    fontWeight: '500',
    textAlign: 'center',
  },
  main: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  introBlock: {
    marginBottom: 52,
  },
  introText: {
    fontSize: 16,
    color: TEXT_BODY,
    lineHeight: 28,
    marginBottom: 20,
  },
  highlight: {
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    backgroundColor: 'rgba(255,107,91,0.05)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    padding: 20,
    marginTop: 12,
  },
  quoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 24,
  },
  section: {
    marginBottom: 52,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  missionCard: {
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    borderRadius: 20,
    padding: 28,
  },
  missionMain: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 28,
    marginBottom: 12,
  },
  missionSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 5,
  },
  featureDesc: {
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  featuresCaption: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 24,
  },
  audienceGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  audienceCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  audienceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
    textAlign: 'center',
  },
  audienceDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 17,
    textAlign: 'center',
  },
  contactCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 28,
    gap: 20,
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  contactSub: {
    fontSize: 14,
    color: TEXT_DIM,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  contactBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 28,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
});
