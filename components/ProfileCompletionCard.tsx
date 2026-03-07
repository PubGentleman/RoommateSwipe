import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import type { User } from '../types/models';

interface ProfileField {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  tip: string;
  weight: number;
  check: (user: User) => boolean;
}

const PROFILE_FIELDS: ProfileField[] = [
  {
    key: 'photo',
    label: 'Profile Photo',
    icon: 'camera',
    tip: 'Add a photo to get 3x more matches',
    weight: 20,
    check: (u) => !!(u.photos?.length || u.profilePicture),
  },
  {
    key: 'bio',
    label: 'Bio',
    icon: 'edit-2',
    tip: 'Write a bio to get 20% more matches',
    weight: 15,
    check: (u) => !!(u.profileData?.bio && u.profileData.bio.trim().length > 0),
  },
  {
    key: 'birthday',
    label: 'Date of Birth',
    icon: 'calendar',
    tip: 'Add your birthday for zodiac compatibility',
    weight: 10,
    check: (u) => !!u.birthday,
  },
  {
    key: 'budget',
    label: 'Budget',
    icon: 'dollar-sign',
    tip: 'Set your budget for better financial matches',
    weight: 10,
    check: (u) => !!(u.profileData?.budget && u.profileData.budget > 0),
  },
  {
    key: 'location',
    label: 'Location',
    icon: 'map-pin',
    tip: 'Add your location to find nearby roommates',
    weight: 10,
    check: (u) => !!(u.profileData?.city || u.profileData?.neighborhood || u.profileData?.location),
  },
  {
    key: 'occupation',
    label: 'Occupation',
    icon: 'briefcase',
    tip: 'Share your occupation to build trust',
    weight: 5,
    check: (u) => !!(u.profileData?.occupation && u.profileData.occupation.trim().length > 0),
  },
  {
    key: 'interests',
    label: 'Interests',
    icon: 'heart',
    tip: 'Add interests to connect over shared hobbies',
    weight: 5,
    check: (u) => !!(u.profileData?.interests && u.profileData.interests.trim().length > 0),
  },
  {
    key: 'sleepSchedule',
    label: 'Sleep Schedule',
    icon: 'moon',
    tip: 'Set your sleep schedule for lifestyle compatibility',
    weight: 10,
    check: (u) => !!u.profileData?.preferences?.sleepSchedule,
  },
  {
    key: 'cleanliness',
    label: 'Cleanliness Level',
    icon: 'droplet',
    tip: 'Set cleanliness to avoid 40% of roommate conflicts',
    weight: 10,
    check: (u) => !!u.profileData?.preferences?.cleanliness,
  },
  {
    key: 'smoking',
    label: 'Smoking Preference',
    icon: 'wind',
    tip: 'Set smoking preference for deal-breaker matching',
    weight: 5,
    check: (u) => !!u.profileData?.preferences?.smoking,
  },
];

const TOTAL_WEIGHT = PROFILE_FIELDS.reduce((sum, f) => sum + f.weight, 0);

function getCompletionData(user: User) {
  let completedWeight = 0;
  const missing: ProfileField[] = [];
  const completed: ProfileField[] = [];

  for (const field of PROFILE_FIELDS) {
    if (field.check(user)) {
      completedWeight += field.weight;
      completed.push(field);
    } else {
      missing.push(field);
    }
  }

  const percentage = Math.round((completedWeight / TOTAL_WEIGHT) * 100);
  return { percentage, missing, completed, total: PROFILE_FIELDS.length, completedCount: completed.length };
}

function getProgressColor(pct: number, theme: any): string {
  if (pct >= 80) return theme.success;
  if (pct >= 50) return theme.warning;
  return theme.error;
}

function getEncouragementText(pct: number): string {
  if (pct === 100) return 'Your profile is complete! You are getting the best matches.';
  if (pct >= 80) return 'Almost there! Complete a few more fields for the best results.';
  if (pct >= 50) return 'Good progress! Fill in more details to improve your matches.';
  return 'Complete your profile to start getting better matches.';
}

interface ProfileCompletionCardProps {
  user: User;
  onEditProfile: () => void;
}

export const ProfileCompletionCard = ({ user, onEditProfile }: ProfileCompletionCardProps) => {
  const { theme } = useTheme();
  const { percentage, missing, completedCount, total } = getCompletionData(user);
  const progressColor = getProgressColor(percentage, theme);

  const progressWidth = useSharedValue(0);

  React.useEffect(() => {
    progressWidth.value = withDelay(300, withSpring(percentage, { damping: 15, stiffness: 80 }));
  }, [percentage]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (percentage === 100) {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.completeRow}>
          <View style={[styles.checkCircle, { backgroundColor: theme.success }]}>
            <Feather name="check" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.completeTextContainer}>
            <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
              Profile Complete
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              You are getting the best possible matches
            </ThemedText>
          </View>
        </View>
      </View>
    );
  }

  const topMissing = missing.slice(0, 3);

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <ThemedText style={[Typography.h3]}>Profile Completion</ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
            {completedCount}/{total} fields completed
          </ThemedText>
        </View>
        <View style={[styles.percentBadge, { backgroundColor: progressColor + '20' }]}>
          <ThemedText style={[Typography.h3, { color: progressColor }]}>
            {percentage}%
          </ThemedText>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: progressColor }, progressBarStyle]} />
      </View>

      <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
        {getEncouragementText(percentage)}
      </ThemedText>

      <View style={styles.missingList}>
        {topMissing.map((field) => (
          <Pressable
            key={field.key}
            style={[styles.missingItem, { backgroundColor: theme.backgroundSecondary }]}
            onPress={onEditProfile}
          >
            <View style={[styles.missingIcon, { backgroundColor: progressColor + '15' }]}>
              <Feather name={field.icon} size={16} color={progressColor} />
            </View>
            <View style={styles.missingTextContainer}>
              <ThemedText style={[Typography.body, { fontWeight: '500' }]} numberOfLines={1}>
                {field.label}
              </ThemedText>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]} numberOfLines={1}>
                {field.tip}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>

      {missing.length > 3 ? (
        <Pressable style={styles.seeAllButton} onPress={onEditProfile}>
          <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
            +{missing.length - 3} more to complete
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  percentBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  missingList: {
    gap: Spacing.sm,
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
  },
  missingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  missingTextContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  seeAllButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  completeTextContainer: {
    flex: 1,
  },
});
