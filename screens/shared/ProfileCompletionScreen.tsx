import React from 'react';
import { View, StyleSheet, Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getCompletionPercentage } from '../../utils/profileReminderUtils';

const ACCENT = '#ff6b5b';

interface CompletionSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  screen: string;
  screenParams?: Record<string, any>;
  points: number;
  check: (user: any) => boolean;
}

const RENTER_SECTIONS: CompletionSection[] = [
  {
    id: 'photo',
    title: 'Add a profile photo',
    description: 'Profiles with photos get 8x more matches',
    icon: 'camera',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['photos'] },
    points: 15,
    check: (u) => !!(u.photos?.length || u.profilePicture),
  },
  {
    id: 'occupation',
    title: 'What do you do?',
    description: 'Your occupation helps find compatible roommates',
    icon: 'briefcase',
    screen: 'OccupationPicker',
    points: 15,
    check: (u) => !!(u.profileData?.occupation),
  },
  {
    id: 'bio',
    title: 'About you',
    description: 'A short bio lets people know who you are',
    icon: 'edit-2',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['basicInfo'] },
    points: 15,
    check: (u) => !!(u.profileData?.bio && u.profileData.bio.trim().length >= 20),
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle preferences',
    description: 'Sleep schedule, cleanliness, noise tolerance',
    icon: 'sun',
    screen: 'LifestyleQuestions',
    points: 30,
    check: (u) => {
      const p = u.profileData?.preferences;
      return !!(p?.sleepSchedule && p?.cleanliness && p?.noiseTolerance && p?.guestPolicy);
    },
  },
  {
    id: 'budget',
    title: 'Your budget',
    description: 'Monthly rent budget range',
    icon: 'dollar-sign',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['budgetLocation'] },
    points: 10,
    check: (u) => !!u.profileData?.budget,
  },
  {
    id: 'tags',
    title: 'Your vibe',
    description: 'Add at least 3 tags that describe you',
    icon: 'tag',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['interests'] },
    points: 5,
    check: (u) => Array.isArray(u.profileData?.interests) && u.profileData.interests.length >= 3,
  },
];

const HOST_SECTIONS: CompletionSection[] = [
  {
    id: 'profile_photo',
    title: 'Add your photo',
    description: 'Hosts with photos get more inquiries',
    icon: 'camera',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['photos'] },
    points: 15,
    check: (u) => !!(u.photos?.length || u.profilePicture),
  },
  {
    id: 'bio',
    title: 'About you',
    description: 'Tell renters about yourself as a host',
    icon: 'edit-2',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['basicInfo'] },
    points: 15,
    check: (u) => !!(u.profileData?.bio && u.profileData.bio.trim().length >= 20),
  },
];

const AGENT_SECTIONS: CompletionSection[] = [
  {
    id: 'profile_photo',
    title: 'Add your photo',
    description: 'Professional headshot builds trust',
    icon: 'camera',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['photos'] },
    points: 20,
    check: (u) => !!(u.photos?.length || u.profilePicture),
  },
  {
    id: 'bio',
    title: 'Professional bio',
    description: 'Highlight your experience and specialties',
    icon: 'edit-2',
    screen: 'ProfileQuestionnaire',
    screenParams: { missingSteps: ['basicInfo'] },
    points: 20,
    check: (u) => !!(u.profileData?.bio && u.profileData.bio.trim().length >= 20),
  },
  {
    id: 'license',
    title: 'License number',
    description: 'Required for verified agent badge',
    icon: 'award',
    screen: 'EditProfile',
    points: 30,
    check: (u) => !!u.licenseNumber,
  },
  {
    id: 'agency',
    title: 'Agency name',
    description: 'Your brokerage or agency',
    icon: 'briefcase',
    screen: 'EditProfile',
    points: 30,
    check: (u) => !!(u.agencyName || u.companyName),
  },
];

export const ProfileCompletionScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const isAgent = user?.hostType === 'agent';
  const isCompany = user?.hostType === 'company';
  const isHost = user?.role === 'host' && user?.activeMode === 'host';

  let sections: CompletionSection[];
  if (isAgent || isCompany) {
    sections = AGENT_SECTIONS;
  } else if (isHost) {
    sections = HOST_SECTIONS;
  } else {
    sections = RENTER_SECTIONS;
  }

  const completion = getCompletionPercentage(user!);
  const completedSections = sections.filter(s => s.check(user));
  const incompleteSections = sections.filter(s => !s.check(user));

  const handleNavigate = (section: CompletionSection) => {
    (navigation as any).navigate(section.screen, section.screenParams || {});
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={styles.headerTitle}>Complete your profile</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressCircleWrap}>
          <Text style={styles.progressPercent}>{completion}%</Text>
          <Text style={styles.progressLabel}>Complete</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <LinearGradient
            colors={[ACCENT, '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${completion}%` }]}
          />
        </View>
        <Text style={styles.progressHint}>
          {completion >= 80
            ? 'Great job! Your profile is looking strong.'
            : 'Complete more sections to get better matches'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {incompleteSections.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionGroupTitle}>TO DO</Text>
            {incompleteSections.map((section) => (
              <Pressable
                key={section.id}
                style={styles.sectionCard}
                onPress={() => handleNavigate(section)}
              >
                <View style={styles.sectionIconWrap}>
                  <Feather name={section.icon as any} size={18} color="rgba(255,255,255,0.5)" />
                </View>
                <View style={styles.sectionInfo}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionDesc}>{section.description}</Text>
                </View>
                <View style={styles.sectionRight}>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsText}>+{section.points}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {completedSections.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionGroupTitle}>COMPLETED</Text>
            {completedSections.map((section) => (
              <Pressable
                key={section.id}
                style={[styles.sectionCard, styles.sectionCardComplete]}
                onPress={() => handleNavigate(section)}
              >
                <View style={[styles.sectionIconWrap, styles.sectionIconComplete]}>
                  <Feather name="check" size={18} color="#22C55E" />
                </View>
                <View style={styles.sectionInfo}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleComplete]}>{section.title}</Text>
                  <Text style={styles.sectionDesc}>{section.description}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.15)" />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  progressCircleWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressPercent: {
    fontSize: 40,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1,
  },
  progressLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionGroup: {
    marginTop: 16,
  },
  sectionGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  sectionCardComplete: {
    opacity: 0.6,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconComplete: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  sectionInfo: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitleComplete: {
    color: 'rgba(255,255,255,0.7)',
  },
  sectionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 16,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.15)',
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },
});
