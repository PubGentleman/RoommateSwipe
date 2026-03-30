import { User, RoommateProfile, PiParsedPreferences } from '../types/models';
import { isNearbyNeighborhood, isSameCity, getClosestNeighborhoodDistance, getZipCodeDistance } from './locationData';
import { getZodiacCompatibilityScore } from './zodiacUtils';

/**
 * Format location for display with privacy in mind
 * Shows neighborhood and city instead of full street address
 * @param location - Object containing neighborhood, city, state, and address
 * @returns Formatted location string (e.g., "Williamsburg, New York")
 */
export const formatLocation = (location: {
  neighborhood?: string;
  city?: string;
  state?: string;
  address?: string;
}, revealed: boolean = false): string => {
  if (revealed && location.address) {
    return `${location.address}${location.city ? ', ' + location.city : ''}${location.state ? ', ' + location.state : ''}`;
  }

  if (location.neighborhood && location.city) {
    return `${location.neighborhood}, ${location.city}`;
  }
  
  if (location.neighborhood) {
    return location.neighborhood;
  }
  
  if (location.city && location.state) {
    return `${location.city}, ${location.state}`;
  }
  
  if (location.city) {
    return location.city;
  }
  
  return location.address || 'Location not specified';
};

/**
 * Comprehensive points-based matching algorithm for roommate compatibility
 * 
 * Uses ALL profile data with weighted scoring (Total: 100 points):
 * 
 * HIGH PRIORITY (Deal-breakers & Critical Factors):
 * 0. Age: 8 points - Similar life stage strongly predicts roommate success
 * 1. Location: 16 points - Geographic compatibility (same/close neighborhoods prioritized)
 * 2. Budget: 12 points - Financial alignment (realistic matches)
 * 3. Sleep Schedule: 12 points - #1 reported conflict factor
 * 4. Cleanliness: 12 points - 40% of roommate issues
 * 5. Smoking/Substances: 10 points - Major deal-breaker
 * 6. Move-in Timeline: 4 points - Penalizes mismatched timelines
 * 
 * MEDIUM PRIORITY (Lifestyle Compatibility):
 * 7. Work Location: 6 points - WFH needs quiet, Office needs flexibility
 * 8. Guest Policy: 6 points - Social behavior alignment
 * 9. Noise Tolerance: 4 points - Daily comfort predictor
 * 10. Pets: 4 points - Prevents allergies/preferences conflicts
 * 
 * LOWER PRIORITY (Relationship & Interests):
 * 11. Roommate Relationship: 2 points - Social expectations
 * 12. Shared Expenses: 2 points - Alignment on splitting utilities, groceries, internet, cleaning
 * 13. Lifestyle Tags: 2 points - Shared interests/activities (baseline 1 pt)
 * 14. Zodiac Sign: 2 points - Optional fun factor, element-based compatibility (only if both users have it)
 */

const COMPATIBLE_PERSONALITY: Record<string, string[]> = {
  q1_alone: ['q1_alone', 'q1_music'],
  q1_music: ['q1_alone', 'q1_music'],
  q1_social: ['q1_social', 'q1_kitchen'],
  q1_kitchen: ['q1_social', 'q1_kitchen'],
  q2_text: ['q2_text', 'q2_flow'],
  q2_direct: ['q2_direct', 'q2_meeting'],
  q2_meeting: ['q2_direct', 'q2_meeting'],
  q2_flow: ['q2_text', 'q2_flow'],
  q3_immediate: ['q3_immediate', 'q3_sameday'],
  q3_sameday: ['q3_immediate', 'q3_sameday'],
  q3_nextday: ['q3_nextday', 'q3_flexible'],
  q3_flexible: ['q3_nextday', 'q3_flexible'],
  q4_friends: ['q4_friends', 'q4_friendly'],
  q4_friendly: ['q4_friends', 'q4_friendly'],
  q4_respectful: ['q4_respectful', 'q4_parallel'],
  q4_parallel: ['q4_respectful', 'q4_parallel'],
  q5_under_20: ['q5_under_20', 'q5_under_40'],
  q5_under_40: ['q5_under_20', 'q5_under_40', 'q5_under_60'],
  q5_under_60: ['q5_under_40', 'q5_under_60', 'q5_flexible'],
  q5_flexible: ['q5_under_60', 'q5_flexible'],
};

const calculatePersonalityScore = (
  answers1: Record<string, string> | undefined,
  answers2: Record<string, string> | undefined
): number => {
  if (!answers1 || !answers2) return 50;
  let matches = 0;
  let total = 0;
  Object.keys(answers1).forEach(q => {
    if (q.endsWith('_source') || q.endsWith('_collectedAt')) return;
    if (!answers2[q]) return;
    const key = `${q}_${answers1[q]}`;
    const val2 = `${q}_${answers2[q]}`;
    if (COMPATIBLE_PERSONALITY[key]?.includes(val2)) matches++;
    total++;
  });
  return total > 0 ? (matches / total) * 100 : 50;
};

export interface MatchScore {
  totalScore: number;
  breakdown: {
    age: number;
    location: number;
    budget: number;
    sleepSchedule: number;
    cleanliness: number;
    smoking: number;
    moveInTimeline: number;
    workLocation: number;
    guestPolicy: number;
    noiseTolerance: number;
    pets: number;
    roommateRelationship: number;
    sharedExpenses: number;
    lifestyle: number;
    zodiac: number;
    personality: number;
    piPreference: number;
  };
  reasons: {
    strengths: string[];
    concerns: string[];
    notes: string[];
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
 * Calculate detailed compatibility with breakdown and reasoning
 */
const ZERO_SCORE: MatchScore = {
  totalScore: 0,
  breakdown: {
    age: 0, location: 0, budget: 0, sleepSchedule: 0, cleanliness: 0,
    smoking: 0, moveInTimeline: 0, workLocation: 0, guestPolicy: 0,
    noiseTolerance: 0, pets: 0, roommateRelationship: 0, sharedExpenses: 0,
    lifestyle: 0, zodiac: 0, personality: 0, piPreference: 0,
  },
  reasons: {
    strengths: [],
    concerns: ['This profile doesn\'t match your dealbreakers'],
    notes: [],
  },
};

export const calculateDetailedCompatibility = (
  currentUser: User,
  roommateProfile: RoommateProfile
): MatchScore => {
  const userDealbreakers: string[] = currentUser.profileData?.dealbreakers || [];

  if (userDealbreakers.length > 0) {
    const profileSmoking = roommateProfile.lifestyle?.smoking || roommateProfile.profileData?.preferences?.smoking;
    const profilePets = roommateProfile.lifestyle?.pets || roommateProfile.profileData?.preferences?.pets;
    const profilePetType = roommateProfile.profileData?.petType;

    for (const dealbreaker of userDealbreakers) {
      switch (dealbreaker) {
        case 'no_smokers':
          if (profileSmoking === 'yes' || profileSmoking === 'only_outside') return ZERO_SCORE;
          break;
        case 'no_cats':
          if (profilePets === 'have_pets' && profilePetType === 'cat') return ZERO_SCORE;
          break;
        case 'no_dogs':
          if (profilePets === 'have_pets' && profilePetType === 'dog') return ZERO_SCORE;
          break;
        case 'no_pets':
          if (profilePets === 'have_pets') return ZERO_SCORE;
          break;
        case 'no_overnight_guests':
          if (roommateProfile.profileData?.preferences?.guestPolicy === 'frequently') return ZERO_SCORE;
          break;
      }
    }
  }

  const breakdown = {
    age: 0,
    location: 0,
    budget: 0,
    sleepSchedule: 0,
    cleanliness: 0,
    smoking: 0,
    moveInTimeline: 0,
    workLocation: 0,
    guestPolicy: 0,
    noiseTolerance: 0,
    pets: 0,
    roommateRelationship: 0,
    sharedExpenses: 0,
    lifestyle: 1,
    zodiac: 0,
    personality: 0,
  };

  const reasons = {
    strengths: [] as string[],
    concerns: [] as string[],
    notes: [] as string[],
  };

  const userPrefs = currentUser.profileData?.preferences;
  const userProfile = currentUser.profileData;
  
  if (!userPrefs || !userProfile) {
    // Return neutral baseline score (60-65%) to maintain backward compatibility
    // When user data is missing, default to a neutral compatibility level
    // This preserves historical color thresholds (60-65% = orange/blue range)
    const neutralBreakdown = {
      ...breakdown,
      age: 4,
      location: 10,
      budget: 8,
      sleepSchedule: 8,
      cleanliness: 8,
      smoking: 7,
      moveInTimeline: 2,
      workLocation: 3,
      guestPolicy: 3,
      noiseTolerance: 3,
      pets: 3,
      roommateRelationship: 1,
      sharedExpenses: 1,
      lifestyle: 1,
      zodiac: 0,
      personality: 7,
      piPreference: 0,
    };
    const neutralScore = Object.values(neutralBreakdown).reduce((sum, score) => sum + score, 0);
    return { totalScore: neutralScore, breakdown: neutralBreakdown, reasons };
  }

  // ========================================
  // 0. AGE (8 points) - PRIMARY FACTOR
  // Closer ages = higher compatibility; large gaps reduce score
  // ========================================
  const getUserAge = (): number | null => {
    if (currentUser.age) return currentUser.age;
    if (currentUser.birthday) {
      const parts = currentUser.birthday.split('T')[0].split('-').map(Number);
      const birth = new Date(parts[0], parts[1] - 1, parts[2]);
      const today = new Date();
      let a = today.getFullYear() - birth.getFullYear();
      const md = today.getMonth() - birth.getMonth();
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) a--;
      return a;
    }
    return null;
  };
  const userAge = getUserAge();
  const roommateAge = roommateProfile.age;

  if (userAge && roommateAge) {
    const ageDiff = Math.abs(userAge - roommateAge);
    if (ageDiff <= 2) {
      breakdown.age = 8;
      reasons.strengths.push(`Very close in age (${userAge} & ${roommateAge}) - similar life stage`);
    } else if (ageDiff <= 5) {
      breakdown.age = 6;
      reasons.strengths.push(`Similar age range (${userAge} & ${roommateAge})`);
    } else if (ageDiff <= 10) {
      breakdown.age = 4;
      reasons.notes.push(`Moderate age difference (${ageDiff} years apart)`);
    } else if (ageDiff <= 15) {
      breakdown.age = 2;
      reasons.concerns.push(`Notable age gap (${ageDiff} years) - may have different lifestyles`);
    } else {
      breakdown.age = 0;
      reasons.concerns.push(`Large age difference (${ageDiff} years) - likely different life stages`);
    }
  } else {
    breakdown.age = 4;
  }

  // ========================================
  // 1. LOCATION (16 points) - MAJOR FACTOR
  // Uses multi-neighborhood overlap + coordinate distance + zip code proximity
  // ========================================
  const userNeighborhoods: string[] = [...new Set([
    ...(currentUser.profileData?.preferred_neighborhoods || []),
    ...(currentUser.profileData?.neighborhood ? [currentUser.profileData.neighborhood] : []),
    ...(userProfile.neighborhood ? [userProfile.neighborhood] : []),
  ])].filter(Boolean);

  const roommateNeighborhoods: string[] = [...new Set([
    ...(roommateProfile.preferredNeighborhoods || []),
    ...(roommateProfile.profileData?.preferred_neighborhoods || []),
    ...(roommateProfile.preferences?.location ? [roommateProfile.preferences.location] : []),
  ])].filter(Boolean);

  const fallbackSameCity = () => {
    const userCity = currentUser.profileData?.city || (currentUser as any).city;
    const roommateCity = (roommateProfile as any).city || roommateProfile.preferences?.location;
    if (userCity && roommateCity && isSameCity(userCity, roommateCity)) {
      breakdown.location = 6;
      reasons.notes.push(`Same city, but no specific neighborhood overlap`);
    } else if (userCity && roommateCity) {
      breakdown.location = 0;
      reasons.concerns.push(`Different cities`);
    } else {
      breakdown.location = 8;
    }
  };

  if (userNeighborhoods.length > 0 && roommateNeighborhoods.length > 0) {
    const directOverlap = userNeighborhoods.filter(n =>
      roommateNeighborhoods.includes(n)
    );

    if (directOverlap.length >= 2) {
      breakdown.location = 16;
      reasons.strengths.push(
        `Both want ${directOverlap.slice(0, 2).join(' & ')} — perfect location match`
      );
    } else if (directOverlap.length === 1) {
      breakdown.location = 14;
      reasons.strengths.push(`Both interested in ${directOverlap[0]}`);
    } else {
      const closest = getClosestNeighborhoodDistance(userNeighborhoods, roommateNeighborhoods);

      if (closest) {
        if (closest.distance <= 1) {
          breakdown.location = 12;
          reasons.strengths.push(
            `${closest.pairA} and ${closest.pairB} are under a mile apart`
          );
        } else if (closest.distance <= 3) {
          breakdown.location = 10;
          reasons.strengths.push(
            `${closest.pairA} and ${closest.pairB} are ${closest.distance.toFixed(1)} miles apart`
          );
        } else if (closest.distance <= 5) {
          breakdown.location = 8;
          reasons.notes.push(
            `Closest neighborhoods are ${closest.distance.toFixed(1)} miles apart`
          );
        } else if (closest.distance <= 10) {
          breakdown.location = 4;
          reasons.notes.push(
            `Neighborhoods are ${closest.distance.toFixed(0)} miles apart`
          );
        } else {
          breakdown.location = 2;
          reasons.concerns.push(
            `Preferred areas are ${closest.distance.toFixed(0)} miles apart`
          );
        }
      } else {
        const userZip = currentUser.profileData?.zip_code || currentUser.zip_code;
        const roommateZip = roommateProfile.zip_code || roommateProfile.profileData?.zip_code;

        if (userZip && roommateZip) {
          const zipDist = getZipCodeDistance(userZip, roommateZip);
          if (zipDist !== null) {
            if (zipDist <= 2) {
              breakdown.location = 12;
              reasons.strengths.push(`Zip codes within 2 miles`);
            } else if (zipDist <= 5) {
              breakdown.location = 10;
              reasons.notes.push(`Zip codes within 5 miles`);
            } else if (zipDist <= 10) {
              breakdown.location = 6;
              reasons.notes.push(`Zip codes about ${Math.round(zipDist)} miles apart`);
            } else {
              breakdown.location = 2;
              reasons.concerns.push(`Zip codes are ${Math.round(zipDist)} miles apart`);
            }
          } else {
            fallbackSameCity();
          }
        } else {
          fallbackSameCity();
        }
      }
    }
  } else {
    const userZip = currentUser.profileData?.zip_code || currentUser.zip_code;
    const roommateZip = roommateProfile.zip_code || roommateProfile.profileData?.zip_code;

    if (userZip && roommateZip) {
      const zipDist = getZipCodeDistance(userZip, roommateZip);
      if (zipDist !== null) {
        if (zipDist <= 2) {
          breakdown.location = 12;
          reasons.strengths.push(`Very close zip codes`);
        } else if (zipDist <= 5) {
          breakdown.location = 10;
          reasons.notes.push(`Zip codes within 5 miles`);
        } else if (zipDist <= 10) {
          breakdown.location = 6;
          reasons.notes.push(`Zip codes about ${Math.round(zipDist)} miles apart`);
        } else {
          breakdown.location = 2;
          reasons.concerns.push(`Zip codes are ${Math.round(zipDist)} miles apart`);
        }
      } else {
        fallbackSameCity();
      }
    } else {
      fallbackSameCity();
    }
  }

  // ========================================
  // 2. BUDGET (12 points) - Financial Reality
  // ========================================
  if (userProfile.budget && roommateProfile.budget) {
    const userBudget = userProfile.budget;
    const roommateBudget = roommateProfile.budget;
    const percentDiff = Math.abs(userBudget - roommateBudget) / Math.max(userBudget, roommateBudget);
    
    if (percentDiff <= 0.10) {
      breakdown.budget = 12;
      reasons.strengths.push(`Nearly identical budgets ($${userBudget} vs $${roommateBudget})`);
    } else if (percentDiff <= 0.25) {
      breakdown.budget = 8;
      reasons.notes.push(`Similar budgets ($${userBudget} vs $${roommateBudget})`);
    } else if (percentDiff <= 0.50) {
      breakdown.budget = 4;
      reasons.concerns.push(`Budget gap may limit housing options`);
    } else {
      breakdown.budget = 1;
      reasons.concerns.push(`Significant budget mismatch ($${userBudget} vs $${roommateBudget})`);
    }
  } else {
    breakdown.budget = 6;
  }

  // ========================================
  // 3. SLEEP SCHEDULE (12 points) - #1 Conflict Factor
  // ========================================
  if (userPrefs.sleepSchedule) {
    const userSleep = userPrefs.sleepSchedule;
    const roommateSleep = inferSleepSchedule(roommateProfile);
    
    if (userSleep === roommateSleep) {
      breakdown.sleepSchedule = 12;
      reasons.strengths.push(`Matching sleep schedules (${formatSleepSchedule(userSleep)})`);
    } else if (userSleep === 'flexible' || roommateSleep === 'flexible') {
      breakdown.sleepSchedule = 8;
      reasons.notes.push(`One person has flexible sleep schedule`);
    } else if (userSleep === 'irregular' || roommateSleep === 'irregular') {
      breakdown.sleepSchedule = 5;
      reasons.notes.push(`Irregular sleep patterns may require adjustment`);
    } else {
      breakdown.sleepSchedule = 0;
      reasons.concerns.push(`Conflicting sleep schedules (${formatSleepSchedule(userSleep)} vs ${formatSleepSchedule(roommateSleep)})`);
    }
  } else {
    breakdown.sleepSchedule = 6;
  }

  // ========================================
  // 4. CLEANLINESS (12 points) - 40% of Issues
  // ========================================
  if (userPrefs.cleanliness) {
    const userLevel = cleanlinessToNumber(userPrefs.cleanliness);
    const roommateLevel = roommateProfile.lifestyle?.cleanliness || 5;
    const difference = Math.abs(userLevel - roommateLevel);
    
    if (difference === 0) {
      breakdown.cleanliness = 12;
      reasons.strengths.push(`Perfect cleanliness alignment (${userPrefs.cleanliness})`);
    } else if (difference <= 2) {
      breakdown.cleanliness = 8;
      reasons.notes.push(`Similar cleanliness standards`);
    } else if (difference <= 4) {
      breakdown.cleanliness = 4;
      reasons.concerns.push(`Cleanliness standards differ moderately`);
    } else {
      breakdown.cleanliness = 0;
      reasons.concerns.push(`Major cleanliness mismatch`);
    }
  } else {
    breakdown.cleanliness = 6;
  }

  // ========================================
  // 5. SMOKING/SUBSTANCES (10 points) - Deal-Breaker
  // ========================================
  if (userPrefs.smoking) {
    const userSmokes = userPrefs.smoking;
    const roommateSmokes = roommateProfile.lifestyle?.smoking || false;
    
    if (userSmokes === 'no' && !roommateSmokes) {
      breakdown.smoking = 10;
      reasons.strengths.push(`Both non-smokers`);
    } else if (userSmokes === 'only_outside' && !roommateSmokes) {
      breakdown.smoking = 9;
      reasons.strengths.push(`Compatible smoking preferences`);
    } else if (userSmokes === 'only_outside' && roommateSmokes) {
      breakdown.smoking = 6;
      reasons.notes.push(`Outdoor smoking compromise possible`);
    } else if (userSmokes === 'yes' && roommateSmokes) {
      breakdown.smoking = 10;
      reasons.strengths.push(`Both comfortable with smoking`);
    } else {
      breakdown.smoking = 0;
      reasons.concerns.push(`Smoking preferences incompatible`);
    }
  } else {
    breakdown.smoking = 5;
  }

  // ========================================
  // 6. MOVE-IN TIMELINE (4 points) - Scheduling Alignment
  // ========================================
  const userMoveIn = userPrefs.moveInDate;
  const roommateMoveIn = roommateProfile.preferences?.moveInDate;
  if (userMoveIn && roommateMoveIn) {
    const userDate = parseMoveInDate(userMoveIn);
    const roommateDate = parseMoveInDate(roommateMoveIn);
    if (userDate && roommateDate) {
      const daysDiff = Math.abs(Math.round((userDate.getTime() - roommateDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysDiff <= 14) {
        breakdown.moveInTimeline = 4;
        reasons.strengths.push(`Move-in dates within 2 weeks of each other`);
      } else if (daysDiff <= 30) {
        breakdown.moveInTimeline = 3;
        reasons.strengths.push(`Move-in dates within a month`);
      } else if (daysDiff <= 60) {
        breakdown.moveInTimeline = 2;
        reasons.notes.push(`Move-in dates about ${Math.round(daysDiff / 30)} months apart`);
      } else if (daysDiff <= 90) {
        breakdown.moveInTimeline = 1;
        reasons.concerns.push(`Move-in dates are ${Math.round(daysDiff / 30)} months apart`);
      } else {
        breakdown.moveInTimeline = 0;
        reasons.concerns.push(`Move-in timelines don't align (${Math.round(daysDiff / 30)}+ months apart)`);
      }
    } else {
      breakdown.moveInTimeline = 2;
    }
  } else {
    breakdown.moveInTimeline = 2;
  }

  // ========================================
  // 7. WORK LOCATION (6 points) - Home/Office Balance
  // ========================================
  if (userPrefs.workLocation) {
    const userWork = userPrefs.workLocation;
    const roommateWork = inferWorkLocation(roommateProfile);
    
    if (userWork === roommateWork) {
      breakdown.workLocation = 6;
      reasons.strengths.push(`Same work arrangement (${formatWorkLocation(userWork)})`);
    } else if (userWork === 'hybrid' || roommateWork === 'hybrid') {
      breakdown.workLocation = 4;
      reasons.notes.push(`Hybrid work provides flexibility`);
    } else if (
      (userWork === 'wfh_fulltime' && roommateWork === 'office_fulltime') ||
      (userWork === 'office_fulltime' && roommateWork === 'wfh_fulltime')
    ) {
      breakdown.workLocation = 3;
      reasons.notes.push(`Different work locations - gives personal space during day`);
    } else {
      breakdown.workLocation = 2;
    }
  } else {
    breakdown.workLocation = 3;
  }

  // ========================================
  // 8. GUEST POLICY (6 points) - Social Behavior
  // ========================================
  if (userPrefs.guestPolicy) {
    const userGuests = userPrefs.guestPolicy;
    const roommateGuests = inferGuestPolicy(roommateProfile);
    
    if (userGuests === roommateGuests) {
      breakdown.guestPolicy = 6;
      reasons.strengths.push(`Matching guest preferences (${formatGuestPolicy(userGuests)})`);
    } else if (userGuests === 'prefer_no_guests' || roommateGuests === 'prefer_no_guests') {
      breakdown.guestPolicy = 0;
      reasons.concerns.push(`Guest policy strongly differs`);
    } else if (isAdjacentGuestPolicy(userGuests, roommateGuests)) {
      breakdown.guestPolicy = 4;
      reasons.notes.push(`Guest frequency tolerance may work`);
    } else {
      breakdown.guestPolicy = 1;
      reasons.concerns.push(`Guest policy mismatch`);
    }
  } else {
    breakdown.guestPolicy = 3;
  }

  // ========================================
  // 9. NOISE TOLERANCE (4 points) - Daily Comfort
  // ========================================
  if (userPrefs.noiseTolerance) {
    const userNoise = userPrefs.noiseTolerance;
    const roommateNoise = inferNoiseTolerance(roommateProfile);
    
    if (userNoise === roommateNoise) {
      breakdown.noiseTolerance = 4;
      reasons.strengths.push(`Same noise tolerance level`);
    } else if (userNoise === 'normal_noise' || roommateNoise === 'normal_noise') {
      breakdown.noiseTolerance = 3;
      reasons.notes.push(`Moderate noise tolerance may work`);
    } else {
      breakdown.noiseTolerance = 1;
      reasons.concerns.push(`Noise tolerance mismatch`);
    }
  } else {
    breakdown.noiseTolerance = 2;
  }

  // ========================================
  // 10. PETS (4 points) - Allergies & Preferences
  // ========================================
  if (userPrefs.pets) {
    const userPets = userPrefs.pets;
    const roommatePets = roommateProfile.lifestyle?.pets || false;
    
    if (userPets === 'have_pets' && roommatePets) {
      breakdown.pets = 4;
      reasons.strengths.push(`Both have pets - pet-friendly match`);
    } else if (userPets === 'open_to_pets') {
      breakdown.pets = 4;
      reasons.notes.push(`Open to pets - flexible on this`);
    } else if (userPets === 'no_pets' && !roommatePets) {
      breakdown.pets = 4;
      reasons.strengths.push(`Both prefer pet-free living`);
    } else if (userPets === 'no_pets' && roommatePets) {
      breakdown.pets = 0;
      reasons.concerns.push(`Pet incompatibility - they have pets`);
    } else {
      breakdown.pets = 2;
    }
  } else {
    breakdown.pets = 2;
  }

  // ========================================
  // 11. ROOMMATE RELATIONSHIP (2 points) - Social Expectations
  // ========================================
  if (userPrefs.roommateRelationship) {
    const userRel = userPrefs.roommateRelationship;
    const roommateRel = inferRelationshipPreference(roommateProfile);
    
    if (userRel === roommateRel) {
      breakdown.roommateRelationship = 2;
      reasons.strengths.push(`Matching social expectations`);
    } else if (userRel === 'respectful_coliving' || roommateRel === 'respectful_coliving') {
      breakdown.roommateRelationship = 1;
      reasons.notes.push(`Respectful coexistence baseline met`);
    } else if (
      (userRel === 'minimal_interaction' && roommateRel === 'prefer_friends') ||
      (userRel === 'prefer_friends' && roommateRel === 'minimal_interaction')
    ) {
      breakdown.roommateRelationship = 0;
      reasons.concerns.push(`Different social expectations`);
    } else {
      breakdown.roommateRelationship = 1;
    }
  } else {
    breakdown.roommateRelationship = 1;
  }

  // ========================================
  // 12. SHARED EXPENSES (2 points) - Financial Friction Prevention
  // ========================================
  if (userPrefs.sharedExpenses) {
    const userExp = userPrefs.sharedExpenses;
    const roommateExp = roommateProfile.preferences?.sharedExpenses;
    if (roommateExp) {
      let matches = 0;
      let total = 0;
      const categories: Array<keyof typeof userExp> = ['utilities', 'groceries', 'internet', 'cleaning'];
      for (const cat of categories) {
        if (userExp[cat] && roommateExp[cat]) {
          total++;
          if (userExp[cat] === roommateExp[cat]) matches++;
        }
      }
      if (total > 0) {
        const ratio = matches / total;
        if (ratio >= 0.75) {
          breakdown.sharedExpenses = 2;
          reasons.strengths.push(`Aligned on shared expense expectations`);
        } else if (ratio >= 0.5) {
          breakdown.sharedExpenses = 1;
          reasons.notes.push(`Mostly aligned on shared expenses`);
        } else {
          breakdown.sharedExpenses = 0;
          reasons.concerns.push(`Different expectations for splitting household costs`);
        }
      } else {
        breakdown.sharedExpenses = 1;
      }
    } else {
      breakdown.sharedExpenses = 1;
    }
  } else {
    breakdown.sharedExpenses = 1;
  }

  // ========================================
  // 13. INTEREST TAGS (2 points) - Tag-based compatibility
  // Uses new interest tag system with overlap scoring and conflict penalties
  // ========================================
  const userInterests: string[] = Array.isArray(currentUser.profileData?.interests) ? currentUser.profileData.interests : [];
  const roommateInterests: string[] = Array.isArray(roommateProfile.profileData?.interests) ? roommateProfile.profileData.interests : [];

  if (userInterests.length > 0 && roommateInterests.length > 0) {
    const userSet = new Set(userInterests);
    const overlap = roommateInterests.filter(tag => userSet.has(tag));
    const maxPossible = Math.min(userInterests.length, roommateInterests.length);
    const interestScore = maxPossible > 0 ? (overlap.length / maxPossible) * 2 : 0;
    breakdown.lifestyle = Math.round(interestScore * 10) / 10;

    if (overlap.length >= 3) {
      reasons.strengths.push(`${overlap.length} shared interests`);
    } else if (overlap.length > 0) {
      reasons.notes.push(`${overlap.length} shared interest${overlap.length > 1 ? 's' : ''}`);
    } else {
      reasons.notes.push('No shared interest tags');
    }

    const CONFLICTING_PAIRS = [
      ['smoker', 'non_smoker'],
      ['pet_friendly', 'no_pets_tag'],
      ['early_bird', 'night_owl'],
      ['host_gatherings', 'rarely_guests'],
    ];

    CONFLICTING_PAIRS.forEach(([tag1, tag2]) => {
      const u1Has1 = userInterests.includes(tag1);
      const u1Has2 = userInterests.includes(tag2);
      const u2Has1 = roommateInterests.includes(tag1);
      const u2Has2 = roommateInterests.includes(tag2);
      if ((u1Has1 && u2Has2) || (u1Has2 && u2Has1)) {
        breakdown.lifestyle = Math.max(0, breakdown.lifestyle - 1);
        reasons.concerns.push(`Conflicting preferences detected`);
      }
    });
  } else {
    breakdown.lifestyle = 1;
  }

  // ========================================
  // 14. ZODIAC SIGN (2 points max) - Fun Factor, Very Light Weight
  // Only applies if BOTH users have zodiac signs selected
  // Replaces previous occupation scoring (removed)
  // ========================================
  if (currentUser.zodiacSign && roommateProfile.zodiacSign) {
    const zodiacScore = getZodiacCompatibilityScore(currentUser.zodiacSign, roommateProfile.zodiacSign);
    breakdown.zodiac = zodiacScore;
    // Note: No reason added - this is a fun factor, not a deal-breaker
  } else {
    breakdown.zodiac = 0;
  }

  // ========================================
  // 15. PERSONALITY COMPATIBILITY (15% weighting, ~15 points max)
  // Uses 5-question compatibility quiz answers
  // ========================================
  const personalityRaw = calculatePersonalityScore(
    currentUser.profileData?.personalityAnswers,
    roommateProfile.personalityAnswers as Record<string, string> | undefined
  );
  breakdown.personality = Math.round(personalityRaw * 0.15 * 10) / 10;
  if (personalityRaw >= 80) {
    reasons.strengths.push('Very compatible personality and living style');
  } else if (personalityRaw <= 30) {
    reasons.concerns.push('Different personality preferences and living style');
  }

  // ========================================
  // 16. PI PARSED PREFERENCE BONUS (up to +5 / -10)
  // Applies if either user has pi_parsed_preferences from free-text input
  // Uses keyword matching — no AI calls at scoring time
  // ========================================
  const userPiPrefs: PiParsedPreferences | undefined =
    currentUser.pi_parsed_preferences || currentUser.profileData?.pi_parsed_preferences;
  const roommatePiPrefs: PiParsedPreferences | undefined =
    roommateProfile.pi_parsed_preferences || roommateProfile.profileData?.pi_parsed_preferences;

  if (userPiPrefs || roommatePiPrefs) {
    if (userPiPrefs && checkHardNoConflicts(userPiPrefs, roommateProfile)) {
      breakdown.piPreference = -10;
      reasons.concerns.push('Conflicts with a stated deal-breaker preference');
    } else if (roommatePiPrefs && checkHardNoConflicts(roommatePiPrefs, roommateProfileToCheckable(currentUser))) {
      breakdown.piPreference = -10;
      reasons.concerns.push('Conflicts with their stated deal-breaker preference');
    } else {
      let piBonus = 0;
      if (userPiPrefs && roommatePiPrefs) {
        if (vibeAligns(userPiPrefs, roommatePiPrefs)) {
          piBonus += 2;
          reasons.strengths.push('Similar vibe and energy');
        }
        if (socialStyleAligns(userPiPrefs, roommatePiPrefs)) {
          piBonus += 2;
          reasons.strengths.push('Compatible social styles');
        }
        piBonus += countSoftPreferenceOverlap(userPiPrefs, roommatePiPrefs);
      } else {
        const prefs = userPiPrefs || roommatePiPrefs!;
        const other = userPiPrefs ? roommateProfile : currentUser;
        if (prefs.vibe && matchesProfileVibe(prefs.vibe, other)) {
          piBonus += 1;
        }
        if (prefs.social_style && matchesProfileSocialStyle(prefs.social_style, other)) {
          piBonus += 1;
        }
      }
      breakdown.piPreference = Math.min(piBonus, 5);
    }
  }

  const rawTotal = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
  let totalScore: number;
  if (breakdown.piPreference !== 0) {
    const PI_MIN = -10;
    const PI_MAX = 5;
    const effectiveMin = 0 + PI_MIN;
    const effectiveMax = 100 + PI_MAX;
    const normalized = ((rawTotal - effectiveMin) / (effectiveMax - effectiveMin)) * 100;
    totalScore = Math.round(Math.max(0, Math.min(100, normalized)));
  } else {
    totalScore = Math.max(0, Math.min(100, rawTotal));
  }

  return {
    totalScore,
    breakdown,
    reasons,
  };
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Parse a move-in date string (supports MM/DD/YYYY and YYYY-MM-DD)
 */
const parseMoveInDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (dateStr.includes('-')) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

/**
 * Infer sleep schedule from roommate profile
 */
const inferSleepSchedule = (profile: RoommateProfile): 'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular' => {
  const schedule = profile.lifestyle?.workSchedule?.toLowerCase() || '';
  if (schedule.includes('9-5') || schedule.includes('early') || schedule.includes('morning')) return 'early_sleeper';
  if (schedule.includes('night') || schedule.includes('late') || schedule.includes('evening')) return 'late_sleeper';
  if (schedule.includes('shift') || schedule.includes('irregular')) return 'irregular';
  return 'flexible';
};

/**
 * Infer work location from roommate profile
 */
const inferWorkLocation = (profile: RoommateProfile): 'wfh_fulltime' | 'hybrid' | 'office_fulltime' | 'irregular' => {
  const schedule = profile.lifestyle?.workSchedule?.toLowerCase() || '';
  if (schedule.includes('remote') || schedule.includes('home')) return 'wfh_fulltime';
  if (schedule.includes('hybrid') || schedule.includes('flex')) return 'hybrid';
  if (schedule.includes('office') || schedule.includes('9-5')) return 'office_fulltime';
  return 'irregular';
};

/**
 * Infer guest policy from social level
 */
const inferGuestPolicy = (profile: RoommateProfile): 'frequently' | 'occasionally' | 'rarely' | 'prefer_no_guests' => {
  const socialLevel = profile.lifestyle?.socialLevel || 5;
  if (socialLevel >= 9) return 'frequently';
  if (socialLevel >= 5) return 'occasionally';
  if (socialLevel >= 2) return 'rarely';
  return 'prefer_no_guests';
};

/**
 * Infer noise tolerance from social level
 */
const inferNoiseTolerance = (profile: RoommateProfile): 'prefer_quiet' | 'normal_noise' | 'loud_environments' => {
  const socialLevel = profile.lifestyle?.socialLevel || 5;
  if (socialLevel >= 8) return 'loud_environments';
  if (socialLevel >= 4) return 'normal_noise';
  return 'prefer_quiet';
};

/**
 * Infer relationship preference from social level
 */
const inferRelationshipPreference = (profile: RoommateProfile): 'respectful_coliving' | 'occasional_hangouts' | 'prefer_friends' | 'minimal_interaction' => {
  const socialLevel = profile.lifestyle?.socialLevel || 5;
  if (socialLevel >= 9) return 'prefer_friends';
  if (socialLevel >= 6) return 'occasional_hangouts';
  if (socialLevel >= 3) return 'respectful_coliving';
  return 'minimal_interaction';
};

/**
 * Infer lifestyle tags from occupation and social level
 */
const inferLifestyleTags = (profile: RoommateProfile): Array<'active_gym' | 'homebody' | 'nightlife_social' | 'quiet_introverted' | 'creative_artistic' | 'professional_focused'> => {
  const tags: Array<'active_gym' | 'homebody' | 'nightlife_social' | 'quiet_introverted' | 'creative_artistic' | 'professional_focused'> = [];
  const occ = profile.occupation?.toLowerCase() || '';
  const social = profile.lifestyle?.socialLevel || 5;
  
  if (occ.includes('design') || occ.includes('artist') || occ.includes('creative')) tags.push('creative_artistic');
  if (occ.includes('engineer') || occ.includes('analyst') || occ.includes('manager')) tags.push('professional_focused');
  if (social >= 8) tags.push('nightlife_social');
  if (social <= 3) tags.push('quiet_introverted');
  if (occ.includes('remote') || social <= 4) tags.push('homebody');
  
  return tags;
};

/**
 * Check if two guest policies are adjacent/compatible
 */
const isAdjacentGuestPolicy = (
  policy1: 'rarely' | 'occasionally' | 'frequently' | 'prefer_no_guests',
  policy2: 'rarely' | 'occasionally' | 'frequently' | 'prefer_no_guests'
): boolean => {
  const order = ['prefer_no_guests', 'rarely', 'occasionally', 'frequently'];
  const idx1 = order.indexOf(policy1);
  const idx2 = order.indexOf(policy2);
  return Math.abs(idx1 - idx2) === 1;
};

/**
 * Format sleep schedule for display
 */
const formatSleepSchedule = (schedule: string): string => {
  const map: Record<string, string> = {
    early_sleeper: 'Early Sleeper',
    late_sleeper: 'Late Sleeper',
    flexible: 'Flexible',
    irregular: 'Irregular',
  };
  return map[schedule] || schedule;
};

/**
 * Format work location for display
 */
const formatWorkLocation = (location: string): string => {
  const map: Record<string, string> = {
    wfh_fulltime: 'Remote',
    hybrid: 'Hybrid',
    office_fulltime: 'Office',
    irregular: 'Irregular',
  };
  return map[location] || location;
};

/**
 * Format guest policy for display
 */
const formatGuestPolicy = (policy: string): string => {
  const map: Record<string, string> = {
    frequently: 'Frequent Guests',
    occasionally: 'Occasional Guests',
    rarely: 'Rare Guests',
    prefer_no_guests: 'No Guests',
  };
  return map[policy] || policy;
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

/**
 * Convert numeric cleanliness value to descriptive text
 * Scale: 1-5 where 5 = Very Clean, 1 = Very Relaxed
 */
export const getCleanlinessLabel = (value: number): string => {
  if (value >= 4.5) return 'Very Clean';
  if (value >= 3.5) return 'Clean';
  if (value >= 2.5) return 'Moderate';
  if (value >= 1.5) return 'Relaxed';
  return 'Very Relaxed';
};

/**
 * Convert numeric social level value to descriptive text
 * Scale: 1-5 where 5 = Very Social, 1 = Very Quiet
 */
export const getSocialLevelLabel = (value: number): string => {
  if (value >= 4.5) return 'Very Social';
  if (value >= 3.5) return 'Social';
  if (value >= 2.5) return 'Moderate';
  if (value >= 1.5) return 'Quiet';
  return 'Very Quiet';
};

/**
 * Format work schedule for display
 */
export const getWorkScheduleLabel = (schedule?: string | null): string => {
  if (!schedule) return 'Not specified';
  const map: Record<string, string> = {
    'wfh': 'Work from Home',
    'wfh_fulltime': 'Remote',
    'office': 'Office',
    'office_fulltime': 'Office',
    'hybrid': 'Hybrid',
    'irregular': 'Irregular',
    'night_shift': 'Night Shift',
    'flexible': 'Flexible',
    'remote': 'Remote',
    'shifts': 'Shifts',
    'freelance': 'Freelance',
    'student': 'Student',
  };
  return map[schedule.toLowerCase()] || schedule;
};

export function getWorkStyleTag(workLocation?: string): string | null {
  if (!workLocation) return null;
  const map: Record<string, string> = {
    wfh_fulltime: 'Remote',
    hybrid: 'Hybrid',
    office_fulltime: 'Office',
    irregular: 'Flexible',
  };
  return map[workLocation] ?? null;
}

export const validateProfileDataConsistency = (profile: { id: string; name?: string; bio?: string; profileData?: { preferences?: { workLocation?: string } } }) => {
  const workStyle = profile.profileData?.preferences?.workLocation;
  const bio = profile.bio?.toLowerCase() || '';
  if (!workStyle || !bio) return;

  const tag = getWorkStyleTag(workStyle);
  if (tag === 'Remote' && (bio.includes('office') && !bio.includes('home office'))) {
    console.warn(`PROFILE DATA CONFLICT: workStyle tag contradicts bio text for user ${profile.id} (${profile.name || 'unknown'}). Tag: Remote, bio mentions "office".`);
  }
  if (tag === 'Office' && (bio.includes('work from home') || bio.includes('remote') || bio.includes('wfh'))) {
    console.warn(`PROFILE DATA CONFLICT: workStyle tag contradicts bio text for user ${profile.id} (${profile.name || 'unknown'}). Tag: Office, bio mentions remote/WFH.`);
  }
};

/**
 * Format move-in date for display
 */
export const formatMoveInDate = (dateString: string): string => {
  if (!dateString) return 'Flexible';
  
  let date: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(dateString);
  }

  if (isNaN(date.getTime())) return 'Flexible';

  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'ASAP';
  if (diffDays <= 7) return 'This Week';
  if (diffDays <= 14) return 'Next Week';
  if (diffDays <= 30) return 'This Month';
  
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

/**
 * Convert string cleanliness preference to numeric value (1-10 scale)
 * Used to normalize User.profileData preferences for matching algorithm
 */
export const cleanlinessToNumber = (cleanliness: 'very_tidy' | 'moderately_tidy' | 'relaxed' | undefined): number => {
  const map: Record<string, number> = {
    very_tidy: 9,
    moderately_tidy: 6,
    relaxed: 3,
  };
  return cleanliness ? map[cleanliness] : 5;
};

/**
 * Convert numeric cleanliness value to string preference
 */
export const numberToCleanliness = (value: number): 'very_tidy' | 'moderately_tidy' | 'relaxed' => {
  if (value >= 7) return 'very_tidy';
  if (value >= 4) return 'moderately_tidy';
  return 'relaxed';
};

/**
 * Get gender symbol for display
 * Returns unicode symbols: ♂ (male), ♀ (female), ⚧ (non-binary/other)
 */
export const getGenderSymbol = (gender: 'male' | 'female' | 'other' | undefined): string => {
  if (!gender) return '';
  const symbols: Record<string, string> = {
    male: '♂',
    female: '♀',
    other: '⚧',
  };
  return symbols[gender] || '';
};

const VIBE_CLUSTERS: Record<string, string[]> = {
  chill: ['chill', 'relaxed', 'easygoing', 'laid-back', 'calm', 'mellow', 'low-key', 'casual'],
  social: ['social', 'outgoing', 'extroverted', 'lively', 'fun', 'energetic', 'party', 'adventurous'],
  quiet: ['quiet', 'introverted', 'reserved', 'private', 'solitary', 'homebody', 'peaceful'],
  focused: ['focused', 'studious', 'professional', 'driven', 'organized', 'motivated', 'ambitious'],
  creative: ['creative', 'artistic', 'musical', 'bohemian', 'expressive', 'free-spirited'],
};

const SOCIAL_CLUSTERS: Record<string, string[]> = {
  independent: ['independent', 'solo', 'alone', 'space', 'privacy', 'introvert', 'minimal'],
  balanced: ['balanced', 'friendly', 'occasional', 'sometimes', 'moderate', 'flexible'],
  social: ['social', 'together', 'hangout', 'friends', 'group', 'communal', 'extrovert'],
};

function getCluster(value: string, clusters: Record<string, string[]>): string | null {
  const lower = value.toLowerCase();
  for (const [cluster, keywords] of Object.entries(clusters)) {
    if (keywords.some(k => lower.includes(k))) return cluster;
  }
  return null;
}

interface HardNoCheckable {
  profileData?: {
    preferences?: Record<string, string | undefined>;
    interests?: string[];
  };
  lifestyle?: Record<string, string | number | boolean | undefined>;
  occupation?: string;
}

function roommateProfileToCheckable(user: User): HardNoCheckable {
  return {
    profileData: {
      preferences: user.profileData?.preferences as Record<string, string | undefined> | undefined,
      interests: user.profileData?.interests,
    },
    lifestyle: undefined,
    occupation: (user as User & { occupation?: string }).occupation,
  };
}

export function checkHardNoConflicts(prefs: PiParsedPreferences, profile: HardNoCheckable): boolean {
  if (!prefs.hard_nos || prefs.hard_nos.length === 0) return false;

  const profileText = [
    profile.profileData?.preferences?.smoking,
    profile.profileData?.preferences?.pets,
    profile.profileData?.preferences?.guestPolicy,
    profile.profileData?.preferences?.noiseTolerance,
    profile.profileData?.preferences?.sleepSchedule,
    profile.profileData?.preferences?.workLocation,
    profile.lifestyle?.smoking,
    profile.lifestyle?.pets,
    profile.occupation,
    ...(profile.profileData?.interests || []),
  ].filter(Boolean).join(' ').toLowerCase();

  for (const hardNo of prefs.hard_nos) {
    const noLower = hardNo.toLowerCase();
    if (noLower.includes('smok') && (profileText.includes('yes') && profileText.includes('smok') || profileText.includes('smoker'))) return true;
    if (noLower.includes('pet') && profileText.includes('have_pets')) return true;
    if (noLower.includes('party') && (profileText.includes('frequently') || profileText.includes('nightlife'))) return true;
    if (noLower.includes('loud') && profileText.includes('loud_environments')) return true;
    if (noLower.includes('messy') && profileText.includes('relaxed')) return true;
    if (noLower.includes('early') && profileText.includes('early_sleeper')) return true;
    if (noLower.includes('late') && profileText.includes('late_sleeper')) return true;
    if (noLower.includes('drug') && profileText.includes('drug')) return true;
  }
  return false;
}

export function vibeAligns(prefs1: PiParsedPreferences, prefs2: PiParsedPreferences): boolean {
  if (!prefs1.vibe || !prefs2.vibe) return false;
  const cluster1 = getCluster(prefs1.vibe, VIBE_CLUSTERS);
  const cluster2 = getCluster(prefs2.vibe, VIBE_CLUSTERS);
  if (!cluster1 || !cluster2) return false;
  return cluster1 === cluster2;
}

export function socialStyleAligns(prefs1: PiParsedPreferences, prefs2: PiParsedPreferences): boolean {
  if (!prefs1.social_style || !prefs2.social_style) return false;
  const cluster1 = getCluster(prefs1.social_style, SOCIAL_CLUSTERS);
  const cluster2 = getCluster(prefs2.social_style, SOCIAL_CLUSTERS);
  if (!cluster1 || !cluster2) return false;
  return cluster1 === cluster2;
}

export function countSoftPreferenceOverlap(prefs1: PiParsedPreferences, prefs2: PiParsedPreferences): number {
  if (!prefs1.soft_preferences?.length || !prefs2.soft_preferences?.length) return 0;
  const set1 = new Set(prefs1.soft_preferences.map(s => s.toLowerCase()));
  const set2 = new Set(prefs2.soft_preferences.map(s => s.toLowerCase()));
  let overlap = 0;
  for (const item of set1) {
    for (const item2 of set2) {
      if (item === item2 || item.includes(item2) || item2.includes(item)) {
        overlap++;
        break;
      }
    }
  }
  return overlap >= 1 ? 1 : 0;
}

export interface GroupCompatibilityResult {
  averagePairwiseScore: number;
  minPairwiseScore: number;
  genderCompliant: boolean;
  neighborhoodOverlapBonus: number;
  budgetAligned: boolean;
  moveInAligned: boolean;
  dealbreakerConflicts: string[];
  memberScores: Array<{ userId1: string; userId2: string; score: number }>;
  passesMinPairwiseThreshold: boolean;
}

function getMemberName(m: User | RoommateProfile): string {
  const user = m as User;
  const profile = m as RoommateProfile;
  return user.name || profile.name || m.id;
}

function getMemberGender(m: User | RoommateProfile): string | undefined {
  const user = m as User;
  const profile = m as RoommateProfile;
  return user.profileData?.gender || profile.profileData?.gender || profile.gender;
}

function getMemberGenderPreference(m: User | RoommateProfile): string | undefined {
  const user = m as User;
  const profile = m as RoommateProfile;
  return user.household_gender_preference ||
    user.profileData?.household_gender_preference ||
    profile.household_gender_preference ||
    profile.profileData?.household_gender_preference;
}

function getMemberBudget(m: User | RoommateProfile): number | undefined {
  const user = m as User;
  const profile = m as RoommateProfile;
  return user.profileData?.budget || profile.budget;
}

function getMemberMoveInDate(m: User | RoommateProfile): string | undefined {
  const user = m as User;
  const profile = m as RoommateProfile;
  return user.profileData?.preferences?.moveInDate || profile.preferences?.moveInDate;
}

function getMemberNeighborhoods(m: User | RoommateProfile): Set<string> {
  const user = m as User;
  const profile = m as RoommateProfile;
  return new Set<string>([
    ...(user.profileData?.preferred_neighborhoods || []),
    ...(profile.profileData?.preferred_neighborhoods || []),
    ...(user.profileData?.neighborhood ? [user.profileData.neighborhood] : []),
    ...(profile.preferredNeighborhoods || []),
  ].filter(Boolean).map((n: string) => n.toLowerCase()));
}

export function calculateGroupCompatibility(
  members: Array<User | RoommateProfile>
): GroupCompatibilityResult {
  const pairScores: Array<{ userId1: string; userId2: string; score: number }> = [];
  const dealbreakerConflicts: string[] = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const scoreAB = calculateDetailedCompatibility(a as User, b as RoommateProfile);
      const scoreBA = calculateDetailedCompatibility(b as User, a as RoommateProfile);
      const pairScore = Math.min(scoreAB.totalScore, scoreBA.totalScore);
      pairScores.push({ userId1: a.id, userId2: b.id, score: pairScore });

      if (pairScore === 0) {
        const concerns = [...scoreAB.reasons.concerns, ...scoreBA.reasons.concerns];
        dealbreakerConflicts.push(
          `${getMemberName(a)} & ${getMemberName(b)}: ${concerns[0] || 'dealbreaker conflict'}`
        );
      }
    }
  }

  const scores = pairScores.map(p => p.score);
  const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  const min = scores.length > 0 ? Math.min(...scores) : 0;

  return {
    averagePairwiseScore: Math.round(avg),
    minPairwiseScore: Math.round(min),
    genderCompliant: checkGenderCompliance(members),
    neighborhoodOverlapBonus: calculateNeighborhoodOverlap(members),
    budgetAligned: checkBudgetAlignment(members),
    moveInAligned: checkMoveInAlignment(members),
    dealbreakerConflicts,
    memberScores: pairScores,
    passesMinPairwiseThreshold: min > 50,
  };
}

export function checkGenderCompliance(
  members: Array<User | RoommateProfile>
): boolean {
  for (const member of members) {
    const pref = getMemberGenderPreference(member);
    if (!pref || pref === 'any') continue;

    const memberGender = getMemberGender(member);
    if (!memberGender) continue;

    for (const other of members) {
      if (other.id === member.id) continue;
      const otherGender = getMemberGender(other);
      if (!otherGender) continue;

      if (pref === 'male_only' && otherGender !== 'male') return false;
      if (pref === 'female_only' && otherGender !== 'female') return false;
      if (pref === 'same_gender' && otherGender !== memberGender) return false;
    }
  }
  return true;
}

export function checkGroupDealbreakers(
  members: Array<User | RoommateProfile>
): string[] {
  const conflicts: string[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const scoreAB = calculateDetailedCompatibility(a as User, b as RoommateProfile);
      const scoreBA = calculateDetailedCompatibility(b as User, a as RoommateProfile);
      if (scoreAB.totalScore === 0 || scoreBA.totalScore === 0) {
        conflicts.push(
          `${getMemberName(a)} & ${getMemberName(b)}: dealbreaker conflict`
        );
      }
    }
  }
  return conflicts;
}

export function calculateNeighborhoodOverlap(
  members: Array<User | RoommateProfile>
): number {
  const memberNeighborhoods = members.map(m => getMemberNeighborhoods(m));

  if (memberNeighborhoods.some(s => s.size === 0)) return 0;

  let commonCount = 0;
  const first = memberNeighborhoods[0];
  for (const hood of first) {
    if (memberNeighborhoods.every(s => s.has(hood))) commonCount++;
  }

  return commonCount >= 2 ? 10 : commonCount === 1 ? 5 : 0;
}

export function checkBudgetAlignment(
  members: Array<User | RoommateProfile>
): boolean {
  const budgets = members
    .map(m => getMemberBudget(m))
    .filter((b): b is number => typeof b === 'number' && b > 0);

  if (budgets.length < 2) return true;

  const max = Math.max(...budgets);
  const min = Math.min(...budgets);
  const spread = (max - min) / max;
  return spread <= 0.35;
}

export function checkMoveInAlignment(
  members: Array<User | RoommateProfile>
): boolean {
  const dates = members
    .map(m => {
      const dateStr = getMemberMoveInDate(m);
      return dateStr ? parseMoveInDate(dateStr) : null;
    })
    .filter((d): d is Date => d !== null);

  if (dates.length < 2) return true;

  const timestamps = dates.map(d => d.getTime());
  const maxTs = Math.max(...timestamps);
  const minTs = Math.min(...timestamps);
  const daysDiff = Math.round((maxTs - minTs) / (1000 * 60 * 60 * 24));
  return daysDiff <= 30;
}

function matchesProfileVibe(vibe: string, profile: User | RoommateProfile): boolean {
  const vibeCluster = getCluster(vibe, VIBE_CLUSTERS);
  if (!vibeCluster) return false;
  const socialLevel = (profile as RoommateProfile).lifestyle?.socialLevel ?? 5;
  if (vibeCluster === 'social' && socialLevel >= 7) return true;
  if (vibeCluster === 'quiet' && socialLevel <= 4) return true;
  if (vibeCluster === 'chill' && socialLevel >= 3 && socialLevel <= 7) return true;
  return false;
}

function matchesProfileSocialStyle(style: string, profile: User | RoommateProfile): boolean {
  const styleCluster = getCluster(style, SOCIAL_CLUSTERS);
  if (!styleCluster) return false;
  const socialLevel = (profile as RoommateProfile).lifestyle?.socialLevel ?? 5;
  if (styleCluster === 'social' && socialLevel >= 7) return true;
  if (styleCluster === 'independent' && socialLevel <= 4) return true;
  if (styleCluster === 'balanced' && socialLevel >= 4 && socialLevel <= 7) return true;
  return false;
}
