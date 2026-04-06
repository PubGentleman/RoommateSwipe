import { getCachedOrGenerateInsight, checkAIQuota } from './piMatchingService';

export interface QuickInsight {
  text: string;
  type: 'strength' | 'shared' | 'complementary' | 'heads_up' | 'fun';
  icon: string;
  source: 'algorithmic' | 'ai';
}

function normalizeSmoking(val: any): string {
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  return String(val || 'no');
}

function normalizePets(val: any): string {
  if (typeof val === 'boolean') return val ? 'have_pets' : 'no_pets';
  return String(val || 'no_pets');
}

function normalizeCleanliness(val: any): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    if (val >= 4) return 'very_tidy';
    if (val >= 3) return 'moderately_tidy';
    return 'relaxed';
  }
  return null;
}

export function generateAlgorithmicInsights(
  currentUser: any,
  targetProfile: any
): QuickInsight[] {
  const insights: QuickInsight[] = [];
  const userPref = currentUser.profileData?.preferences || {};
  const targetPref = targetProfile.profileData?.preferences || targetProfile.lifestyle || {};

  const userSleep = userPref.sleepSchedule;
  const targetSleep = targetPref.sleepSchedule;
  if (userSleep && targetSleep) {
    if (userSleep === targetSleep) {
      const labels: Record<string, string> = {
        early_sleeper: 'early birds', late_sleeper: 'night owls', flexible: 'flexible sleepers',
      };
      insights.push({ text: `Both ${labels[userSleep] || 'on the same schedule'}`, type: 'shared', icon: 'moon', source: 'algorithmic' });
    } else if (
      (userSleep === 'early_sleeper' && targetSleep === 'late_sleeper') ||
      (userSleep === 'late_sleeper' && targetSleep === 'early_sleeper')
    ) {
      insights.push({ text: 'Night owl meets early bird — you may need to coordinate quiet hours', type: 'heads_up', icon: 'moon', source: 'algorithmic' });
    }
  }

  const userClean = normalizeCleanliness(userPref.cleanliness);
  const targetClean = normalizeCleanliness(targetPref.cleanliness);
  if (userClean && targetClean) {
    if (userClean === targetClean) {
      const labels: Record<string, string> = {
        very_tidy: 'You both keep things spotless', moderately_tidy: 'Both keep a tidy home', relaxed: 'Both relaxed about mess',
      };
      insights.push({ text: labels[userClean] || 'Same cleanliness vibe', type: 'shared', icon: 'zap', source: 'algorithmic' });
    } else if (
      (userClean === 'very_tidy' && targetClean === 'relaxed') ||
      (userClean === 'relaxed' && targetClean === 'very_tidy')
    ) {
      insights.push({ text: 'Very different cleaning standards — worth discussing', type: 'heads_up', icon: 'zap', source: 'algorithmic' });
    }
  }

  const userBudget = currentUser.profileData?.budget;
  const targetBudget = targetProfile.budget || targetProfile.profileData?.budget;
  if (userBudget && targetBudget) {
    const diff = Math.abs(userBudget - targetBudget);
    const avgBudget = (userBudget + targetBudget) / 2;
    if (diff / avgBudget < 0.1) {
      insights.push({ text: 'Budgets are almost identical', type: 'strength', icon: 'dollar-sign', source: 'algorithmic' });
    } else if (diff / avgBudget > 0.4) {
      insights.push({ text: `$${diff} budget gap — could affect apartment options`, type: 'heads_up', icon: 'dollar-sign', source: 'algorithmic' });
    }
  }

  const userNeighborhoods = currentUser.preferred_neighborhoods || [];
  const targetNeighborhoods = targetProfile.preferred_neighborhoods || [];
  const overlap = userNeighborhoods.filter((n: string) => targetNeighborhoods.includes(n));
  if (overlap.length > 0) {
    insights.push({
      text: overlap.length === 1 ? `Both interested in ${overlap[0]}` : `${overlap.length} neighborhoods in common`,
      type: 'shared', icon: 'map-pin', source: 'algorithmic',
    });
  }

  const userWork = userPref.workLocation;
  const targetWork = targetPref.workLocation || targetPref.workSchedule;
  if (userWork && targetWork) {
    if (userWork === targetWork && (userWork === 'wfh_fulltime' || userWork === 'wfh' || userWork === 'remote')) {
      insights.push({ text: 'Both work from home — you\'ll see each other a lot', type: 'shared', icon: 'briefcase', source: 'algorithmic' });
    } else if (
      (userWork === 'wfh_fulltime' || userWork === 'wfh' || userWork === 'remote') &&
      (targetWork === 'office_fulltime' || targetWork === 'office')
    ) {
      insights.push({ text: 'You WFH, they\'re in-office — you\'ll have the place to yourself during the day', type: 'complementary', icon: 'briefcase', source: 'algorithmic' });
    }
  }

  const userSmoke = normalizeSmoking(userPref.smoking);
  const targetSmoke = normalizeSmoking(targetPref.smoking);
  if (userSmoke === 'no' && targetSmoke === 'no') {
    insights.push({ text: 'Both non-smokers', type: 'shared', icon: 'slash', source: 'algorithmic' });
  } else if (userSmoke === 'no' && targetSmoke === 'yes') {
    insights.push({ text: 'They smoke — you said no smokers', type: 'heads_up', icon: 'slash', source: 'algorithmic' });
  }

  const userPetsVal = normalizePets(userPref.pets);
  const targetPetsVal = normalizePets(targetPref.pets);
  if (userPetsVal === 'have_pets' && targetPetsVal === 'open_to_pets') {
    insights.push({ text: 'They\'re pet-friendly — good for your furry friend', type: 'strength', icon: 'heart', source: 'algorithmic' });
  } else if (userPetsVal === 'no_pets' && targetPetsVal === 'have_pets') {
    insights.push({ text: 'They have pets — you said no pets', type: 'heads_up', icon: 'heart', source: 'algorithmic' });
  }

  const userGuests = userPref.guestPolicy;
  const targetGuests = targetPref.guestPolicy;
  if (userGuests && targetGuests && userGuests === targetGuests) {
    const labels: Record<string, string> = {
      rarely: 'Both prefer minimal guests', occasionally: 'Both okay with occasional guests', frequently: 'Both social — love having people over',
    };
    insights.push({ text: labels[userGuests] || 'Same guest policy', type: 'shared', icon: 'users', source: 'algorithmic' });
  }

  const userInterests = currentUser.profileData?.interests || [];
  const targetInterests = targetProfile.profileData?.interests || [];
  const sharedInterests = userInterests.filter((i: string) => targetInterests.includes(i));
  if (sharedInterests.length >= 3) {
    insights.push({
      text: `${sharedInterests.length} shared interests including ${sharedInterests.slice(0, 2).join(' and ')}`,
      type: 'fun', icon: 'heart', source: 'algorithmic',
    });
  }

  if (currentUser.zodiacSign && targetProfile.zodiacSign) {
    if (checkZodiacCompatibility(currentUser.zodiacSign, targetProfile.zodiacSign)) {
      insights.push({
        text: `${currentUser.zodiacSign} + ${targetProfile.zodiacSign} — the stars approve`,
        type: 'fun', icon: 'star', source: 'algorithmic',
      });
    }
  }

  const userVibe = currentUser.pi_parsed_preferences?.vibe;
  const targetVibe = targetProfile.pi_parsed_preferences?.vibe;
  if (userVibe && targetVibe && userVibe.toLowerCase() === targetVibe.toLowerCase()) {
    insights.push({ text: `Same vibe: "${userVibe}"`, type: 'shared', icon: 'music', source: 'algorithmic' });
  }

  return insights;
}

function checkZodiacCompatibility(sign1: string, sign2: string): boolean {
  const ELEMENTS: Record<string, string> = {
    Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
    Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
    Gemini: 'air', Libra: 'air', Aquarius: 'air',
    Cancer: 'water', Scorpio: 'water', Pisces: 'water',
  };
  const e1 = ELEMENTS[sign1];
  const e2 = ELEMENTS[sign2];
  if (!e1 || !e2) return false;
  if (e1 === e2) return true;
  if ((e1 === 'fire' && e2 === 'air') || (e1 === 'air' && e2 === 'fire')) return true;
  if ((e1 === 'earth' && e2 === 'water') || (e1 === 'water' && e2 === 'earth')) return true;
  return false;
}

export async function getEnhancedInsight(
  userId: string,
  targetUserId: string,
  matchScore: number
): Promise<QuickInsight | null> {
  const hasQuota = await checkAIQuota(userId, 'match_insight');
  if (!hasQuota) return null;

  try {
    const insight = await getCachedOrGenerateInsight(userId, targetUserId, matchScore);
    if (!insight) return null;

    return {
      text: insight.summary,
      type: insight.confidence === 'strong' || insight.confidence === 'good' ? 'strength' : 'heads_up',
      icon: 'cpu',
      source: 'ai',
    };
  } catch {
    return null;
  }
}

export function selectCardInsight(
  insights: QuickInsight[],
  aiInsight?: QuickInsight | null
): QuickInsight | null {
  if (aiInsight) return aiInsight;
  if (insights.length === 0) return null;

  const priority: Record<string, number> = {
    heads_up: 5, strength: 4, shared: 3, complementary: 2, fun: 1,
  };

  const sorted = [...insights].sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));
  return sorted[0];
}
