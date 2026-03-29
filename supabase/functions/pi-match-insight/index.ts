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

const PI_PERSONA = `You are Pi, Rhome's AI matchmaker. You're warm, perceptive, and genuinely invested in helping people find their ideal living situation. You speak with quiet confidence — never salesy, never robotic. You notice the small things in profiles that algorithms miss: the night owl who also loves sunrise yoga, the neat freak who's actually just anxious about shared spaces. You're honest about concerns but always frame them constructively. Your tone is like a thoughtful friend who happens to be incredibly good at reading people.`;

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

function buildProfileContext(profile: any, user: any, label: string): string {
  const p = profile || {};
  const u = user || {};
  return `${label}:
- Name: ${stripPii(u.full_name)}
- Age: ${u.age || 'not specified'}
- Occupation: ${u.occupation || 'not specified'}
- City: ${u.city || 'not specified'}
- Neighborhood: ${u.neighborhood || 'not specified'}
- Zodiac: ${u.zodiac_sign || 'not specified'}
- Bio: ${trimText(u.bio)}
- Budget: $${p.budget_min || '?'}-$${p.budget_max || '?'}/month
- Per-person budget: $${p.budget_per_person_min || '?'}-$${p.budget_per_person_max || '?'}
- Move-in date: ${p.move_in_date || 'not specified'}
- Lease duration: ${p.lease_duration || 'not specified'}
- Room type: ${p.room_type || 'not specified'}
- Desired bedrooms: ${p.desired_bedrooms || 'not specified'}
- Sleep schedule: ${p.sleep_schedule || 'not specified'}
- Cleanliness: ${p.cleanliness ?? 'not specified'}/10
- Noise tolerance: ${p.noise_tolerance || 'not specified'}
- Smoking: ${p.smoking != null ? (p.smoking ? 'yes' : 'no') : 'not specified'}
- Drinking: ${p.drinking || 'not specified'}
- Pets: ${p.pets || 'not specified'}
- Guests: ${p.guests || 'not specified'}
- WFH: ${p.wfh != null ? (p.wfh ? 'yes' : 'no') : 'not specified'}
- Interests: ${(p.interests || []).join(', ') || 'none'}
- Lifestyle tags: ${(u.lifestyle_tags || p.lifestyle_tags || []).join(', ') || 'none'}
- Preferred trains: ${(p.preferred_trains || []).join(', ') || 'none'}
- Amenity must-haves: ${(p.amenity_must_haves || []).join(', ') || 'none'}
- Preferred neighborhoods: ${(p.preferred_neighborhoods || []).join(', ') || 'none'}
- Roommate relationship: ${p.roommate_relationship || 'not specified'}
- Shared expenses: ${p.shared_expenses || 'not specified'}
- Location flexible: ${p.location_flexible != null ? (p.location_flexible ? 'yes' : 'no') : 'not specified'}
- Diet: ${p.diet || 'not specified'}
- Profile note: ${trimText(p.profile_note)}
- Ideal roommate (free text): ${trimText(p.ideal_roommate_text)}
- Personality quiz: ${p.personality_quiz_answers ? JSON.stringify(p.personality_quiz_answers) : 'not taken'}
- Dealbreakers: ${(p.dealbreakers || []).join(', ') || 'none'}`;
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
    const targetUserId = body.target_user_id || body.targetUserId;
    const scoreBreakdown = body.match_score || body.scoreBreakdown;
    if (!targetUserId) return errorResponse('target_user_id is required', 400);

    const { data: cached } = await supabase
      .from('pi_match_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('target_user_id', targetUserId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (cached) {
      return jsonResponse({
        summary: cached.summary,
        highlights: cached.highlights,
        warnings: cached.warnings,
        confidence: cached.confidence,
        id: cached.id,
        cached: true,
      });
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
      .eq('feature', 'match_insight')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count ?? 0) >= dailyLimit) {
      return errorResponse(
        plan === 'free' || plan === 'basic'
          ? `Daily Pi limit reached (${dailyLimit}). Upgrade to Plus for more insights.`
          : `Daily Pi limit reached (${dailyLimit}).`,
        429
      );
    }

    const [userResult, targetResult, userProfileResult, targetProfileResult] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('users').select('*').eq('id', targetUserId).single(),
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('profiles').select('*').eq('user_id', targetUserId).single(),
    ]);

    if (!userResult.data || !targetResult.data) return errorResponse('Profiles not found', 404);

    const userContext = buildProfileContext(userProfileResult.data, userResult.data, 'USER A (the person requesting this insight)');
    const targetContext = buildProfileContext(targetProfileResult.data, targetResult.data, 'USER B (potential roommate)');

    const breakdownText = scoreBreakdown
      ? `\nDETERMINISTIC SCORE BREAKDOWN:\n${Object.entries(scoreBreakdown).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : '';

    const prompt = `${userContext}

${targetContext}
${breakdownText}

Analyze the compatibility between these two people as potential roommates. Go beyond the numbers — look at personality signals, lifestyle alignment, and the subtle dynamics that make or break a living situation.

Respond with ONLY this JSON:
{
  "summary": "2-4 sentences in Pi's warm, insightful voice explaining the match quality. Reference specific profile details. Be honest but constructive.",
  "highlights": ["3-5 specific positive compatibility points — concrete, not generic"],
  "warnings": ["0-3 honest concerns or potential friction points — be specific but kind"],
  "confidence": 0.0-1.0
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 768,
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

    if (!result?.summary) {
      result = {
        summary: 'I see some interesting compatibility signals here, but I\'d need more profile details to give you a full picture.',
        highlights: ['Both actively looking for a roommate'],
        warnings: [],
        confidence: 0.5,
      };
    }

    result.highlights = result.highlights || [];
    result.warnings = result.warnings || [];
    result.confidence = typeof result.confidence === 'number' ? Math.min(1, Math.max(0, result.confidence)) : 0.5;

    const [insertResult] = await Promise.all([
      supabase.from('pi_match_insights').insert({
        user_id: user.id,
        target_user_id: targetUserId,
        match_score: scoreBreakdown?.totalScore ?? null,
        summary: result.summary,
        highlights: result.highlights,
        warnings: result.warnings,
        confidence: result.confidence,
      }).select('id').single(),
      supabase.from('pi_usage_log').insert({
        user_id: user.id,
        feature: 'match_insight',
        tokens_used: tokensUsed,
        model_used: 'claude-haiku-4-5-20251001',
      }),
    ]);

    return jsonResponse({
      summary: result.summary,
      highlights: result.highlights,
      warnings: result.warnings,
      confidence: result.confidence,
      id: insertResult.data?.id,
      cached: false,
    });
  } catch (err: any) {
    console.error('pi-match-insight error:', err);
    return jsonResponse({
      summary: 'I\'m having a moment — couldn\'t analyze this match right now. Try again shortly.',
      highlights: [],
      warnings: [],
      confidence: 0,
      error: true,
    });
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
