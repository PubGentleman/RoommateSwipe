import { User, RoommateProfile } from '../types/models';

/**
 * Comprehensive points-based matching algorithm for roommate compatibility
 * 
 * Uses ALL profile data with weighted scoring (Total: 100 points):
 * 
 * HIGH PRIORITY (Deal-breakers & Critical Factors):
 * 1. Location: 18 points - Geographic compatibility (same/close neighborhoods prioritized)
 * 2. Budget: 12 points - Financial alignment (realistic matches)
 * 3. Sleep Schedule: 12 points - #1 reported conflict factor
 * 4. Cleanliness: 12 points - 40% of roommate issues
 * 5. Smoking/Substances: 10 points - Major deal-breaker
 * 
 * MEDIUM PRIORITY (Lifestyle Compatibility):
 * 6. Work Location: 8 points - WFH needs quiet, Office needs flexibility
 * 7. Guest Policy: 8 points - Social behavior alignment
 * 8. Noise Tolerance: 6 points - Daily comfort predictor
 * 9. Pets: 6 points - Prevents allergies/preferences conflicts
 * 
 * LOWER PRIORITY (Relationship & Interests):
 * 10. Roommate Relationship: 4 points - Social expectations
 * 11. Lifestyle Tags: 3 points - Shared interests/activities
 * 12. Occupation: 1 point - Minimal tie-breaker for similar fields
 */

export interface MatchScore {
  totalScore: number;
  breakdown: {
    location: number;
    budget: number;
    sleepSchedule: number;
    cleanliness: number;
    smoking: number;
    workLocation: number;
    guestPolicy: number;
    noiseTolerance: number;
    pets: number;
    roommateRelationship: number;
    lifestyle: number;
    occupation: number;
  };
  reasons: {
    strengths: string[];
    concerns: string[];
    notes: string[];
  };
}

/**
 * Neighborhood proximity mapping
 * Defines which neighborhoods are close to each other for location scoring
 */
const NEIGHBORHOOD_PROXIMITY: Record<string, { close: string[]; medium: string[]; far: string[] }> = {
  'Downtown': {
    close: ['Midtown', 'Financial District'],
    medium: ['Westside', 'Eastside', 'Uptown'],
    far: ['Suburbs', 'North End', 'South End'],
  },
  'Midtown': {
    close: ['Downtown', 'Uptown'],
    medium: ['Westside', 'Eastside', 'Financial District'],
    far: ['Suburbs', 'North End', 'South End'],
  },
  'Westside': {
    close: ['Eastside', 'Downtown'],
    medium: ['Midtown', 'Uptown'],
    far: ['Suburbs', 'North End', 'South End', 'Financial District'],
  },
  'Eastside': {
    close: ['Westside', 'Downtown'],
    medium: ['Midtown', 'Uptown'],
    far: ['Suburbs', 'North End', 'South End', 'Financial District'],
  },
  'Uptown': {
    close: ['Midtown', 'North End'],
    medium: ['Downtown', 'Westside', 'Eastside'],
    far: ['Suburbs', 'South End', 'Financial District'],
  },
  'Suburbs': {
    close: ['North End', 'South End'],
    medium: ['Uptown'],
    far: ['Downtown', 'Midtown', 'Westside', 'Eastside', 'Financial District'],
  },
  'North End': {
    close: ['Uptown', 'Suburbs'],
    medium: ['Midtown'],
    far: ['Downtown', 'Westside', 'Eastside', 'South End', 'Financial District'],
  },
  'South End': {
    close: ['Suburbs'],
    medium: ['Downtown', 'Eastside'],
    far: ['Midtown', 'Westside', 'Uptown', 'North End', 'Financial District'],
  },
  'Financial District': {
    close: ['Downtown'],
    medium: ['Midtown', 'Eastside'],
    far: ['Westside', 'Uptown', 'Suburbs', 'North End', 'South End'],
  },
};

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
    workLocation: 0,
    guestPolicy: 0,
    noiseTolerance: 0,
    pets: 0,
    roommateRelationship: 0,
    lifestyle: 0,
    occupation: 0,
  };

  const reasons = {
    strengths: [] as string[],
    concerns: [] as string[],
    notes: [] as string[],
  };

  const userPrefs = currentUser.profileData?.preferences;
  const userProfile = currentUser.profileData;
  
  if (!userPrefs || !userProfile) {
    return { totalScore: 50, breakdown, reasons };
  }

  // ========================================
  // 1. LOCATION (18 points) - MAJOR FACTOR
  // ========================================
  if (userProfile.location && roommateProfile.preferences?.location) {
    const userLocation = userProfile.location;
    const roommateLocation = roommateProfile.preferences.location;
    
    if (userLocation === roommateLocation) {
      breakdown.location = 18;
      reasons.strengths.push(`Both prefer ${userLocation} - perfect location match`);
    } else if (NEIGHBORHOOD_PROXIMITY[userLocation]?.close.includes(roommateLocation)) {
      breakdown.location = 14;
      reasons.strengths.push(`${userLocation} and ${roommateLocation} are close neighborhoods`);
    } else if (NEIGHBORHOOD_PROXIMITY[userLocation]?.medium.includes(roommateLocation)) {
      breakdown.location = 9;
      reasons.notes.push(`${userLocation} and ${roommateLocation} are moderately close`);
    } else if (NEIGHBORHOOD_PROXIMITY[userLocation]?.far.includes(roommateLocation)) {
      breakdown.location = 4;
      reasons.concerns.push(`${userLocation} and ${roommateLocation} are far apart`);
    } else {
      // Unknown neighborhoods - give neutral score
      breakdown.location = 9;
      reasons.notes.push(`Different preferred locations`);
    }
  } else {
    breakdown.location = 9; // Neutral if data missing
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
  // 6. WORK LOCATION (8 points) - Home/Office Balance
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
  // 8. NOISE TOLERANCE (6 points) - Daily Comfort
  // ========================================
  if (userPrefs.noiseTolerance) {
    const userNoise = userPrefs.noiseTolerance;
    const roommateNoise = inferNoiseTolerance(roommateProfile);
    
    if (userNoise === roommateNoise) {
      breakdown.noiseTolerance = 6;
      reasons.strengths.push(`Same noise tolerance level`);
    } else if (userNoise === 'normal_noise' || roommateNoise === 'normal_noise') {
      breakdown.noiseTolerance = 4;
      reasons.notes.push(`Moderate noise tolerance may work`);
    } else {
      breakdown.noiseTolerance = 1;
      reasons.concerns.push(`Noise tolerance mismatch`);
    }
  } else {
    breakdown.noiseTolerance = 3;
  }

  // ========================================
  // 9. PETS (6 points) - Allergies & Preferences
  // ========================================
  if (userPrefs.pets) {
    const userPets = userPrefs.pets;
    const roommatePets = roommateProfile.lifestyle?.pets || false;
    
    if (userPets === 'have_pets' && roommatePets) {
      breakdown.pets = 6;
      reasons.strengths.push(`Both have pets - pet-friendly match`);
    } else if (userPets === 'open_to_pets') {
      breakdown.pets = 6;
      reasons.notes.push(`Open to pets - flexible on this`);
    } else if (userPets === 'no_pets' && !roommatePets) {
      breakdown.pets = 6;
      reasons.strengths.push(`Both prefer pet-free living`);
    } else if (userPets === 'no_pets' && roommatePets) {
      breakdown.pets = 0;
      reasons.concerns.push(`Pet incompatibility - they have pets`);
    } else {
      breakdown.pets = 3;
    }
  } else {
    breakdown.pets = 3;
  }

  // ========================================
  // 10. ROOMMATE RELATIONSHIP (4 points) - Social Expectations
  // ========================================
  if (userPrefs.roommateRelationship) {
    const userRel = userPrefs.roommateRelationship;
    const roommateRel = inferRelationshipPreference(roommateProfile);
    
    if (userRel === roommateRel) {
      breakdown.roommateRelationship = 4;
      reasons.strengths.push(`Matching social expectations`);
    } else if (userRel === 'respectful_coliving' || roommateRel === 'respectful_coliving') {
      breakdown.roommateRelationship = 3;
      reasons.notes.push(`Respectful coexistence baseline met`);
    } else if (
      (userRel === 'minimal_interaction' && roommateRel === 'prefer_friends') ||
      (userRel === 'prefer_friends' && roommateRel === 'minimal_interaction')
    ) {
      breakdown.roommateRelationship = 1;
      reasons.concerns.push(`Different social expectations`);
    } else {
      breakdown.roommateRelationship = 2;
    }
  } else {
    breakdown.roommateRelationship = 2;
  }

  // ========================================
  // 11. LIFESTYLE TAGS (3 points) - Shared Interests
  // ========================================
  if (userPrefs.lifestyle && userPrefs.lifestyle.length > 0) {
    const userLifestyles = userPrefs.lifestyle;
    const roommateLifestyles = inferLifestyleTags(roommateProfile);
    
    const overlaps = userLifestyles.filter(tag => roommateLifestyles.includes(tag));
    
    if (overlaps.length >= 2) {
      breakdown.lifestyle = 3;
      reasons.strengths.push(`Shared interests: ${overlaps.join(', ')}`);
    } else if (overlaps.length === 1) {
      breakdown.lifestyle = 2;
      reasons.notes.push(`Some shared interests: ${overlaps.join(', ')}`);
    } else {
      breakdown.lifestyle = 1;
      reasons.notes.push(`Different lifestyle interests`);
    }
  } else {
    breakdown.lifestyle = 1;
  }

  // ========================================
  // 12. OCCUPATION (1 point) - Minor Tie-Breaker
  // ========================================
  if (userProfile.occupation && roommateProfile.occupation) {
    const userOcc = userProfile.occupation.toLowerCase();
    const roommateOcc = roommateProfile.occupation.toLowerCase();
    
    // Check for similar professional fields
    const fields = ['engineer', 'design', 'marketing', 'sales', 'teacher', 'nurse', 'developer', 'analyst', 'manager'];
    const userField = fields.find(f => userOcc.includes(f));
    const roommateField = fields.find(f => roommateOcc.includes(f));
    
    if (userField && userField === roommateField) {
      breakdown.occupation = 1;
      reasons.notes.push(`Similar professional fields`);
    } else {
      breakdown.occupation = 0;
    }
  } else {
    breakdown.occupation = 0;
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
export const getWorkScheduleLabel = (schedule: string): string => {
  const map: Record<string, string> = {
    'wfh': 'Work from Home',
    'office': 'In Office',
    'hybrid': 'Hybrid',
    'irregular': 'Irregular Hours',
    'night_shift': 'Night Shift',
    'flexible': 'Flexible Schedule',
  };
  return map[schedule] || schedule;
};

/**
 * Format move-in date for display
 */
export const formatMoveInDate = (dateString: string): string => {
  if (!dateString) return 'Flexible';
  
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'ASAP';
  if (diffDays <= 7) return 'This Week';
  if (diffDays <= 14) return 'Next Week';
  if (diffDays <= 30) return 'This Month';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
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
