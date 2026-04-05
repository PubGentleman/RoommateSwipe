import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateAgeFromBirthday(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const parts = birthday.split('T')[0].split('-').map(Number);
  const birth = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

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

function isCompatiblePersonality(key: string, val2: string): boolean {
  return COMPATIBLE_PERSONALITY[key]?.includes(val2) ?? false;
}

function checkDealbreakers(
  userProfile: any,
  candidateProfile: any,
): boolean {
  const userDealbreakers: string[] = userProfile.dealbreakers || [];
  for (const db of userDealbreakers) {
    switch (db) {
      case 'no_smokers':
        if (candidateProfile.smoking === 'yes' || candidateProfile.smoking === 'only_outside') return true;
        break;
      case 'no_cats':
        if (candidateProfile.pets === 'have_pets' && candidateProfile.pet_type === 'cat') return true;
        break;
      case 'no_dogs':
        if (candidateProfile.pets === 'have_pets' && candidateProfile.pet_type === 'dog') return true;
        break;
      case 'no_pets':
        if (candidateProfile.pets === 'have_pets') return true;
        break;
      case 'no_overnight_guests':
        if (candidateProfile.guest_policy === 'frequently') return true;
        break;
    }
  }
  return false;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('id, full_name, city, age, birthday, gender, zodiac_sign, occupation, pi_parsed_preferences')
      .eq('id', userId)
      .single();

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select(`
        budget_max, budget_min, sleep_schedule, cleanliness, smoking, pets,
        move_in_date, room_type, work_schedule, guest_policy, noise_tolerance,
        preferred_neighborhoods, personality_answers, interests,
        household_gender_preference, apartment_search_type,
        roommate_relationship, shared_expenses, pet_type,
        dealbreakers, social_level, pi_parsed_preferences
      `)
      .eq('user_id', userId)
      .single();

    if (!currentProfile) {
      return new Response(JSON.stringify({ calculated: 0, reason: 'No profile found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentlyScored } = await supabase
      .from('match_scores')
      .select('user_id, target_id')
      .or(`user_id.eq.${userId},target_id.eq.${userId}`)
      .gte('calculated_at', oneDayAgo);

    const recentPartnerIds = (recentlyScored || []).map(r =>
      r.user_id === userId ? r.target_id : r.user_id
    );
    const excludeIds = [userId, ...recentPartnerIds];

    const { data: candidates } = await supabase
      .from('users')
      .select(`
        id, full_name, city, age, birthday, gender, zodiac_sign, occupation, pi_parsed_preferences,
        profile:profiles(
          budget_max, budget_min, sleep_schedule, cleanliness, smoking, pets,
          move_in_date, room_type, work_schedule, guest_policy, noise_tolerance,
          preferred_neighborhoods, personality_answers, interests,
          household_gender_preference, apartment_search_type,
          roommate_relationship, shared_expenses, pet_type,
          dealbreakers, social_level, pi_parsed_preferences
        )
      `)
      .eq('role', 'renter')
      .eq('onboarding_step', 'complete')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(50);

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ calculated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scores: Array<{ user_id: string; target_id: string; score: number; breakdown: any; calculated_at: string }> = [];
    const now = new Date().toISOString();

    for (const candidate of candidates) {
      const profile = Array.isArray(candidate.profile) ? candidate.profile[0] : candidate.profile;
      if (!profile) continue;

      const [uid1, uid2] = userId < candidate.id ? [userId, candidate.id] : [candidate.id, userId];

      const breakdown: Record<string, number> = {};

      const isDealbreaker =
        checkDealbreakers(currentProfile, profile) ||
        checkDealbreakers(profile, currentProfile);

      if (isDealbreaker) {
        scores.push({
          user_id: uid1, target_id: uid2, score: 0,
          breakdown: { dealbreaker: true }, calculated_at: now,
        });
        continue;
      }

      let ageScore = 4;
      const userAge = currentUser.age || calculateAgeFromBirthday(currentUser.birthday);
      const candidateAge = candidate.age || calculateAgeFromBirthday(candidate.birthday);
      if (userAge && candidateAge) {
        const ageDiff = Math.abs(userAge - candidateAge);
        if (ageDiff <= 2) ageScore = 8;
        else if (ageDiff <= 5) ageScore = 6;
        else if (ageDiff <= 10) ageScore = 4;
        else if (ageDiff <= 15) ageScore = 2;
        else ageScore = 0;
      }
      breakdown.age = ageScore;

      let locationScore = 8;
      const userNeighborhoods = currentProfile.preferred_neighborhoods || [];
      const candidateNeighborhoods = profile.preferred_neighborhoods || [];
      if (userNeighborhoods.length > 0 && candidateNeighborhoods.length > 0) {
        const userSet = new Set(userNeighborhoods.map((n: string) => n.toLowerCase()));
        const overlap = candidateNeighborhoods.filter((n: string) => userSet.has(n.toLowerCase()));
        if (overlap.length >= 3) locationScore = 16;
        else if (overlap.length === 2) locationScore = 14;
        else if (overlap.length === 1) locationScore = 10;
        else {
          if (currentUser.city && candidate.city &&
              currentUser.city.toLowerCase() === candidate.city.toLowerCase()) {
            locationScore = 6;
          } else {
            locationScore = 2;
          }
        }
      } else if (currentUser.city && candidate.city) {
        locationScore = currentUser.city.toLowerCase() === candidate.city.toLowerCase() ? 8 : 2;
      }
      breakdown.location = locationScore;

      let budgetScore = 6;
      const userBudget = currentProfile.budget_max;
      const candidateBudget = profile.budget_max;
      if (userBudget && candidateBudget) {
        const diff = Math.abs(userBudget - candidateBudget);
        const avg = (userBudget + candidateBudget) / 2;
        const percentDiff = diff / avg;
        if (percentDiff <= 0.10) budgetScore = 12;
        else if (percentDiff <= 0.25) budgetScore = 8;
        else if (percentDiff <= 0.50) budgetScore = 4;
        else budgetScore = 1;
      }
      breakdown.budget = budgetScore;

      let sleepScore = 5;
      if (currentProfile.sleep_schedule && profile.sleep_schedule) {
        if (currentProfile.sleep_schedule === profile.sleep_schedule) sleepScore = 12;
        else if (currentProfile.sleep_schedule === 'flexible' || profile.sleep_schedule === 'flexible') sleepScore = 8;
        else if (currentProfile.sleep_schedule === 'irregular' || profile.sleep_schedule === 'irregular') sleepScore = 5;
        else sleepScore = 0;
      }
      breakdown.sleep = sleepScore;

      let cleanScore = 6;
      if (currentProfile.cleanliness != null && profile.cleanliness != null) {
        const diff = Math.abs(currentProfile.cleanliness - profile.cleanliness);
        if (diff === 0) cleanScore = 12;
        else if (diff <= 2) cleanScore = 8;
        else if (diff <= 4) cleanScore = 4;
        else cleanScore = 0;
      }
      breakdown.cleanliness = cleanScore;

      let smokingScore = 5;
      if (currentProfile.smoking != null && profile.smoking != null) {
        if (currentProfile.smoking === 'no' && profile.smoking === 'no') smokingScore = 10;
        else if (currentProfile.smoking === profile.smoking) smokingScore = 9;
        else if (currentProfile.smoking === 'only_outside' || profile.smoking === 'only_outside') smokingScore = 6;
        else smokingScore = 0;
      }
      breakdown.smoking = smokingScore;

      let moveInScore = 2;
      if (currentProfile.move_in_date && profile.move_in_date) {
        const diffDays = Math.abs(
          (new Date(currentProfile.move_in_date).getTime() - new Date(profile.move_in_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays <= 14) moveInScore = 4;
        else if (diffDays <= 30) moveInScore = 3;
        else if (diffDays <= 60) moveInScore = 2;
        else if (diffDays <= 90) moveInScore = 1;
        else moveInScore = 0;
      }
      breakdown.moveIn = moveInScore;

      let workScore = 3;
      if (currentProfile.work_schedule && profile.work_schedule) {
        if (currentProfile.work_schedule === profile.work_schedule) workScore = 6;
        else if (['wfh_fulltime', 'hybrid'].includes(currentProfile.work_schedule) &&
                 ['wfh_fulltime', 'hybrid'].includes(profile.work_schedule)) workScore = 4;
        else workScore = 2;
      }
      breakdown.work = workScore;

      let guestScore = 3;
      if (currentProfile.guest_policy && profile.guest_policy) {
        if (currentProfile.guest_policy === profile.guest_policy) guestScore = 6;
        else {
          const order = ['prefer_no_guests', 'rarely', 'occasionally', 'frequently'];
          const idx1 = order.indexOf(currentProfile.guest_policy);
          const idx2 = order.indexOf(profile.guest_policy);
          if (idx1 >= 0 && idx2 >= 0) {
            const diff = Math.abs(idx1 - idx2);
            if (diff === 1) guestScore = 4;
            else if (diff === 2) guestScore = 1;
            else guestScore = 0;
          }
        }
      }
      breakdown.guests = guestScore;

      let noiseScore = 2;
      if (currentProfile.noise_tolerance && profile.noise_tolerance) {
        if (currentProfile.noise_tolerance === profile.noise_tolerance) noiseScore = 4;
        else {
          const order = ['prefer_quiet', 'normal_noise', 'loud_environments'];
          const idx1 = order.indexOf(currentProfile.noise_tolerance);
          const idx2 = order.indexOf(profile.noise_tolerance);
          if (idx1 >= 0 && idx2 >= 0) {
            noiseScore = Math.abs(idx1 - idx2) === 1 ? 2 : 0;
          }
        }
      }
      breakdown.noise = noiseScore;

      let petsScore = 2;
      if (currentProfile.pets != null && profile.pets != null) {
        if (currentProfile.pets === profile.pets) petsScore = 4;
        else if (currentProfile.pets === 'ok_with_pets' || profile.pets === 'ok_with_pets') petsScore = 3;
        else petsScore = 0;
      }
      breakdown.pets = petsScore;

      let personalityScore = 7;
      const userAnswers = currentProfile.personality_answers;
      const candidateAnswers = profile.personality_answers;
      if (userAnswers && candidateAnswers && typeof userAnswers === 'object' && typeof candidateAnswers === 'object') {
        let matches = 0;
        let total = 0;
        for (const q of Object.keys(userAnswers)) {
          if (q.endsWith('_source') || q.endsWith('_collectedAt')) continue;
          if (!candidateAnswers[q]) continue;
          const key = `${q}_${userAnswers[q]}`;
          const val2 = `${q}_${candidateAnswers[q]}`;
          if (isCompatiblePersonality(key, val2)) matches++;
          total++;
        }
        const rawPct = total > 0 ? (matches / total) * 100 : 50;
        personalityScore = Math.round(rawPct * 0.15 * 10) / 10;
      }
      breakdown.personality = personalityScore;

      const totalScore = Math.max(0, Math.min(100,
        ageScore + locationScore + budgetScore + sleepScore + cleanScore +
        smokingScore + moveInScore + workScore + guestScore + noiseScore +
        petsScore + personalityScore
      ));

      scores.push({
        user_id: uid1,
        target_id: uid2,
        score: totalScore,
        breakdown,
        calculated_at: now,
      });
    }

    if (scores.length > 0) {
      await supabase
        .from('match_scores')
        .upsert(scores, { onConflict: 'user_id,target_id' });
    }

    supabase.functions.invoke('generate-group-suggestions', { body: { userId } }).catch(() => {});

    const highScores = scores.filter(s => s.score > 60);
    for (const hs of highScores) {
      const targetId = hs.user_id === userId ? hs.target_id : hs.user_id;
      supabase.functions.invoke('pi-match-insight', {
        body: { user_id: userId, target_user_id: targetId, match_score: hs.score },
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ calculated: scores.length, piTriggered: highScores.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
