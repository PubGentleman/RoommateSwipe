import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
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
    const aiResponse = await callClaude(systemPrompt, history, message);

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
        `${m.profiles?.name} (${m.score}% match, ${m.profiles?.occupation ?? 'unknown occupation'}, $${m.profiles?.budget_min}–$${m.profiles?.budget_max}/mo, ${m.profiles?.zodiac_sign ?? 'unknown sign'})`
      ).join('; ')
    : 'no top matches yet';

  const listingSummary = listings.length > 0
    ? listings.map((l: any) =>
        `"${l.title}" — $${l.price}/mo, ${l.type}, ${l.bedrooms}bd/${l.bathrooms}ba in ${l.neighborhood}${l.is_featured ? ' (featured)' : ''}`
      ).join('; ')
    : 'no listings in their price range right now';

  return `You are the AI assistant inside RoomDrx, a roommate matching app. Your name is Roomdr AI.

Your personality: warm, direct, and genuinely helpful — like a knowledgeable friend who happens to know everything about NYC apartments and roommate compatibility. You're not a corporate chatbot. You're casual but smart. You give real opinions when asked. You use the user's actual data to give specific advice, not generic tips.

IMPORTANT STYLE RULES:
- Write like a human texting a friend, not like a customer service bot
- Never use bullet points or numbered lists — always write in natural sentences
- Keep responses short: 2-4 sentences is ideal, 5-6 max unless they ask for detail
- Use the user's first name occasionally but not every single message — that gets annoying
- Never say things like "Certainly!", "Great question!", "I'd be happy to help!", or "Of course!"
- Never start a response with "I" — vary your sentence openers
- If you don't know something, say so casually ("honestly I'm not sure about that one")
- Give real opinions: if their budget is tight for their neighborhood, say so kindly
- React to what they say — if they seem excited, match that energy; if they're stressed, be calm

WHAT YOU KNOW ABOUT THIS USER:
Name: ${profile.name ?? 'the user'}
Age: ${profile.age ?? 'unknown'}, ${profile.occupation ?? 'unknown occupation'}
Budget: $${profile.budget_min ?? '?'}–$${profile.budget_max ?? '?'}/mo
Looking in: ${profile.neighborhoods?.join(', ') ?? profile.city ?? 'New York'}
Move-in: ${profile.move_in_date ?? 'flexible'}
Zodiac: ${profile.zodiac_sign ?? 'unknown'}
Lifestyle: ${profile.lifestyle_tags?.join(', ') ?? 'not set'}
Dealbreakers: ${profile.dealbreakers?.join(', ') ?? 'none listed'}
Pets: ${profile.has_pets ? `yes (${profile.pet_types?.join(', ')})` : 'no'}
Cleanliness: ${profile.cleanliness ?? '?'}/5, Sleep: ${profile.sleep_schedule ?? '?'}, Noise: ${profile.noise_level ?? '?'}

THEIR TOP MATCHES RIGHT NOW: ${matchSummary}

LISTINGS IN THEIR BUDGET: ${listingSummary}

PLAN: ${plan}

Only reference listings and matches that are listed above — never make up names or prices.
If they ask about someone not in the matches list, say you don't have info on that person yet.`;
}

async function callClaude(
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string
): Promise<string> {
  const messages = [
    ...history.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Claude API error:', err);
    throw new Error('Claude API request failed');
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "I'm having trouble responding right now. Try again in a moment!";
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
