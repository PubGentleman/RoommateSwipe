import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DAILY_LIMITS: Record<string, number> = {
  free: 5,
  basic: 5,
  plus: 50,
  elite: 200,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return errorResponse('Unauthorized', 401);

    const { message, sessionId } = await req.json();
    if (!message?.trim()) return errorResponse('Message is required', 400);

    const plan = await getUserPlan(supabase, user.id);
    const dailyLimit = DAILY_LIMITS[plan] ?? 5;
    const todayCount = await getUsageCount(supabase, user.id);
    if (todayCount >= dailyLimit) {
      return errorResponse(
        plan === 'free' || plan === 'basic'
          ? `Free plan limit reached (${dailyLimit}/day). Upgrade to Plus for 50 messages/day.`
          : `Daily limit reached (${dailyLimit} messages).`,
        429
      );
    }

    const profile = await getUserProfile(supabase, user.id);
    const topMatches = await getTopMatches(supabase, user.id, profile.city);
    const nearbyListings = await getNearbyListings(supabase, profile);
    const history = await getConversationHistory(supabase, user.id, sessionId);
    const systemPrompt = buildSystemPrompt(profile, topMatches, nearbyListings, plan);
    const aiResponse = await callOpenAI(systemPrompt, history, message);

    await saveMessages(supabase, user.id, sessionId, message, aiResponse);
    await incrementUsage(supabase, user.id);

    return new Response(
      JSON.stringify({
        reply: aiResponse,
        remainingMessages: dailyLimit - todayCount - 1,
        plan,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('AI Assistant error:', err);
    return errorResponse('Something went wrong. Please try again.', 500);
  }
});

async function getUserPlan(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return data?.plan ?? 'free';
}

async function getUsageCount(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from('ai_usage')
    .select('message_count')
    .eq('user_id', userId)
    .eq('date', new Date().toISOString().split('T')[0])
    .single();
  return data?.message_count ?? 0;
}

async function getUserProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select(`
      name, age, occupation, bio,
      city, neighborhoods,
      budget_min, budget_max,
      move_in_date, lease_length,
      lifestyle_tags, dealbreakers,
      zodiac_sign, has_pets, pet_types,
      cleanliness, noise_level, sleep_schedule,
      smoking, drinking
    `)
    .eq('id', userId)
    .single();
  return data ?? {};
}

async function getTopMatches(supabase: any, userId: string, city: string) {
  const { data } = await supabase
    .from('match_scores')
    .select('target_id, score, profiles!target_id(name, occupation, budget_min, budget_max, zodiac_sign)')
    .eq('user_id', userId)
    .gte('score', 60)
    .order('score', { ascending: false })
    .limit(5);
  return data ?? [];
}

async function getNearbyListings(supabase: any, profile: any) {
  if (!profile.city) return [];
  const { data } = await supabase
    .from('listings')
    .select('title, price, type, neighborhood, bedrooms, bathrooms, is_featured')
    .eq('city', profile.city)
    .gte('price', profile.budget_min ?? 0)
    .lte('price', profile.budget_max ?? 999999)
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .limit(5);
  return data ?? [];
}

async function getConversationHistory(supabase: any, userId: string, sessionId: string) {
  const { data } = await supabase
    .from('ai_conversations')
    .select('role, content')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(12);
  return (data ?? []).reverse();
}

function buildSystemPrompt(profile: any, topMatches: any[], listings: any[], plan: string): string {
  const matchSummary = topMatches.length > 0
    ? topMatches.map((m: any) =>
        `  - ${m.profiles?.name ?? 'Unknown'} -- ${m.score}% match, ${m.profiles?.occupation ?? ''}, $${m.profiles?.budget_min}-$${m.profiles?.budget_max}/mo, ${m.profiles?.zodiac_sign ?? ''}`
      ).join('\n')
    : '  No top matches yet.';

  const listingSummary = listings.length > 0
    ? listings.map((l: any) =>
        `  - "${l.title}" -- $${l.price}/mo, ${l.type}, ${l.bedrooms}bd/${l.bathrooms}ba, ${l.neighborhood}${l.is_featured ? ' (Featured)' : ''}`
      ).join('\n')
    : '  No listings in their budget range yet.';

  return `You are the AI Match Assistant for RoomDrx, a premium roommate matching app.
You are smart, warm, specific, and concise. Always reference the user's actual data -- never give generic advice.
Never make up listings or people -- only reference what's in the profile data below.

USER PROFILE:
  Name: ${profile.name ?? 'the user'}
  Age: ${profile.age ?? 'unknown'}
  Occupation: ${profile.occupation ?? 'unknown'}
  Budget: $${profile.budget_min ?? '?'}-$${profile.budget_max ?? '?'}/mo
  City: ${profile.city ?? 'New York'}
  Preferred neighborhoods: ${profile.neighborhoods?.join(', ') ?? 'no preference'}
  Move-in date: ${profile.move_in_date ?? 'flexible'}
  Lifestyle: ${profile.lifestyle_tags?.join(', ') ?? 'not set'}
  Dealbreakers: ${profile.dealbreakers?.join(', ') ?? 'none listed'}
  Zodiac: ${profile.zodiac_sign ?? 'unknown'}
  Pets: ${profile.has_pets ? `Yes (${profile.pet_types?.join(', ')})` : 'No'}
  Cleanliness: ${profile.cleanliness ?? 'not set'}/5
  Noise level: ${profile.noise_level ?? 'not set'}
  Sleep schedule: ${profile.sleep_schedule ?? 'not set'}
  Smoking: ${profile.smoking ? 'Yes' : 'No'} | Drinking: ${profile.drinking ?? 'not set'}

TOP MATCHES IN APP (${topMatches.length}):
${matchSummary}

LISTINGS IN THEIR BUDGET (${listings.length}):
${listingSummary}

PLAN: ${plan} -- ${plan === 'free' || plan === 'basic' ? 'limited features' : plan === 'plus' ? 'Plus features unlocked' : 'Elite features unlocked'}

CAPABILITIES -- you can help with:
- Roommate matching (reference their actual top matches above)
- Neighborhood advice (reference their preferred neighborhoods)
- Zodiac compatibility (use their zodiac sign and match zodiac signs)
- Budget analysis and listing recommendations (use actual listing data above)
- Move-in planning and lease tips
- Home decor and shared living advice
- Restaurant and activity recommendations near their neighborhoods

Keep responses under 120 words unless detail is specifically needed. Be conversational, not formal.`;
}

async function callOpenAI(systemPrompt: string, history: any[], userMessage: string): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h: any) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: 300,
      temperature: 0.75,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'Sorry, I had trouble responding. Please try again.';
}

async function saveMessages(
  supabase: any,
  userId: string,
  sessionId: string,
  userMessage: string,
  aiReply: string
) {
  await supabase.from('ai_conversations').insert([
    { user_id: userId, session_id: sessionId, role: 'user', content: userMessage },
    { user_id: userId, session_id: sessionId, role: 'assistant', content: aiReply },
  ]);
}

async function incrementUsage(supabase: any, userId: string) {
  const today = new Date().toISOString().split('T')[0];
  await supabase.rpc('increment_ai_usage', { p_user_id: userId, p_date: today });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
