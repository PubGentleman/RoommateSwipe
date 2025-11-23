import { User, RoommateProfile } from '../types/models';

/**
 * Points-based matching algorithm for roommate compatibility
 * 
 * Based on 10 core matching questions with weighted scoring:
 * - Sleep Schedule: 15 points
 * - Cleanliness: 15 points
 * - Guest Policy: 10 points
 * - Smoking/Lifestyle: 15 points
 * - Pet Friendly: 10 points
 * - Budget Compatibility: 15 points
 * - Location Preference: 10 points
 * - Occupation/Lifestyle Match: 10 points
 * 
 * Total: 100 points
 */

export interface MatchScore {
  totalScore: number;
  breakdown: {
    sleepSchedule: number;
    cleanliness: number;
    guestPolicy: number;
    lifestyle: number;
    pets: number;
    budget: number;
    location: number;
    occupation: number;
  };
}

/**
 * Calculate compatibility score between current user and a roommate profile
 * @param currentUser - The logged-in user
 * @param roommateProfile - The potential roommate's profile
 * @returns Compatibility score out of 100
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
    lifestyle: 0,
    pets: 0,
    budget: 0,
    location: 0,
    occupation: 0,
  };

  const userProfile = currentUser.profileData;
  
  if (!userProfile) {
    return { totalScore: 50, breakdown };
  }

  // 1. SLEEP SCHEDULE (15 points)
  // Exact match = 15, Flexible match = 10, Mismatch = 0
  if (userProfile.preferences?.sleepSchedule && roommateProfile.lifestyle?.workSchedule) {
    const userSleep = userProfile.preferences.sleepSchedule;
    const roommateSleep = mapWorkScheduleToSleep(roommateProfile.lifestyle.workSchedule);
    
    if (userSleep === roommateSleep) {
      breakdown.sleepSchedule = 15;
    } else if (userSleep === 'flexible' || roommateSleep === 'flexible') {
      breakdown.sleepSchedule = 10;
    } else {
      breakdown.sleepSchedule = 0;
    }
  } else {
    breakdown.sleepSchedule = 8;
  }

  // 2. CLEANLINESS (15 points)
  // Perfect match = 15, Close match = 10, Far match = 5, Very far = 0
  if (userProfile.preferences?.cleanliness && roommateProfile.lifestyle?.cleanliness) {
    const userLevel = cleanlinessToNumber(userProfile.preferences.cleanliness);
    const roommateLevel = roommateProfile.lifestyle.cleanliness;
    
    const difference = Math.abs(userLevel - roommateLevel);
    
    if (difference === 0) {
      breakdown.cleanliness = 15;
    } else if (difference === 1) {
      breakdown.cleanliness = 10;
    } else if (difference === 2) {
      breakdown.cleanliness = 5;
    } else {
      breakdown.cleanliness = 0;
    }
  } else {
    breakdown.cleanliness = 8;
  }

  // 3. GUEST POLICY (10 points)
  // Exact match = 10, Compatible = 7, Incompatible = 0
  if (userProfile.preferences?.guestPolicy) {
    const userGuests = userProfile.preferences.guestPolicy;
    const roommateGuests = inferGuestPolicyFromSocial(roommateProfile.lifestyle?.socialLevel);
    
    if (userGuests === roommateGuests) {
      breakdown.guestPolicy = 10;
    } else if (
      (userGuests === 'occasional' && roommateGuests !== 'rarely') ||
      (roommateGuests === 'occasional' && userGuests !== 'rarely')
    ) {
      breakdown.guestPolicy = 7;
    } else {
      breakdown.guestPolicy = 3;
    }
  } else {
    breakdown.guestPolicy = 5;
  }

  // 4. SMOKING & DRINKING (15 points combined)
  // Non-smoker + Non-smoker = 8, Smoker + Smoker = 8, Mismatch = 0
  // Drinking compatibility = 7 (exact), 5 (compatible), 0 (very different)
  let lifestyleScore = 0;
  
  if (userProfile.lifestyle?.smoking !== undefined && roommateProfile.lifestyle?.smoking !== undefined) {
    if (userProfile.lifestyle.smoking === roommateProfile.lifestyle.smoking) {
      lifestyleScore += 8;
    } else {
      lifestyleScore += 0;
    }
  } else {
    lifestyleScore += 4;
  }
  
  if (userProfile.lifestyle?.drinking) {
    const userDrink = userProfile.lifestyle.drinking;
    const roommateDrink = 'social';
    
    if (userDrink === roommateDrink) {
      lifestyleScore += 7;
    } else if ((userDrink === 'non-drinker' || userDrink === 'regular') && roommateDrink === 'social') {
      lifestyleScore += 5;
    } else {
      lifestyleScore += 2;
    }
  } else {
    lifestyleScore += 3;
  }
  
  breakdown.lifestyle = lifestyleScore;

  // 5. PETS (10 points)
  // Both pet-friendly = 10, Both not = 10, Mismatch = 0
  if (userProfile.preferences?.petFriendly !== undefined && roommateProfile.lifestyle?.pets !== undefined) {
    if (userProfile.preferences.petFriendly === roommateProfile.lifestyle.pets) {
      breakdown.pets = 10;
    } else if (userProfile.preferences.petFriendly === true && roommateProfile.lifestyle.pets === false) {
      breakdown.pets = 5;
    } else {
      breakdown.pets = 0;
    }
  } else {
    breakdown.pets = 5;
  }

  // 6. BUDGET COMPATIBILITY (15 points)
  // Within 10% = 15, Within 25% = 10, Within 50% = 5, More = 0
  if (userProfile.budget && roommateProfile.budget) {
    const userBudget = userProfile.budget;
    const roommateBudget = roommateProfile.budget;
    const percentDiff = Math.abs(userBudget - roommateBudget) / Math.max(userBudget, roommateBudget);
    
    if (percentDiff <= 0.10) {
      breakdown.budget = 15;
    } else if (percentDiff <= 0.25) {
      breakdown.budget = 10;
    } else if (percentDiff <= 0.50) {
      breakdown.budget = 5;
    } else {
      breakdown.budget = 2;
    }
  } else {
    breakdown.budget = 8;
  }

  // 7. LOCATION PREFERENCE (10 points)
  // Exact match = 10, Partial match = 7, Different = 3
  if (userProfile.location && roommateProfile.preferences?.location) {
    const userLoc = userProfile.location.toLowerCase().trim();
    const roommateLoc = roommateProfile.preferences.location.toLowerCase().trim();
    
    if (userLoc === roommateLoc) {
      breakdown.location = 10;
    } else if (userLoc.includes(roommateLoc) || roommateLoc.includes(userLoc)) {
      breakdown.location = 7;
    } else {
      breakdown.location = 3;
    }
  } else {
    breakdown.location = 5;
  }

  // 8. OCCUPATION/LIFESTYLE ALIGNMENT (10 points)
  // Similar occupations or interests = higher score
  if (userProfile.occupation && roommateProfile.occupation) {
    const userOcc = userProfile.occupation.toLowerCase();
    const roommateOcc = roommateProfile.occupation.toLowerCase();
    
    const studentKeywords = ['student', 'university', 'college'];
    const professionalKeywords = ['engineer', 'developer', 'manager', 'analyst', 'designer'];
    
    const userIsStudent = studentKeywords.some(k => userOcc.includes(k));
    const roommateIsStudent = studentKeywords.some(k => roommateOcc.includes(k));
    const userIsProfessional = professionalKeywords.some(k => userOcc.includes(k));
    const roommateIsProfessional = professionalKeywords.some(k => roommateOcc.includes(k));
    
    if (userOcc === roommateOcc) {
      breakdown.occupation = 10;
    } else if ((userIsStudent && roommateIsStudent) || (userIsProfessional && roommateIsProfessional)) {
      breakdown.occupation = 8;
    } else {
      breakdown.occupation = 5;
    }
  } else {
    breakdown.occupation = 5;
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
const mapWorkScheduleToSleep = (workSchedule: string): 'early' | 'late' | 'flexible' => {
  const schedule = workSchedule.toLowerCase();
  if (schedule.includes('9-5') || schedule.includes('early')) return 'early';
  if (schedule.includes('night') || schedule.includes('late')) return 'late';
  return 'flexible';
};

/**
 * Helper: Convert cleanliness string to number
 */
const cleanlinessToNumber = (level: 'very_clean' | 'clean' | 'moderate'): number => {
  if (level === 'very_clean') return 5;
  if (level === 'clean') return 3;
  if (level === 'moderate') return 1;
  return 3;
};

/**
 * Helper: Infer guest policy from social level
 */
const inferGuestPolicyFromSocial = (socialLevel?: number): 'frequent' | 'occasional' | 'rarely' => {
  if (!socialLevel) return 'occasional';
  if (socialLevel >= 8) return 'frequent';
  if (socialLevel >= 5) return 'occasional';
  return 'rarely';
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
