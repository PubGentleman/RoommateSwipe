import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PI_PERSONA = `You are Pi, Rhome's AI matchmaker. You're reading someone's free-text description of their ideal roommate situation and extracting structured preferences. Be generous in interpretation — people express preferences in many ways. "I need my beauty sleep" means early sleeper. "I throw dinner parties" means frequent guests. "No drama" might signal preference for a respectful/parallel roommate relationship. Extract everything you can, but never fabricate preferences that aren't implied.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await req.json();
    const text = body.text;
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return errorResponse('Text must be at least 10 characters', 400);
    }

    const trimmedText = text.length > 1000 ? text.substring(0, 1000) : text;

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const plan = sub?.plan || 'free';
    const RENTER_DAILY_LIMITS: Record<string, number> = { free: 5, basic: 5, plus: 50, elite: 200 };
    const dailyLimit = RENTER_DAILY_LIMITS[plan] ?? 5;

    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('pi_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'parse_preferences')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count ?? 0) >= dailyLimit) {
      return errorResponse('Daily Pi limit reached.', 429);
    }

    const prompt = `The user wrote this about their ideal roommate/living situation:

"${trimmedText}"

Extract structured preferences from this free text. Be thorough but only extract what's actually implied or stated. For each field, use null if the text doesn't give any signal.

Respond with ONLY this JSON:
{
  "vibe": "one-word or short phrase capturing the overall energy (e.g., 'chill', 'social-but-respectful', 'studious-and-quiet', 'active-and-outgoing')",
  "schedule_hints": ["any time-related preferences, e.g., 'early riser', 'works nights', '9-5 schedule'"],
  "social_style": "introvert/extrovert/ambivert/null based on signals",
  "hard_nos": ["absolute dealbreakers mentioned, e.g., 'no smoking', 'no parties', 'no pets'"],
  "soft_preferences": ["nice-to-haves that aren't dealbreakers, e.g., 'prefers someone who cooks', 'likes movie nights'"],
  "personality_signals": ["inferred personality traits, e.g., 'organized', 'creative', 'easy-going'"],
  "cleanliness_hints": "any cleanliness-related signals (e.g., 'neat freak', 'clean but not obsessive', null)",
  "noise_hints": "noise preference signals (e.g., 'needs quiet for work', 'doesn't mind noise', null)",
  "guest_hints": "guest policy signals (e.g., 'loves hosting', 'prefers no overnight guests', null)",
  "budget_hints": "any budget signals (e.g., 'looking to save money', 'willing to pay more for quality', null)",
  "location_hints": ["any location preferences mentioned, e.g., 'near the L train', 'wants to be in Brooklyn'"],
  "diet_hints": "any food/diet signals (e.g., 'vegan', 'loves cooking together', null)",
  "work_style_hints": "WFH/office/hybrid signals (e.g., 'works from home', 'gone all day', null)"
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

    let parsed: any = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {}

    if (!parsed) {
      return errorResponse('Could not parse preferences from text', 500);
    }

    const cleanParsed = {
      vibe: parsed.vibe || null,
      schedule_hints: Array.isArray(parsed.schedule_hints) ? parsed.schedule_hints : [],
      social_style: parsed.social_style || null,
      hard_nos: Array.isArray(parsed.hard_nos) ? parsed.hard_nos : [],
      soft_preferences: Array.isArray(parsed.soft_preferences) ? parsed.soft_preferences : [],
      personality_signals: Array.isArray(parsed.personality_signals) ? parsed.personality_signals : [],
      cleanliness_hints: parsed.cleanliness_hints || null,
      noise_hints: parsed.noise_hints || null,
      guest_hints: parsed.guest_hints || null,
      budget_hints: parsed.budget_hints || null,
      location_hints: Array.isArray(parsed.location_hints) ? parsed.location_hints : [],
      diet_hints: parsed.diet_hints || null,
      work_style_hints: parsed.work_style_hints || null,
    };

    await Promise.all([
      supabase
        .from('profiles')
        .update({
          ideal_roommate_text: trimmedText,
          pi_parsed_preferences: cleanParsed,
        })
        .eq('user_id', user.id),
      supabase.from('pi_usage_log').insert({
        user_id: user.id,
        feature: 'parse_preferences',
        tokens_used: tokensUsed,
        model_used: 'claude-haiku-4-5-20251001',
      }),
    ]);

    return jsonResponse({
      parsed: cleanParsed,
      text_saved: true,
    });
  } catch (err: any) {
    console.error('pi-parse-preferences error:', err);
    return errorResponse('Preference parsing failed', 500);
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
