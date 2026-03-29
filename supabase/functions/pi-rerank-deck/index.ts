import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RENTER_DAILY_LIMITS: Record<string, number> = {
  free: 5, basic: 5, plus: 50, elite: 200,
};

const PI_PERSONA = `You are Pi, Rhome's AI matchmaker. You're re-ranking a discovery deck of potential roommates. The deterministic algorithm already scored them on budget, location, sleep, cleanliness, smoking, pets, and timeline. Your job is to look at what the algorithm CAN'T score: bio nuance, occupation compatibility, personality quiz alignment, amenity priorities, transit needs, diet preferences, social style, and the intangible "would these people actually vibe?" factor. You're not replacing the algorithm — you're adding human-like intuition on top.`;

function stripPii(name: string | null | undefined): string {
  if (!name) return 'User';
  return name.split(' ')[0] || 'User';
}

function trimText(text: string | null | undefined, max = 500): string {
  if (!text) return '';
  let cleaned = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  cleaned = cleaned.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');
  cleaned = cleaned.replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Dr|Rd|Ln|Ct|Way|Pl)\b/gi, '[address]');
  return cleaned.length > max ? cleaned.substring(0, max) + '...' : cleaned;
}

function buildCompactProfile(userId: string, user: any, profile: any, score: number): string {
  const p = profile || {};
  const u = user || {};
  return `[${userId}] ${stripPii(u.full_name)}, ${u.age || '?'}yo, ${u.occupation || '?'} | Score: ${score}
  Bio: ${trimText(u.bio, 300)}
  Budget: $${p.budget_min || '?'}-$${p.budget_max || '?'} | Move-in: ${p.move_in_date || '?'}
  Sleep: ${p.sleep_schedule || '?'} | Clean: ${p.cleanliness ?? '?'}/10 | Noise: ${p.noise_tolerance || '?'}
  Smoke: ${p.smoking != null ? (p.smoking ? 'Y' : 'N') : '?'} | Pets: ${p.pets || '?'} | WFH: ${p.wfh != null ? (p.wfh ? 'Y' : 'N') : '?'}
  Trains: ${(p.preferred_trains || []).join(',') || '-'} | Amenities: ${(p.amenity_must_haves || []).join(',') || '-'}
  Diet: ${p.diet || '-'} | Guests: ${p.guests || '-'} | Roommate vibe: ${p.roommate_relationship || '-'}
  Interests: ${(p.interests || []).join(',') || '-'}
  Tags: ${(u.lifestyle_tags || p.lifestyle_tags || []).join(',') || '-'}
  Ideal roommate: ${trimText(p.ideal_roommate_text, 200)}
  Personality: ${p.personality_quiz_answers ? JSON.stringify(p.personality_quiz_answers) : '-'}
  Neighborhoods: ${(p.preferred_neighborhoods || []).join(',') || '-'}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await req.json();
    const resolvedCandidateIds: string[] = body.candidate_ids || [];
    const candidates: any[] = body.candidates || resolvedCandidateIds.map((id: string) => ({ user_id: id, score: 0 }));
    if (!candidates || candidates.length === 0) {
      return errorResponse('candidate_ids or candidates array is required', 400);
    }

    const top30 = candidates.slice(0, 30);
    const resolvedCandidateIds = top30.map((c: any) => c.userId || c.user_id || c.id);
    const candidateCountForCache = resolvedCandidateIds.length;

    const { data: cached } = await supabase
      .from('pi_deck_rankings')
      .select('*')
      .eq('user_id', user.id)
      .eq('candidate_count', candidateCountForCache)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      const cachedSet = new Set(cached.ranked_user_ids || []);
      const requestSet = new Set(resolvedCandidateIds);
      const overlap = resolvedCandidateIds.filter((id: string) => cachedSet.has(id)).length;
      if (overlap / requestSet.size >= 0.8) {
        return jsonResponse({
          ranked_ids: cached.ranked_user_ids,
          adjustments: cached.adjustments,
          cached: true,
        });
      }
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const plan = sub?.plan || 'free';
    const dailyLimit = RENTER_DAILY_LIMITS[plan] ?? 5;

    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('pi_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'deck_rerank')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count ?? 0) >= dailyLimit) {
      return errorResponse('Daily Pi rerank limit reached.', 429);
    }

    const [userDataResult, userProfileResult, candidateUsersResult, candidateProfilesResult] = await Promise.all([
      supabase.from('users').select('full_name, age, occupation, bio, city, neighborhood, zodiac_sign, lifestyle_tags').eq('id', user.id).single(),
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('users').select('id, full_name, age, occupation, bio, city, neighborhood, zodiac_sign, lifestyle_tags').in('id', resolvedCandidateIds),
      supabase.from('profiles').select('*').in('user_id', resolvedCandidateIds),
    ]);

    const userData = userDataResult.data;
    const userProfile = userProfileResult.data;
    if (!userData) return errorResponse('User profile not found', 404);

    const candidateUsers = new Map((candidateUsersResult.data || []).map((u: any) => [u.id, u]));
    const candidateProfiles = new Map((candidateProfilesResult.data || []).map((p: any) => [p.user_id, p]));

    const userContext = `YOUR PROFILE (the person swiping):
- Name: ${stripPii(userData.full_name)}, Age: ${userData.age || '?'}
- Occupation: ${userData.occupation || '?'}
- Bio: ${trimText(userData.bio, 300)}
- Interests: ${(userProfile?.interests || []).join(', ') || '-'}
- Tags: ${(userData.lifestyle_tags || []).join(', ') || '-'}
- Ideal roommate: ${trimText(userProfile?.ideal_roommate_text, 300)}
- Personality: ${userProfile?.personality_quiz_answers ? JSON.stringify(userProfile.personality_quiz_answers) : '-'}
- Diet: ${userProfile?.diet || '-'}
- Amenities: ${(userProfile?.amenity_must_haves || []).join(', ') || '-'}
- Trains: ${(userProfile?.preferred_trains || []).join(', ') || '-'}
- Desired bedrooms: ${userProfile?.desired_bedrooms || '-'}
- Neighborhoods: ${(userProfile?.preferred_neighborhoods || []).join(', ') || '-'}`;

    const candidateContexts = top30.map((c: any) => {
      const id = c.userId || c.user_id || c.id;
      const score = c.score || c.totalScore || 0;
      return buildCompactProfile(id, candidateUsers.get(id), candidateProfiles.get(id), score);
    }).join('\n\n');

    const prompt = `${userContext}

CANDIDATES (sorted by deterministic score, highest first):
${candidateContexts}

Re-rank these candidates based on factors the deterministic algorithm doesn't capture:
1. Bio/personality compatibility and social style alignment
2. Occupation lifestyle compatibility (e.g., nurse + WFH developer = different schedules)
3. Personality quiz answer synergy
4. Interest and lifestyle tag overlap depth
5. Transit line compatibility for shared commutes
6. Diet and amenity priority alignment
7. Free-text "ideal roommate" description match
8. Overall "would they actually get along?" intuition

Respond with ONLY this JSON:
{
  "ranked_ids": ["id1", "id2", "id3", ...],
  "adjustments": [
    {"user_id": "id", "reason": "Moved up because their bio about loving quiet mornings aligns perfectly with your early-bird personality quiz answers", "direction": "up"},
    {"user_id": "id", "reason": "Moved down because their frequent-guests preference conflicts with your prefer-quiet noise tolerance", "direction": "down"}
  ]
}

Return ALL candidate IDs in ranked_ids. Only include the top 5 most significant moves in adjustments. Keep reasons specific and concrete — reference actual profile data.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1536,
        system: PI_PERSONA,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await response.json();
    const rawText = claudeData.content?.[0]?.text ?? '';
    const tokensUsed = (claudeData.usage?.input_tokens ?? 0) + (claudeData.usage?.output_tokens ?? 0);

    let result: any = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {}

    if (!result?.ranked_ids || !Array.isArray(result.ranked_ids)) {
      return jsonResponse({
        ranked_ids: resolvedCandidateIds,
        adjustments: [],
        fallback: true,
      });
    }

    const validIds = new Set(resolvedCandidateIds);
    result.ranked_ids = result.ranked_ids.filter((id: string) => validIds.has(id));
    const missingIds = resolvedCandidateIds.filter((id: string) => !result.ranked_ids.includes(id));
    result.ranked_ids = [...result.ranked_ids, ...missingIds];
    result.adjustments = (result.adjustments || []).slice(0, 5);

    await Promise.all([
      supabase.from('pi_deck_rankings').insert({
        user_id: user.id,
        ranked_user_ids: result.ranked_ids,
        adjustments: result.adjustments,
        candidate_count: resolvedCandidateIds.length,
        model_used: 'claude-sonnet-4-5',
      }),
      supabase.from('pi_usage_log').insert({
        user_id: user.id,
        feature: 'deck_rerank',
        tokens_used: tokensUsed,
        model_used: 'claude-sonnet-4-5',
      }),
    ]);

    return jsonResponse({
      ranked_ids: result.ranked_ids,
      adjustments: result.adjustments,
      cached: false,
    });
  } catch (err: any) {
    console.error('pi-rerank-deck error:', err);
    return errorResponse('Reranking failed — try again shortly', 500);
  }
});

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
