import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      .select('id, full_name, city')
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
      .select('budget_max, budget_min, sleep_schedule, cleanliness, smoking, pets, move_in_date, room_type')
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
      .select('target_id')
      .eq('user_id', userId)
      .gte('calculated_at', oneDayAgo);

    const excludeIds = [userId, ...(recentlyScored || []).map(r => r.target_id)];

    const { data: candidates } = await supabase
      .from('users')
      .select(`
        id, full_name, city,
        profile:profiles(budget_max, budget_min, sleep_schedule, cleanliness, smoking, pets, move_in_date, room_type)
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

      const breakdown: Record<string, number> = {};

      let budgetScore = 0;
      if (currentProfile.budget_max && profile.budget_max) {
        const minMax = Math.min(currentProfile.budget_max, profile.budget_max);
        const maxMin = Math.max(currentProfile.budget_min || currentProfile.budget_max * 0.7, profile.budget_min || profile.budget_max * 0.7);
        if (maxMin <= minMax) budgetScore = 25;
        else if (Math.abs(currentProfile.budget_max - profile.budget_max) < 500) budgetScore = 12;
      }
      breakdown.budget = budgetScore;

      let sleepScore = 0;
      if (currentProfile.sleep_schedule && profile.sleep_schedule) {
        if (currentProfile.sleep_schedule === profile.sleep_schedule) sleepScore = 20;
        else if (currentProfile.sleep_schedule === 'flexible' || profile.sleep_schedule === 'flexible') sleepScore = 10;
      }
      breakdown.sleep = sleepScore;

      let cleanScore = 0;
      if (currentProfile.cleanliness != null && profile.cleanliness != null) {
        const diff = Math.abs(currentProfile.cleanliness - profile.cleanliness);
        if (diff <= 1) cleanScore = 20;
        else if (diff === 2) cleanScore = 12;
        else if (diff === 3) cleanScore = 5;
      }
      breakdown.cleanliness = cleanScore;

      let smokingScore = 0;
      if (currentProfile.smoking != null && profile.smoking != null) {
        smokingScore = currentProfile.smoking === profile.smoking ? 15 : 0;
      }
      breakdown.smoking = smokingScore;

      let moveInScore = 0;
      if (currentProfile.move_in_date && profile.move_in_date) {
        const diffDays = Math.abs(
          (new Date(currentProfile.move_in_date).getTime() - new Date(profile.move_in_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays <= 14) moveInScore = 10;
        else if (diffDays <= 30) moveInScore = 7;
        else if (diffDays <= 60) moveInScore = 3;
      }
      breakdown.moveIn = moveInScore;

      let petsScore = 0;
      if (currentProfile.pets != null && profile.pets != null) {
        petsScore = currentProfile.pets === profile.pets ? 10 : 0;
      }
      breakdown.pets = petsScore;

      const totalScore = budgetScore + sleepScore + cleanScore + smokingScore + moveInScore + petsScore;

      const [uid1, uid2] = userId < candidate.id ? [userId, candidate.id] : [candidate.id, userId];

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
    if (highScores.length > 0) {
      for (const hs of highScores.slice(0, 5)) {
        const targetId = hs.user_id === userId ? hs.target_id : hs.user_id;
        supabase.functions.invoke('pi-match-insight', {
          body: { user_id: userId, target_user_id: targetId, match_score: hs.score },
        }).catch(() => {});
      }
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
