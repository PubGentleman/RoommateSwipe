import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function errorResponse(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { userId } = await req.json().catch(() => ({}));

  if (!userId) return errorResponse('userId required', 400);

  const { data: profile } = await supabase
    .from('profiles')
    .select('desired_bedrooms, apartment_prefs_complete, budget_per_person_max, preferred_trains, move_in_date')
    .eq('user_id', userId)
    .single();

  if (!profile?.budget_per_person_max && !profile?.move_in_date) {
    return new Response(JSON.stringify({ suggested: 0, reason: 'profile_incomplete' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const desiredBedrooms = profile?.desired_bedrooms ?? 2;
  const membersNeeded = Math.max(1, desiredBedrooms - 1);

  const { data: existingGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .limit(1);

  if (existingGroups && existingGroups.length > 0) {
    return new Response(JSON.stringify({ suggested: 0, reason: 'already_in_group' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { data: recentSuggestion } = await supabase
    .from('ai_group_suggestions')
    .select('id')
    .eq('suggested_to_user_id', userId)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (recentSuggestion && recentSuggestion.length > 0) {
    return new Response(JSON.stringify({ suggested: 0, reason: 'recent_suggestion_exists' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { data: scores } = await supabase
    .from('match_scores')
    .select('user_id, target_id, score, breakdown')
    .or(`user_id.eq.${userId},target_id.eq.${userId}`)
    .gte('score', 75)
    .order('score', { ascending: false })
    .limit(10);

  if (!scores || scores.length < membersNeeded) {
    return new Response(JSON.stringify({ suggested: 0, reason: 'not_enough_matches' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const topMatchIds = scores
    .map(s => s.user_id === userId ? s.target_id : s.user_id)
    .slice(0, membersNeeded);

  const { data: matchUsers } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .in('id', topMatchIds);

  if (!matchUsers || matchUsers.length === 0) {
    return new Response(JSON.stringify({ suggested: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const avgScore = Math.round(
    scores.slice(0, membersNeeded).reduce((sum, s) => sum + s.score, 0) / membersNeeded
  );

  const topBreakdown = scores[0]?.breakdown ?? {};
  let reason = '';
  if (topBreakdown.sleep >= 20 && topBreakdown.cleanliness >= 15) {
    reason = 'Same sleep schedule and cleanliness standards';
  } else if (topBreakdown.budget >= 20) {
    reason = 'Budgets line up perfectly';
  } else {
    reason = 'Strong compatibility across lifestyle and budget';
  }

  const { data: suggestion } = await supabase
    .from('ai_group_suggestions')
    .insert({
      suggested_to_user_id: userId,
      suggested_member_ids: topMatchIds,
      suggested_member_names: matchUsers.map(u => u.full_name),
      avg_compatibility: avgScore,
      reason,
    })
    .select()
    .single();

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'ai_group_suggestion',
    title: 'We found great roommate matches for you',
    body: `${matchUsers.map(u => u.full_name.split(' ')[0]).join(' and ')} are ${avgScore}% compatible with you. Want to form a group?`,
    data: JSON.stringify({ suggestion_id: suggestion?.id }),
  });

  return new Response(
    JSON.stringify({ suggested: 1, suggestion_id: suggestion?.id }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
});
