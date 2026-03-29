import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  serializeFullContext, CORS_HEADERS, errorResponse, jsonResponse,
  PI_MATCH_INSIGHT_PERSONA,
} from '../_shared/pi-utils.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RENTER_DAILY_LIMITS: Record<string, number> = {
  free: 5, basic: 5, plus: 50, elite: 200,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

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

    const userContext = serializeFullContext(userResult.data, userProfileResult.data, 'USER A (the person requesting this insight)');
    const targetContext = serializeFullContext(targetResult.data, targetProfileResult.data, 'USER B (potential roommate)');

    const breakdownText = scoreBreakdown
      ? `\nDETERMINISTIC SCORE BREAKDOWN:\n${typeof scoreBreakdown === 'object' ? Object.entries(scoreBreakdown).map(([k, v]) => `- ${k}: ${v}`).join('\n') : `Total: ${scoreBreakdown}`}`
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
        system: PI_MATCH_INSIGHT_PERSONA,
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
        match_score: typeof scoreBreakdown === 'number' ? scoreBreakdown : scoreBreakdown?.totalScore ?? null,
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
