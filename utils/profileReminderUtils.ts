import type { User } from '../types/models';

export interface ProfileGap {
  field: string;
  label: string;
  impact: string;
  icon: 'image' | 'file-text' | 'briefcase' | 'tag' | 'home' | 'sliders';
  screen: string;
  screenParams?: Record<string, any>;
}

export const GAP_MESSAGES: Record<string, string> = {
  photo: "Profiles without a photo are skipped 8 out of 10 times. Add one now to start getting noticed.",
  bio: "Your bio is your first impression. Even 2-3 sentences about yourself makes a huge difference.",
  occupation: "Knowing your occupation helps match you with roommates who keep similar hours.",
  interests: "You haven't added your interests yet. Shared interests are one of the top factors in successful roommate matches.",
  living_style: "Cleanliness and noise level mismatches are the #1 reason roommates don't work out. Tell us your style.",
  preferences: "Pet and smoking preferences help filter out incompatible matches before you even see them.",
};

export const getProfileGaps = (user: User): ProfileGap[] => {
  const gaps: ProfileGap[] = [];

  if (!(user.photos?.length || user.profilePicture)) {
    gaps.push({
      field: 'photo',
      label: 'Profile Photo',
      impact: 'Profiles with photos get 8x more matches',
      icon: 'image',
      screen: 'ProfileQuestionnaire',
      screenParams: { missingSteps: ['photos'] },
    });
  }

  if (!user.profileData?.occupation) {
    gaps.push({
      field: 'occupation',
      label: 'Occupation',
      impact: 'Occupation helps match you with roommates who have compatible schedules',
      icon: 'briefcase',
      screen: 'OccupationPicker',
    });
  }

  if (!user.profileData?.bio || user.profileData.bio.trim().length < 20) {
    gaps.push({
      field: 'bio',
      label: 'About You',
      impact: 'A short bio lets people know who you are',
      icon: 'file-text',
      screen: 'ProfileQuestionnaire',
      screenParams: { missingSteps: ['basicInfo'] },
    });
  }

  const interests = user.profileData?.interests;
  const interestCount = Array.isArray(interests) ? interests.length : 0;
  if (interestCount < 3) {
    gaps.push({
      field: 'interests',
      label: 'Interest Tags',
      impact: 'Shared interests increase your compatibility score by up to 20%',
      icon: 'tag',
      screen: 'ProfileQuestionnaire',
      screenParams: { missingSteps: ['interests'] },
    });
  }

  const prefs = user.profileData?.preferences;
  if (!prefs?.cleanliness || !prefs?.noiseTolerance || !prefs?.sleepSchedule || !prefs?.guestPolicy) {
    gaps.push({
      field: 'living_style',
      label: 'Lifestyle Preferences',
      impact: 'Sleep schedule, cleanliness, and noise are the top causes of roommate conflicts',
      icon: 'home',
      screen: 'LifestyleQuestions',
    });
  }

  if (!prefs?.pets || !prefs?.smoking) {
    gaps.push({
      field: 'preferences',
      label: 'Living Preferences',
      impact: 'Pet and smoking preferences filter out incompatible matches instantly',
      icon: 'sliders',
      screen: 'ProfileQuestionnaire',
      screenParams: { missingSteps: ['smokingPets'] },
    });
  }

  return gaps;
};

export const getCompletionPercentage = (user: User): number => {
  const fields = [
    !!(user.photos?.length || user.profilePicture),
    !!(user.profileData?.bio && user.profileData.bio.trim().length >= 20),
    !!(user.profileData?.occupation && user.profileData.occupation.trim().length > 0),
    !!(user.profileData?.preferences?.sleepSchedule && user.profileData?.preferences?.cleanliness),
    !!user.profileData?.budget,
    (Array.isArray(user.profileData?.interests) && user.profileData!.interests!.length >= 3),
    !!(user.profileData?.city || user.profileData?.neighborhood),
  ];

  const weights = [15, 15, 15, 20, 15, 10, 10];
  return fields.reduce((total, done, i) => total + (done ? weights[i] : 0), 0);
};

export const getHostCompletionPercentage = (user: User): number => {
  let score = 0;
  if (user.photos?.length || user.profilePicture) score += 15;
  if (user.profileData?.bio && user.profileData.bio.trim().length >= 20) score += 15;
  if (user.licenseNumber) score += 30;
  if (user.agencyName || user.companyName) score += 20;
  if (user.hostType) score += 20;
  return Math.min(score, 100);
};

export const validateInterestTags = (
  selectedTags: string[],
  tagIdsByCategory: Record<string, string[]>,
): { valid: boolean; message: string } => {
  const requiredCategories = ['lifestyle', 'habits', 'hobbies', 'social', 'diet'];
  const missing: string[] = [];
  for (const cat of requiredCategories) {
    const ids = tagIdsByCategory[cat] || [];
    if (!selectedTags.some(t => ids.includes(t))) {
      missing.push(cat.charAt(0).toUpperCase() + cat.slice(1));
    }
  }
  if (missing.length > 0) {
    return { valid: false, message: `Pick at least 1 from: ${missing.join(', ')}` };
  }
  if (selectedTags.length < 5) {
    return { valid: false, message: `Pick at least 5 tags to continue (1 per category)` };
  }
  return { valid: true, message: '' };
};

export const getMatchMultiplier = (percentage: number): number => {
  if (percentage < 40) return 5;
  if (percentage <= 70) return 3;
  if (percentage <= 90) return 2;
  if (percentage <= 99) return 1.5;
  return 1;
};
