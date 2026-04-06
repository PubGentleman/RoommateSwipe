import { calculateWeightedCompatibility, WeightedMatchResult } from '../utils/matchingAlgorithm';
import { getWeightProfile } from './matchWeightService';
import { getCachedOrGenerateInsight } from './piMatchingService';
import { PiMatchInsight } from '../types/models';

export interface CompatibilityBreakdown {
  overallScore: number;
  overallLabel: string;
  overallColor: string;
  categories: BreakdownCategory[];
  strengths: BreakdownInsight[];
  frictionPoints: BreakdownInsight[];
  aiInsight: PiMatchInsight | null;
}

export interface BreakdownCategory {
  key: string;
  label: string;
  icon: string;
  score: number;
  maxScore: number;
  rawPoints: number;
  weightedPoints: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'dealbreaker';
  detail: string;
}

export interface BreakdownInsight {
  icon: string;
  text: string;
  severity: 'positive' | 'neutral' | 'warning' | 'critical';
}

const FACTOR_META: Record<string, { label: string; icon: string }> = {
  location: { label: 'Location', icon: 'map-pin' },
  budget: { label: 'Budget', icon: 'dollar-sign' },
  sleepSchedule: { label: 'Sleep Schedule', icon: 'moon' },
  cleanliness: { label: 'Cleanliness', icon: 'droplet' },
  smoking: { label: 'Smoking', icon: 'slash' },
  pets: { label: 'Pets', icon: 'heart' },
  age: { label: 'Age', icon: 'users' },
  moveInTimeline: { label: 'Move-in Timeline', icon: 'calendar' },
  workLocation: { label: 'Work Schedule', icon: 'briefcase' },
  guestPolicy: { label: 'Guest Policy', icon: 'user-plus' },
  noiseTolerance: { label: 'Noise Tolerance', icon: 'volume-2' },
  roommateRelationship: { label: 'Social Style', icon: 'message-circle' },
  sharedExpenses: { label: 'Shared Expenses', icon: 'credit-card' },
  lifestyle: { label: 'Lifestyle', icon: 'activity' },
  zodiac: { label: 'Zodiac', icon: 'star' },
  personality: { label: 'Personality', icon: 'smile' },
};

function getScoreStatus(percentage: number): BreakdownCategory['status'] {
  if (percentage >= 85) return 'excellent';
  if (percentage >= 65) return 'good';
  if (percentage >= 40) return 'fair';
  if (percentage > 0) return 'poor';
  return 'dealbreaker';
}

function getOverallLabel(score: number): string {
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Great Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Fair Match';
  return 'Low Match';
}

function getOverallColor(score: number): string {
  if (score >= 75) return '#3ECF8E';
  if (score >= 50) return '#F39C12';
  return '#ef4444';
}

export async function getRoommateBreakdown(
  currentUser: any,
  roommateProfile: any,
  userId: string,
  isPremium: boolean = false
): Promise<CompatibilityBreakdown> {
  const weightProfile = await getWeightProfile(userId);
  const result: WeightedMatchResult = calculateWeightedCompatibility(currentUser, roommateProfile, weightProfile);

  const categories: BreakdownCategory[] = [];
  const strengths: BreakdownInsight[] = [];
  const frictionPoints: BreakdownInsight[] = [];

  for (const [key, data] of Object.entries(result.breakdown)) {
    const meta = FACTOR_META[key];
    if (!meta) continue;

    const percentage = data.maxRaw > 0 ? Math.round((data.raw / data.maxRaw) * 100) : 0;
    const status = getScoreStatus(percentage);
    const detail = generateFactorDetail(key, data.raw, data.maxRaw, currentUser, roommateProfile);

    categories.push({
      key,
      label: meta.label,
      icon: meta.icon,
      score: percentage,
      maxScore: 100,
      rawPoints: data.raw,
      weightedPoints: data.weighted,
      status,
      detail,
    });

    if (percentage >= 80) {
      strengths.push({
        icon: meta.icon,
        text: getStrengthText(key),
        severity: 'positive',
      });
    } else if (percentage <= 30 && data.maxRaw > 2) {
      frictionPoints.push({
        icon: meta.icon,
        text: getFrictionText(key),
        severity: percentage === 0 ? 'critical' : 'warning',
      });
    }
  }

  categories.sort((a, b) => b.weightedPoints - a.weightedPoints);

  let aiInsight: PiMatchInsight | null = null;
  if (isPremium) {
    try {
      aiInsight = await getCachedOrGenerateInsight(userId, roommateProfile.id, result.total);
    } catch {
    }
  }

  return {
    overallScore: result.total,
    overallLabel: getOverallLabel(result.total),
    overallColor: getOverallColor(result.total),
    categories,
    strengths: strengths.slice(0, 5),
    frictionPoints: frictionPoints.slice(0, 3),
    aiInsight,
  };
}

function safeStr(val: any): string {
  if (val == null) return '';
  return String(val).replace(/_/g, ' ');
}

function generateFactorDetail(
  key: string, raw: number, max: number,
  user: any, other: any
): string {
  const pref = user.profileData?.preferences;
  const otherPref = other.profileData?.preferences || other.lifestyle || {};

  try {
    switch (key) {
      case 'location': {
        const userN = user.preferred_neighborhoods || [];
        const otherN = other.preferred_neighborhoods || [];
        const overlap = userN.filter((n: string) => otherN.includes(n));
        if (overlap.length > 0) return `Both interested in ${overlap.slice(0, 2).join(', ')}`;
        return 'Different neighborhood preferences';
      }
      case 'budget': {
        const userB = user.profileData?.budget;
        const otherB = other.budget || other.profileData?.budget;
        if (userB && otherB) {
          const diff = Math.abs(userB - otherB);
          return `$${Math.min(userB, otherB).toLocaleString()} vs $${Math.max(userB, otherB).toLocaleString()} ($${diff.toLocaleString()} apart)`;
        }
        return 'Budget information available';
      }
      case 'sleepSchedule': {
        const userS = safeStr(pref?.sleepSchedule);
        const otherS = safeStr(otherPref?.sleepSchedule);
        if (userS && otherS) {
          if (userS === otherS) return `Both ${userS}s`;
          return `You: ${userS} / Them: ${otherS}`;
        }
        return 'Sleep preferences compared';
      }
      case 'cleanliness': {
        const userC = pref?.cleanliness;
        const otherC = otherPref?.cleanliness;
        if (userC != null && otherC != null) {
          if (typeof userC === 'number' || typeof otherC === 'number') {
            const uNum = typeof userC === 'number' ? userC : 3;
            const oNum = typeof otherC === 'number' ? otherC : 3;
            const diff = Math.abs(uNum - oNum);
            if (diff === 0) return 'Same cleanliness level';
            if (diff <= 1) return 'Very similar cleanliness standards';
            return 'Different cleanliness expectations';
          }
          const uStr = safeStr(userC);
          const oStr = safeStr(otherC);
          if (uStr === oStr) return `Both ${uStr}`;
          return `You: ${uStr} / Them: ${oStr}`;
        }
        return 'Cleanliness levels compared';
      }
      case 'smoking': {
        const userSm = pref?.smoking;
        const otherSmRaw = otherPref?.smoking;
        const otherSm = typeof otherSmRaw === 'boolean'
          ? (otherSmRaw ? 'yes' : 'no')
          : (otherSmRaw || 'no');
        if (userSm === 'no' && otherSm === 'no') return 'Both non-smokers';
        if (userSm === 'no' && otherSm === 'yes') return "They smoke, you don't";
        return 'Smoking preferences compared';
      }
      case 'pets': {
        const userP = pref?.pets;
        const otherPRaw = otherPref?.pets;
        const otherP = typeof otherPRaw === 'boolean'
          ? (otherPRaw ? 'have_pets' : 'no_pets')
          : (otherPRaw || 'no_pets');
        if (userP === otherP) return 'Aligned on pets';
        return 'Different pet preferences';
      }
      default:
        if (raw === max) return 'Fully aligned';
        if (raw === 0) return 'No alignment';
        return 'Partially aligned';
    }
  } catch {
    if (raw === max) return 'Fully aligned';
    if (raw === 0) return 'No alignment';
    return 'Partially aligned';
  }
}

function getStrengthText(key: string): string {
  const map: Record<string, string> = {
    location: 'Interested in the same neighborhoods',
    budget: 'Budgets are well-aligned',
    sleepSchedule: 'Compatible sleep schedules',
    cleanliness: 'Same cleanliness standards',
    smoking: 'Aligned on smoking preferences',
    pets: 'Pet preferences match',
    guestPolicy: 'Similar guest boundaries',
    noiseTolerance: 'Same noise tolerance',
    roommateRelationship: 'Similar social styles',
    lifestyle: 'Complementary lifestyles',
    age: 'Close in age',
    moveInTimeline: 'Move-in dates align',
    workLocation: 'Compatible work schedules',
  };
  return map[key] || `Strong ${FACTOR_META[key]?.label || key} compatibility`;
}

function getFrictionText(key: string): string {
  const map: Record<string, string> = {
    location: 'Want to live in different areas',
    budget: 'Significant budget difference',
    sleepSchedule: 'Very different sleep schedules',
    cleanliness: 'Different cleanliness expectations',
    smoking: 'Smoking preference conflict',
    pets: 'Pet preference mismatch',
    guestPolicy: 'Different guest expectations',
    noiseTolerance: 'Different noise tolerance levels',
    roommateRelationship: 'Different social boundaries',
    moveInTimeline: 'Move-in dates don\'t align',
  };
  return map[key] || `${FACTOR_META[key]?.label || key} may need discussion`;
}
