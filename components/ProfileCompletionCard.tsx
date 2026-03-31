import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withDelay,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from './VectorIcons';
import type { User } from '../types/models';

interface ProfileField {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  tip: string;
  boostText?: string;
  weight: number;
  check: (user: User) => boolean;
}

const ROOMMATE_SEEKER_FIELDS: ProfileField[] = [
  {
    key: 'photo',
    label: 'Add a Profile Photo',
    icon: 'camera',
    tip: 'with a photo',
    boostText: '3x more matches',
    weight: 10,
    check: (u) => !!(u.photos?.length || u.profilePicture),
  },
  {
    key: 'bio',
    label: 'Write a Bio',
    icon: 'edit-2',
    tip: 'with a bio',
    boostText: '20% more messages',
    weight: 10,
    check: (u) => !!(u.profileData?.bio && u.profileData.bio.trim().length >= 20),
  },
  {
    key: 'birthday',
    label: 'Set Your Birthday',
    icon: 'calendar',
    tip: 'Age auto-updates from your birthday',
    boostText: 'Zodiac compatibility',
    weight: 10,
    check: (u) => !!u.birthday,
  },
  {
    key: 'occupation',
    label: 'Add Occupation',
    icon: 'briefcase',
    tip: 'Build trust with potential matches',
    weight: 10,
    check: (u) => !!(u.profileData?.occupation && u.profileData.occupation.trim().length > 0),
  },
  {
    key: 'interests',
    label: 'Add Interests',
    icon: 'heart',
    tip: 'Connect over shared hobbies',
    weight: 15,
    check: (u) => {
      const interests = u.profileData?.interests;
      return Array.isArray(interests) && interests.length >= 3;
    },
  },
  {
    key: 'cleanliness',
    label: 'Cleanliness & Noise',
    icon: 'droplet',
    tip: 'Avoid 40% of roommate conflicts',
    weight: 10,
    check: (u) => !!(u.profileData?.preferences?.cleanliness && u.profileData?.preferences?.noiseTolerance),
  },
  {
    key: 'sleepSchedule',
    label: 'Sleep Schedule',
    icon: 'moon',
    tip: 'Lifestyle compatibility matching',
    weight: 5,
    check: (u) => !!u.profileData?.preferences?.sleepSchedule,
  },
  {
    key: 'smoking',
    label: 'Smoking Preference',
    icon: 'wind',
    tip: 'Deal-breaker matching',
    weight: 5,
    check: (u) => !!u.profileData?.preferences?.smoking,
  },
  {
    key: 'pets',
    label: 'Pet Preferences',
    icon: 'github',
    tip: 'Important for compatibility',
    weight: 5,
    check: (u) => !!u.profileData?.preferences?.pets,
  },
  {
    key: 'work',
    label: 'Work Info',
    icon: 'briefcase',
    tip: 'Match with similar schedules',
    weight: 10,
    check: (u) => !!(u.profileData?.preferences?.workLocation || u.profileData?.preferences?.workSchedule),
  },
  {
    key: 'moveInDate',
    label: 'Move-in Date',
    icon: 'calendar',
    tip: 'Find roommates on your timeline',
    weight: 10,
    check: (u) => !!(u.profileData?.preferences?.moveInDate || u.profileData?.moveInDate),
  },
];

const PLACE_SEEKER_FIELDS: ProfileField[] = [
  {
    key: 'photo',
    label: 'Add a Profile Photo',
    icon: 'camera',
    tip: 'with a photo',
    boostText: '3x more responses',
    weight: 15,
    check: (u) => !!(u.photos?.length || u.profilePicture),
  },
  {
    key: 'bio',
    label: 'Write a Bio',
    icon: 'edit-2',
    tip: 'Stand out to hosts',
    boostText: 'with a bio',
    weight: 15,
    check: (u) => !!(u.profileData?.bio && u.profileData.bio.trim().length >= 20),
  },
  {
    key: 'birthday',
    label: 'Set Your Birthday',
    icon: 'calendar',
    tip: 'auto-updates from your birthday',
    boostText: 'Age verification',
    weight: 10,
    check: (u) => !!u.birthday,
  },
  {
    key: 'occupation',
    label: 'Add Occupation',
    icon: 'briefcase',
    tip: 'hosts prefer verified tenants',
    boostText: 'Builds trust',
    weight: 15,
    check: (u) => !!(u.profileData?.occupation && u.profileData.occupation.trim().length > 0),
  },
  {
    key: 'work',
    label: 'Work Info',
    icon: 'map-pin',
    tip: 'for faster approvals',
    boostText: 'Verify employment',
    weight: 15,
    check: (u) => !!(u.profileData?.preferences?.workLocation || u.profileData?.preferences?.workSchedule),
  },
  {
    key: 'moveInDate',
    label: 'Move-in Date',
    icon: 'clock',
    tip: 'with available listings',
    boostText: 'Match timing',
    weight: 15,
    check: (u) => !!(u.profileData?.preferences?.moveInDate || u.profileData?.moveInDate),
  },
  {
    key: 'interests',
    label: 'Add Interests',
    icon: 'heart',
    tip: 'helps hosts know you',
    boostText: 'Show personality',
    weight: 15,
    check: (u) => {
      const interests = u.profileData?.interests;
      return Array.isArray(interests) && interests.length >= 3;
    },
  },
];

const PROFILE_FIELDS = ROOMMATE_SEEKER_FIELDS;
const TOTAL_WEIGHT = PROFILE_FIELDS.reduce((sum, f) => sum + f.weight, 0);

type SearchType = 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | null | undefined;

function getFieldsForType(searchType: SearchType): ProfileField[] {
  if (searchType && searchType !== 'with_roommates') {
    return PLACE_SEEKER_FIELDS;
  }
  return ROOMMATE_SEEKER_FIELDS;
}

function getCompletionData(user: User, searchType?: SearchType) {
  const fields = getFieldsForType(searchType);
  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  let completedWeight = 0;
  const missing: ProfileField[] = [];
  const completed: ProfileField[] = [];

  for (const field of fields) {
    if (field.check(user)) {
      completedWeight += field.weight;
      completed.push(field);
    } else {
      missing.push(field);
    }
  }

  const percentage = Math.min(Math.round((completedWeight / totalWeight) * 100), 100);
  return { percentage, missing, completed, total: fields.length, completedCount: completed.length };
}

const FIELD_TO_STEP: Record<string, string> = {
  photo: 'photos',
  birthday: 'basicInfo',
  budget: 'budgetLocation',
  location: 'budgetLocation',
  occupation: 'budgetLocation',
  interests: 'interests',
  sleepSchedule: 'sleepCleanliness',
  cleanliness: 'sleepCleanliness',
  smoking: 'smokingPets',
  pets: 'smokingPets',
  work: 'lifestyle',
  moveInDate: 'housing',
};

interface ProfileCompletionCardProps {
  user: User;
  searchType?: SearchType;
  onEditProfile: (missingSteps?: string[]) => void;
}

export const ProfileCompletionCard = ({ user, searchType, onEditProfile }: ProfileCompletionCardProps) => {
  const { percentage, missing, completedCount, total } = getCompletionData(user, searchType);

  const progressWidth = useSharedValue(0);

  React.useEffect(() => {
    progressWidth.value = withDelay(300, withSpring(percentage, { damping: 15, stiffness: 80 }));
  }, [percentage]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (percentage === 100) {
    return (
      <View style={styles.card}>
        <View style={styles.topBar} />
        <View style={styles.cardContent}>
          <View style={styles.completeRow}>
            <View style={styles.checkCircle}>
              <Feather name="check" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.completeTitle}>Profile Complete</Text>
              <Text style={styles.completeSubtitle}>You are getting the best possible matches</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const topMissing = missing.slice(0, 3);

  return (
    <View style={styles.card}>
      <LinearGradient colors={['#ff6b5b', '#ffaa80']} style={styles.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      <View style={styles.cardContent}>
        <View style={styles.strengthTop}>
          <View style={styles.strengthLeft}>
            <Text style={styles.strengthTitle}>Profile Completion</Text>
            <Text style={styles.strengthSubtitle}>{completedCount} of {total} fields completed</Text>
          </View>
          <Text style={styles.strengthPct}>{percentage}%</Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={progressBarStyle}>
            <LinearGradient colors={['#ff6b5b', '#ffaa80']} style={styles.progressFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          </Animated.View>
        </View>

        <Text style={styles.progressHint}>
          {searchType && searchType !== 'with_roommates'
            ? 'Complete your profile to stand out to hosts'
            : 'Complete your profile to unlock better matches'}
        </Text>

        {topMissing.map((field) => {
          const allMissingSteps = [...new Set(missing.map(f => FIELD_TO_STEP[f.key]))];
          const tappedStep = FIELD_TO_STEP[field.key];
          const orderedSteps = [tappedStep, ...allMissingSteps.filter(s => s !== tappedStep)];
          return (
            <Pressable key={field.key} style={styles.completionItem} onPress={() => onEditProfile(orderedSteps)}>
              <View style={styles.completionIcon}>
                <Feather name={field.icon} size={17} color="#ff6b5b" />
              </View>
              <View style={styles.completionText}>
                <Text style={styles.completionTitle}>{field.label}</Text>
                <Text style={styles.completionSubtitle}>
                  {field.boostText ? (
                    <><Text style={styles.boostText}>{field.boostText}</Text> {field.tip}</>
                  ) : field.tip}
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
            </Pressable>
          );
        })}

        {missing.length > 3 ? (
          <Pressable style={styles.moreLink} onPress={() => {
            const allMissingSteps = [...new Set(missing.map(f => FIELD_TO_STEP[f.key]))];
            onEditProfile(allMissingSteps);
          }}>
            <Text style={styles.moreLinkText}>+{missing.length - 3} more to complete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

export { getCompletionData, PROFILE_FIELDS, TOTAL_WEIGHT, PLACE_SEEKER_FIELDS, ROOMMATE_SEEKER_FIELDS, getFieldsForType };

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  topBar: {
    height: 3,
    width: '100%',
  },
  cardContent: {
    padding: 18,
  },
  strengthTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  strengthLeft: {
    flex: 1,
  },
  strengthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  strengthSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.35)',
  },
  strengthPct: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ff6b5b',
    letterSpacing: -1,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 14,
    fontStyle: 'italic',
  },
  completionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    marginBottom: 8,
  },
  completionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionText: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  completionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  boostText: {
    color: '#ff8070',
    fontWeight: '600',
  },
  moreLink: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 2,
  },
  moreLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3ECF8E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  completeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  completeSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
});
