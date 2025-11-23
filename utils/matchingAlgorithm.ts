import { User, RoommateProfile } from '../types/models';

/**
 * Points-based matching algorithm for roommate compatibility
 * 
 * Based on 10 core matching questions with weighted scoring:
 * 1. Sleep Schedule: 12 points (#1 conflict factor)
 * 2. Cleanliness: 12 points (40% of issues)
 * 3. Guests Frequency: 10 points (social behavior match)
 * 4. Noise Tolerance: 10 points (major predictor)
 * 5. Smoking/Substances: 12 points (deal-breaker)
 * 6. Work Location: 10 points (WFH needs quiet)
 * 7. Roommate Relationship: 8 points (social expectations)
 * 8. Budget: 12 points (realistic matches)
 * 9. Pets: 8 points (prevents deal-breakers)
 * 10. Lifestyle Alignment: 6 points (long-term harmony)
 * 
 * Total: 100 points
 */

export interface MatchScore {
  totalScore: number;
  breakdown: {
    sleepSchedule: number;
    cleanliness: number;
    guestPolicy: number;
    noiseTolerance: number;
    smoking: number;
    workLocation: number;
    roommateRelationship: number;
    budget: number;
    pets: number;
    lifestyle: number;
  };
}

/**
 * Calculate compatibility score between current user and a roommate profile
 */
export const calculateCompatibility = (
  currentUser: User,
  roommateProfile: RoommateProfile
): number => {
  const score = calculateDetailedCompatibility(currentUser, roommateProfile);
  return Math.round(score.totalScore);
};

/**
 * Calculate detailed compatibility with breakdown
 */
export const calculateDetailedCompatibility = (
  currentUser: User,
  roommateProfile: RoommateProfile
): MatchScore => {
  const breakdown = {
    sleepSchedule: 0,
    cleanliness: 0,
    guestPolicy: 0,
    noiseTolerance: 0,
    smoking: 0,
    workLocation: 0,
    roommateRelationship: 0,
    budget: 0,
    pets: 0,
    lifestyle: 0,
  };

  const userPrefs = currentUser.profileData?.preferences;
  
  if (!userPrefs) {
    return { totalScore: 50, breakdown };
  }

  // 1. SLEEP SCHEDULE (12 points) - #1 conflict factor
  if (userPrefs.sleepSchedule && roommateProfile.lifestyle?.workSchedule) {
    const userSleep = userPrefs.sleepSchedule;
    const roommateSleep = mapWorkScheduleToSleep(roommateProfile.lifestyle.workSchedule);
    
    if (userSleep === roommateSleep) {
      breakdown.sleepSchedule = 12;
    } else if (userSleep === 'flexible' || roommateSleep === 'flexible') {
      breakdown.sleepSchedule = 8;
    } else if (userSleep === 'irregular' || roommateSleep === 'irregular') {
      breakdown.sleepSchedule = 5;
    } else {
      breakdown.sleepSchedule = 0;
    }
  } else {
    breakdown.sleepSchedule = 6;
  }

  // 2. CLEANLINESS (12 points) - 40% of issues
  if (userPrefs.cleanliness && roommateProfile.lifestyle?.cleanliness) {
    const userLevel = cleanlinessToNumber(userPrefs.cleanliness);
    const roommateLevel = roommateProfile.lifestyle.cleanliness;
    
    const difference = Math.abs(userLevel - roommateLevel);
    
    if (difference === 0) {
      breakdown.cleanliness = 12;
    } else if (difference === 1) {
      breakdown.cleanliness = 8;
    } else if (difference === 2) {
      breakdown.cleanliness = 4;
    } else {
      breakdown.cleanliness = 0;
    }
  } else {
    breakdown.cleanliness = 6;
  }

  // 3. GUESTS FREQUENCY (10 points) - Social behavior must match
  if (userPrefs.guestPolicy) {
    const userGuests = userPrefs.guestPolicy;
    const roommateGuests = inferGuestPolicyFromSocial(roommateProfile.lifestyle?.socialLevel);
    
    if (userGuests === roommateGuests) {
      breakdown.guestPolicy = 10;
    } else if (userGuests === 'prefer_no_guests' || roommateGuests === 'prefer_no_guests') {
      breakdown.guestPolicy = 0;
    } else if (
      (userGuests === 'occasionally' && roommateGuests !== 'rarely') ||
      (roommateGuests === 'occasionally' && userGuests !== 'rarely')
    ) {
      breakdown.guestPolicy = 6;
    } else {
      breakdown.guestPolicy = 3;
    }
  } else {
    breakdown.guestPolicy = 5;
  }

  // 4. NOISE TOLERANCE (10 points) - Major predictor
  if (userPrefs.noiseTolerance && roommateProfile.lifestyle?.socialLevel) {
    const userNoise = userPrefs.noiseTolerance;
    const roommateNoise = inferNoiseToleranceFromSocial(roommateProfile.lifestyle.socialLevel);
    
    if (userNoise === roommateNoise) {
      breakdown.noiseTolerance = 10;
    } else if (
      (userNoise === 'normal_noise') ||
      (roommateNoise === 'normal_noise')
    ) {
      breakdown.noiseTolerance = 6;
    } else {
      breakdown.noiseTolerance = 2;
    }
  } else {
    breakdown.noiseTolerance = 5;
  }

  // 5. SMOKING/SUBSTANCES (12 points) - Huge deal-breaker
  if (userPrefs.smoking && roommateProfile.lifestyle?.smoking !== undefined) {
    const userSmokes = userPrefs.smoking;
    const roommateSmokes = roommateProfile.lifestyle.smoking;
    
    if (userSmokes === 'no' && !roommateSmokes) {
      breakdown.smoking = 12;
    } else if (userSmokes === 'only_outside' && !roommateSmokes) {
      breakdown.smoking = 10;
    } else if (userSmokes === 'only_outside' && roommateSmokes) {
      breakdown.smoking = 6;
    } else if ((userSmokes === 'yes' && roommateSmokes) || (userSmokes === 'only_outside')) {
      breakdown.smoking = 12;
    } else {
      breakdown.smoking = 0;
    }
  } else {
    breakdown.smoking = 6;
  }

  // 6. WORK LOCATION (10 points) - WFH people need compatible quiet hours
  if (userPrefs.workLocation && roommateProfile.lifestyle?.workSchedule) {
    const userWork = userPrefs.workLocation;
    const roommateWork = mapToWorkLocation(roommateProfile.lifestyle.workSchedule);
    
    if (userWork === roommateWork) {
      breakdown.workLocation = 10;
    } else if (userWork === 'hybrid' || roommateWork === 'hybrid') {
      breakdown.workLocation = 7;
    } else if (
      (userWork === 'wfh_fulltime' && roommateWork === 'office_fulltime') ||
      (userWork === 'office_fulltime' && roommateWork === 'wfh_fulltime')
    ) {
      breakdown.workLocation = 5;
    } else {
      breakdown.workLocation = 4;
    }
  } else {
    breakdown.workLocation = 5;
  }

  // 7. ROOMMATE RELATIONSHIP (8 points) - Social expectations matter
  if (userPrefs.roommateRelationship) {
    const userRel = userPrefs.roommateRelationship;
    const roommateRel = inferRelationshipFromSocial(roommateProfile.lifestyle?.socialLevel);
    
    if (userRel === roommateRel) {
      breakdown.roommateRelationship = 8;
    } else if (userRel === 'respectful_coliving' || roommateRel === 'respectful_coliving') {
      breakdown.roommateRelationship = 6;
    } else if (
      (userRel === 'minimal_interaction' && roommateRel === 'prefer_friends') ||
      (userRel === 'prefer_friends' && roommateRel === 'minimal_interaction')
    ) {
      breakdown.roommateRelationship = 2;
    } else {
      breakdown.roommateRelationship = 5;
    }
  } else {
    breakdown.roommateRelationship = 4;
  }

  // 8. BUDGET (12 points) - Determines realistic matches
  if (currentUser.profileData?.budget && roommateProfile.budget) {
    const userBudget = currentUser.profileData.budget;
    const roommateBudget = roommateProfile.budget;
    const percentDiff = Math.abs(userBudget - roommateBudget) / Math.max(userBudget, roommateBudget);
    
    if (percentDiff <= 0.10) {
      breakdown.budget = 12;
    } else if (percentDiff <= 0.25) {
      breakdown.budget = 8;
    } else if (percentDiff <= 0.50) {
      breakdown.budget = 4;
    } else {
      breakdown.budget = 1;
    }
  } else {
    breakdown.budget = 6;
  }

  // 9. PETS (8 points) - Prevents deal-breakers
  if (userPrefs.pets && roommateProfile.lifestyle?.pets !== undefined) {
    const userPets = userPrefs.pets;
    const roommatePets = roommateProfile.lifestyle.pets;
    
    if (userPets === 'have_pets' && roommatePets) {
      breakdown.pets = 8;
    } else if (userPets === 'open_to_pets' && (roommatePets || !roommatePets)) {
      breakdown.pets = 8;
    } else if (userPets === 'no_pets' && !roommatePets) {
      breakdown.pets = 8;
    } else if (userPets === 'no_pets' && roommatePets) {
      breakdown.pets = 0;
    } else {
      breakdown.pets = 4;
    }
  } else {
    breakdown.pets = 4;
  }

  // 10. LIFESTYLE ALIGNMENT (6 points) - Long-term harmony
  if (userPrefs.lifestyle && userPrefs.lifestyle.length > 0 && roommateProfile.occupation) {
    const userLifestyles = userPrefs.lifestyle;
    const roommateOcc = roommateProfile.occupation.toLowerCase();
    
    let matchCount = 0;
    
    if (userLifestyles.includes('active_gym') && roommateOcc.includes('fitness')) matchCount++;
    if (userLifestyles.includes('homebody') && (roommateOcc.includes('remote') || roommateOcc.includes('home'))) matchCount++;
    if (userLifestyles.includes('nightlife_social') && roommateOcc.includes('social')) matchCount++;
    if (userLifestyles.includes('quiet_introverted') && (roommateOcc.includes('developer') || roommateOcc.includes('writer'))) matchCount++;
    if (userLifestyles.includes('creative_artistic') && (roommateOcc.includes('design') || roommateOcc.includes('artist'))) matchCount++;
    if (userLifestyles.includes('professional_focused') && (roommateOcc.includes('engineer') || roommateOcc.includes('analyst'))) matchCount++;
    
    if (matchCount >= 2) {
      breakdown.lifestyle = 6;
    } else if (matchCount === 1) {
      breakdown.lifestyle = 4;
    } else {
      breakdown.lifestyle = 2;
    }
  } else {
    breakdown.lifestyle = 3;
  }

  // Calculate total score
  const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

  return {
    totalScore,
    breakdown,
  };
};

/**
 * Helper: Map work schedule to sleep pattern
 */
const mapWorkScheduleToSleep = (workSchedule: string): 'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular' => {
  const schedule = workSchedule.toLowerCase();
  if (schedule.includes('9-5') || schedule.includes('early') || schedule.includes('morning')) return 'early_sleeper';
  if (schedule.includes('night') || schedule.includes('late') || schedule.includes('evening')) return 'late_sleeper';
  if (schedule.includes('shift') || schedule.includes('irregular')) return 'irregular';
  return 'flexible';
};

/**
 * Helper: Convert cleanliness string to number
 */
const cleanlinessToNumber = (level: 'very_tidy' | 'moderately_tidy' | 'relaxed'): number => {
  if (level === 'very_tidy') return 5;
  if (level === 'moderately_tidy') return 3;
  if (level === 'relaxed') return 1;
  return 3;
};

/**
 * Helper: Infer guest policy from social level
 */
const inferGuestPolicyFromSocial = (socialLevel?: number): 'frequently' | 'occasionally' | 'rarely' | 'prefer_no_guests' => {
  if (!socialLevel) return 'occasionally';
  if (socialLevel >= 9) return 'frequently';
  if (socialLevel >= 5) return 'occasionally';
  if (socialLevel >= 2) return 'rarely';
  return 'prefer_no_guests';
};

/**
 * Helper: Infer noise tolerance from social level
 */
const inferNoiseToleranceFromSocial = (socialLevel: number): 'prefer_quiet' | 'normal_noise' | 'loud_environments' => {
  if (socialLevel >= 8) return 'loud_environments';
  if (socialLevel >= 4) return 'normal_noise';
  return 'prefer_quiet';
};

/**
 * Helper: Map work schedule to work location
 */
const mapToWorkLocation = (workSchedule: string): 'wfh_fulltime' | 'hybrid' | 'office_fulltime' | 'irregular' => {
  const schedule = workSchedule.toLowerCase();
  if (schedule.includes('remote') || schedule.includes('home')) return 'wfh_fulltime';
  if (schedule.includes('hybrid') || schedule.includes('flex')) return 'hybrid';
  if (schedule.includes('office') || schedule.includes('9-5')) return 'office_fulltime';
  return 'irregular';
};

/**
 * Helper: Infer relationship preference from social level
 */
const inferRelationshipFromSocial = (socialLevel?: number): 'respectful_coliving' | 'occasional_hangouts' | 'prefer_friends' | 'minimal_interaction' => {
  if (!socialLevel) return 'respectful_coliving';
  if (socialLevel >= 9) return 'prefer_friends';
  if (socialLevel >= 6) return 'occasional_hangouts';
  if (socialLevel >= 3) return 'respectful_coliving';
  return 'minimal_interaction';
};

/**
 * Get match quality label
 */
export const getMatchQualityLabel = (score: number): string => {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Great Match';
  if (score >= 70) return 'Good Match';
  if (score >= 60) return 'Fair Match';
  return 'Low Match';
};

/**
 * Get match quality color
 */
export const getMatchQualityColor = (score: number): string => {
  if (score >= 80) return '#10B981'; // Green
  if (score >= 70) return '#3B82F6'; // Blue
  if (score >= 60) return '#F59E0B'; // Orange
  return '#EF4444'; // Red
};
