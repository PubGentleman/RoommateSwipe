import { User, RoommateProfile } from '../types/models';
import { isNearbyNeighborhood, isSameCity } from './locationData';
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
}): string => {
  // Priority 1: Neighborhood + City
  if (location.neighborhood && location.city) {
    return `${location.neighborhood}, ${location.city}`;
  }
  
  // Priority 2: Just neighborhood (if available)
  if (location.neighborhood) {
    return location.neighborhood;
  }
  
  // Priority 3: City + State
  if (location.city && location.state) {
    return `${location.city}, ${location.state}`;
  }
  
  // Priority 4: Just city
  if (location.city) {
    return location.city;
  }
  
  // Fallback: Use address (should be avoided for privacy, but better than nothing)
  return location.address || 'Location not specified';
};

/**
 * Comprehensive points-based matching algorithm for roommate compatibility
 * 
 * Uses ALL profile data with weighted scoring (Total: 100 points):
 * 
 * HIGH PRIORITY (Deal-breakers & Critical Factors):
 * 1. Location: 16 points - Geographic compatibility (same/close neighborhoods prioritized)
 * 2. Budget: 12 points - Financial alignment (realistic matches)
 * 3. Sleep Schedule: 12 points - #1 reported conflict factor
 * 4. Cleanliness: 12 points - 40% of roommate issues
 * 5. Smoking/Substances: 10 points - Major deal-breaker
 * 6. Move-in Timeline: 6 points - Penalizes mismatched timelines (Jan vs June)
 * 
 * MEDIUM PRIORITY (Lifestyle Compatibility):
 * 7. Work Location: 8 points - WFH needs quiet, Office needs flexibility
 * 8. Guest Policy: 8 points - Social behavior alignment
 * 9. Noise Tolerance: 4 points - Daily comfort predictor
 * 10. Pets: 4 points - Prevents allergies/preferences conflicts
 * 
 * LOWER PRIORITY (Relationship & Interests):
 * 11. Roommate Relationship: 2 points - Social expectations
 * 12. Shared Expenses: 2 points - Alignment on splitting utilities, groceries, internet, cleaning
 * 13. Lifestyle Tags: 2 points - Shared interests/activities (reduced from 3 to accommodate zodiac, baseline 1 pt)
 * 14. Zodiac Sign: 2 points - Optional fun factor, element-based compatibility (only if both users have it)
 */

export interface MatchScore {
  totalScore: number;
  breakdown: {
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
export const calculateDetailedCompatibility = (
  currentUser: User,
  roommateProfile: RoommateProfile
): MatchScore => {
  const breakdown = {
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
      location: 10,
      budget: 8,
      sleepSchedule: 8,
      cleanliness: 8,
      smoking: 7,
      moveInTimeline: 3,
      workLocation: 5,
      guestPolicy: 5,
      noiseTolerance: 3,
      pets: 3,
      roommateRelationship: 1,
      sharedExpenses: 1,
      lifestyle: 1,
      zodiac: 0,
    };
    const neutralScore = Object.values(neutralBreakdown).reduce((sum, score) => sum + score, 0);
    return { totalScore: neutralScore, breakdown: neutralBreakdown, reasons };
  }

  // ========================================
  // 1. LOCATION (16 points) - MAJOR FACTOR
  // Priority: Same neighborhood > Nearby > Same city > Different city
  // ========================================
  if (userProfile.neighborhood && roommateProfile.preferences?.location) {
    const userNeighborhood = userProfile.neighborhood;
    const roommateNeighborhood = roommateProfile.preferences.location;
    
    if (userNeighborhood === roommateNeighborhood) {
      breakdown.location = 16;
      reasons.strengths.push(`Both in ${userNeighborhood} - perfect location match`);
    } else if (isNearbyNeighborhood(userNeighborhood, roommateNeighborhood)) {
      breakdown.location = 12;
      reasons.strengths.push(`${userNeighborhood} and ${roommateNeighborhood} are nearby neighborhoods`);
    } else if (isSameCity(userNeighborhood, roommateNeighborhood)) {
      breakdown.location = 8;
      reasons.notes.push(`Same city (${userProfile.city}), different neighborhoods`);
    } else {
      breakdown.location = 0;
      reasons.concerns.push(`Different cities - not compatible for local roommate matching`);
    }
  } else if (userProfile.location && roommateProfile.preferences?.location) {
    const userLocation = userProfile.location;
    const roommateLocation = roommateProfile.preferences.location;
    
    if (userLocation === roommateLocation) {
      breakdown.location = 16;
      reasons.strengths.push(`Both prefer ${userLocation} - perfect location match`);
    } else {
      breakdown.location = 8;
      reasons.notes.push(`Different preferred locations`);
    }
  } else {
    breakdown.location = 8;
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
  // 6. MOVE-IN TIMELINE (6 points) - Scheduling Alignment
  // ========================================
  const userMoveIn = userPrefs.moveInDate;
  const roommateMoveIn = roommateProfile.preferences?.moveInDate;
  if (userMoveIn && roommateMoveIn) {
    const userDate = parseMoveInDate(userMoveIn);
    const roommateDate = parseMoveInDate(roommateMoveIn);
    if (userDate && roommateDate) {
      const daysDiff = Math.abs(Math.round((userDate.getTime() - roommateDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysDiff <= 14) {
        breakdown.moveInTimeline = 6;
        reasons.strengths.push(`Move-in dates within 2 weeks of each other`);
      } else if (daysDiff <= 30) {
        breakdown.moveInTimeline = 5;
        reasons.strengths.push(`Move-in dates within a month`);
      } else if (daysDiff <= 60) {
        breakdown.moveInTimeline = 3;
        reasons.notes.push(`Move-in dates about ${Math.round(daysDiff / 30)} months apart`);
      } else if (daysDiff <= 90) {
        breakdown.moveInTimeline = 1;
        reasons.concerns.push(`Move-in dates are ${Math.round(daysDiff / 30)} months apart`);
      } else {
        breakdown.moveInTimeline = 0;
        reasons.concerns.push(`Move-in timelines don't align (${Math.round(daysDiff / 30)}+ months apart)`);
      }
    } else {
      breakdown.moveInTimeline = 3;
    }
  } else {
    breakdown.moveInTimeline = 3;
  }

  // ========================================
  // 7. WORK LOCATION (8 points) - Home/Office Balance
  // ========================================
  if (userPrefs.workLocation) {
    const userWork = userPrefs.workLocation;
    const roommateWork = inferWorkLocation(roommateProfile);
    
    if (userWork === roommateWork) {
      breakdown.workLocation = 8;
      reasons.strengths.push(`Same work arrangement (${formatWorkLocation(userWork)})`);
    } else if (userWork === 'hybrid' || roommateWork === 'hybrid') {
      breakdown.workLocation = 6;
      reasons.notes.push(`Hybrid work provides flexibility`);
    } else if (
      (userWork === 'wfh_fulltime' && roommateWork === 'office_fulltime') ||
      (userWork === 'office_fulltime' && roommateWork === 'wfh_fulltime')
    ) {
      breakdown.workLocation = 5;
      reasons.notes.push(`Different work locations - gives personal space during day`);
    } else {
      breakdown.workLocation = 4;
    }
  } else {
    breakdown.workLocation = 4;
  }

  // ========================================
  // 7. GUEST POLICY (8 points) - Social Behavior
  // ========================================
  if (userPrefs.guestPolicy) {
    const userGuests = userPrefs.guestPolicy;
    const roommateGuests = inferGuestPolicy(roommateProfile);
    
    if (userGuests === roommateGuests) {
      breakdown.guestPolicy = 8;
      reasons.strengths.push(`Matching guest preferences (${formatGuestPolicy(userGuests)})`);
    } else if (userGuests === 'prefer_no_guests' || roommateGuests === 'prefer_no_guests') {
      breakdown.guestPolicy = 0;
      reasons.concerns.push(`Guest policy strongly differs`);
    } else if (isAdjacentGuestPolicy(userGuests, roommateGuests)) {
      breakdown.guestPolicy = 5;
      reasons.notes.push(`Guest frequency tolerance may work`);
    } else {
      breakdown.guestPolicy = 2;
      reasons.concerns.push(`Guest policy mismatch`);
    }
  } else {
    breakdown.guestPolicy = 4;
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
  // 13. LIFESTYLE TAGS (2 points) - Shared Interests
  // Max reduced from 3 to 2 points to accommodate zodiac sign (2 pts)
  // Baseline maintained at 1 point for compatibility with pre-zodiac scoring
  // ========================================
  if (userPrefs.lifestyle && userPrefs.lifestyle.length > 0) {
    const userLifestyles = userPrefs.lifestyle;
    const roommateLifestyles = inferLifestyleTags(roommateProfile);
    
    const overlaps = userLifestyles.filter(tag => roommateLifestyles.includes(tag));
    
    if (overlaps.length >= 2) {
      breakdown.lifestyle = 2;
      reasons.strengths.push(`Shared interests: ${overlaps.join(', ')}`);
    } else if (overlaps.length === 1) {
      breakdown.lifestyle = 1;
      reasons.notes.push(`Some shared interests: ${overlaps.join(', ')}`);
    } else {
      breakdown.lifestyle = 1;
      reasons.notes.push(`Different lifestyle interests`);
    }
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

  // Calculate total score
  const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

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

export const getWorkStyleTag = (workSchedule?: string): string | null => {
  if (!workSchedule) return null;
  const lower = workSchedule.toLowerCase();
  if (lower.includes('remote') || lower.includes('home') || lower === 'wfh' || lower === 'wfh_fulltime') return 'Remote';
  if (lower.includes('hybrid') || lower.includes('flex') || lower === 'flexible') return 'Hybrid';
  if (lower.includes('office') || lower === 'office_fulltime') return 'Office';
  if (lower.includes('shift') || lower === 'irregular' || lower === 'night_shift') return 'Shifts';
  if (lower === 'freelance') return 'Freelance';
  if (lower === 'student') return 'Student';
  return workSchedule;
};

export const validateProfileDataConsistency = (profile: { id: string; name?: string; bio?: string; lifestyle?: { workSchedule?: string } }) => {
  const workStyle = profile.lifestyle?.workSchedule;
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
