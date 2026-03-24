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
  agent_pay_per_use: 5,
  agent_starter: 20,
  agent_pro: 100,
  agent_business: 500,
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
    const isAgent = plan.startsWith('agent_');
    const topMatches = isAgent ? [] : await getTopMatches(supabase, user.id);
    const nearbyListings = await getNearbyListings(supabase, profile);
    const history = await getConversationHistory(supabase, user.id, sessionId);
    const systemPrompt = isAgent
      ? buildAgentSystemPrompt(profile, nearbyListings, plan)
      : buildSystemPrompt(profile, topMatches, nearbyListings, plan);
    const aiResponse = await callClaude(systemPrompt, history, message);

    const cleanedResponse = await extractAndSaveProfileUpdate(supabase, user.id, aiResponse);
    await saveMessages(supabase, user.id, sessionId, message, cleanedResponse);
    await incrementUsage(supabase, user.id);

    return new Response(
      JSON.stringify({
        reply: cleanedResponse,
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
  const { data: userData } = await supabase
    .from('users')
    .select('host_type, agent_plan')
    .eq('id', userId)
    .single();

  if (userData?.host_type === 'agent' && userData?.agent_plan) {
    return `agent_${userData.agent_plan}`;
  }

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
  const { data: userData } = await supabase
    .from('users')
    .select('full_name, age, occupation, bio, city, neighborhood, zodiac_sign')
    .eq('id', userId)
    .single();

  const { data: profileData } = await supabase
    .from('profiles')
    .select(`
      budget_min, budget_max,
      move_in_date, lease_duration,
      cleanliness, noise_tolerance, sleep_schedule,
      smoking, drinking, pets, interests,
      room_type, desired_bedrooms,
      budget_per_person_max, preferred_trains,
      amenity_must_haves, apartment_prefs_complete
    `)
    .eq('user_id', userId)
    .single();

  return {
    name: userData?.full_name,
    age: userData?.age,
    occupation: userData?.occupation,
    bio: userData?.bio,
    city: userData?.city,
    neighborhood: userData?.neighborhood,
    zodiac_sign: userData?.zodiac_sign,
    budget_min: profileData?.budget_min,
    budget_max: profileData?.budget_max,
    move_in_date: profileData?.move_in_date,
    lease_duration: profileData?.lease_duration,
    cleanliness: profileData?.cleanliness,
    noise_tolerance: profileData?.noise_tolerance,
    sleep_schedule: profileData?.sleep_schedule,
    smoking: profileData?.smoking,
    drinking: profileData?.drinking,
    pets: profileData?.pets,
    interests: profileData?.interests,
    profile: profileData,
  };
}

async function getTopMatches(supabase: any, userId: string) {
  const { data: scores } = await supabase
    .from('match_scores')
    .select('target_id, score')
    .eq('user_id', userId)
    .gte('score', 60)
    .order('score', { ascending: false })
    .limit(5);

  if (!scores || scores.length === 0) return [];

  const targetIds = scores.map((s: any) => s.target_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, occupation, zodiac_sign')
    .in('id', targetIds);

  const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));

  return scores.map((s: any) => {
    const u = userMap.get(s.target_id);
    return {
      target_id: s.target_id,
      score: s.score,
      name: u?.full_name,
      occupation: u?.occupation,
      zodiac_sign: u?.zodiac_sign,
    };
  });
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
    .eq('is_active', true)
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

function getMissingFields(profile: any): string[] {
  const missing: string[] = [];

  if (!profile?.sleep_schedule)          missing.push('sleep_schedule');
  if (profile?.cleanliness == null)      missing.push('cleanliness');
  if (profile?.smoking == null)          missing.push('smoking');
  if (profile?.pets == null)             missing.push('pets');
  if (!profile?.move_in_date)            missing.push('move_in_date');
  if (!profile?.budget_max)              missing.push('budget_max');
  if (!profile?.room_type)              missing.push('room_type');

  if (!profile?.apartment_prefs_complete) {
    if (profile?.desired_bedrooms == null)      missing.push('desired_bedrooms');
    if (profile?.budget_per_person_max == null)  missing.push('budget_per_person_max');
    if (!profile?.preferred_trains?.length)      missing.push('preferred_trains');
    if (!profile?.amenity_must_haves?.length)    missing.push('amenity_must_haves');
  }

  return missing;
}

function buildSystemPrompt(profile: any, topMatches: any[], listings: any[], plan: string): string {
  const matchSummary = topMatches.length > 0
    ? topMatches.map((m: any) =>
        `${m.name ?? 'Unknown'} (${m.score}% match, ${m.occupation ?? 'unknown occupation'}, ${m.zodiac_sign ?? 'unknown sign'})`
      ).join('; ')
    : 'no top matches yet';

  const listingSummary = listings.length > 0
    ? listings.map((l: any) =>
        `"${l.title}" — $${l.price}/mo, ${l.type}, ${l.bedrooms}bd/${l.bathrooms}ba in ${l.neighborhood}${l.is_featured ? ' (featured)' : ''}`
      ).join('; ')
    : 'no listings in their price range right now';

  const missingFields = getMissingFields(profile.profile);

  const missingFieldGuide: Record<string, string> = {
    sleep_schedule:         'Ask what time they usually wake up and go to sleep on weekdays.',
    cleanliness:            'Ask how clean they keep their living space on a scale of 1-10.',
    smoking:                'Ask if they smoke or are okay with a roommate who does.',
    pets:                   'Ask if they have any pets or are okay living with pets.',
    move_in_date:           'Ask when they are looking to move in.',
    budget_max:             'Ask what their monthly budget is for rent.',
    room_type:              'Ask if they want a private room or are okay with a shared room.',
    desired_bedrooms:       'Ask how many bedrooms they want in the apartment.',
    budget_per_person_max:  'Ask the maximum they can pay per person per month.',
    preferred_trains:       'Ask which subway lines they need to be near for work or daily life. In NYC, this is crucial.',
    amenity_must_haves:     'Ask what apartment features are must-haves for them (laundry, dishwasher, doorman, outdoor space, etc.).',
  };

  const priorityOrder = [
    'budget_max', 'move_in_date', 'sleep_schedule', 'cleanliness',
    'smoking', 'pets', 'preferred_trains', 'desired_bedrooms',
    'budget_per_person_max', 'amenity_must_haves', 'room_type'
  ];
  const sortedMissing = missingFields.sort((a, b) =>
    priorityOrder.indexOf(a) - priorityOrder.indexOf(b)
  );

  const missingFieldInstructions = sortedMissing.length > 0
    ? `
INCOMPLETE PROFILE — COLLECT MISSING INFO:
The user is missing the following profile data: ${sortedMissing.join(', ')}.

During this conversation, naturally work in ONE question about a missing field.
Do not ask multiple questions at once — pick the most important missing field
and weave the question into your response naturally.

When you ask about a missing field, use this guidance:
${sortedMissing.slice(0, 3).map(f => `- ${f}: ${missingFieldGuide[f]}`).join('\n')}

CRITICAL: When the user answers a question about their profile, extract the data
and include it at the END of your response in this exact format (hidden from display):

<profile_update>
{
  "field": "sleep_schedule",
  "value": "night_owl"
}
</profile_update>

Only include ONE profile_update per response. Only include it when the user
has clearly answered a profile question. Never include it for general conversation.

Valid values for each field:
- sleep_schedule: "early_bird" | "night_owl" | "flexible"
- cleanliness: number 1-10
- smoking: true | false
- pets: "yes" | "no" | "ok_with_pets"
- move_in_date: "YYYY-MM-DD" format
- budget_max: number (monthly rent in dollars)
- room_type: "private" | "shared" | "either"
- desired_bedrooms: number (0 for studio, 1, 2, 3, 4)
- budget_per_person_max: number (per person per month)
- preferred_trains: array of NYC subway line letters/numbers e.g. ["N", "W", "7"]
- amenity_must_haves: array of strings e.g. ["In-unit laundry", "Dishwasher", "Elevator"]
`
    : `
PROFILE COMPLETE — The user has filled in all key profile fields.
Do not ask profile questions. Focus on helping them find roommates and apartments.
`;

  let systemPrompt = `You are the AI assistant inside Rhome, a roommate matching app. Your name is Rhome AI.

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
Budget: $${profile.budget_min ?? '?'}-$${profile.budget_max ?? '?'}/mo
Looking in: ${profile.neighborhood ?? profile.city ?? 'New York'}
Move-in: ${profile.move_in_date ?? 'flexible'}
Zodiac: ${profile.zodiac_sign ?? 'unknown'}
Interests: ${profile.interests?.join(', ') ?? 'not set'}
Pets: ${profile.pets ?? 'none'}
Cleanliness: ${profile.cleanliness ?? '?'}/5, Sleep: ${profile.sleep_schedule ?? '?'}, Noise tolerance: ${profile.noise_tolerance ?? '?'}/5

THEIR TOP MATCHES RIGHT NOW: ${matchSummary}

LISTINGS IN THEIR BUDGET: ${listingSummary}

PLAN: ${plan}

Only reference listings and matches that are listed above — never make up names or prices.
If they ask about someone not in the matches list, say you don't have info on that person yet.`;

  systemPrompt += missingFieldInstructions;

  return systemPrompt;
}

function buildAgentSystemPrompt(profile: any, listings: any[], plan: string): string {
  const listingSummary = listings.length > 0
    ? listings.map((l: any) =>
        `"${l.title}" — $${l.price}/mo, ${l.type}, ${l.bedrooms}bd/${l.bathrooms}ba in ${l.neighborhood}${l.is_featured ? ' (featured)' : ''}`
      ).join('; ')
    : 'no active listings found';

  return `You are the AI assistant inside Rhome, a roommate matching app. You are speaking to a REAL ESTATE AGENT or LANDLORD who uses the Agent Matchmaker feature. Your name is Rhome AI.

Your personality: professional but approachable — like a sharp analyst who happens to know everything about roommate group dynamics and compatibility. You're not a corporate chatbot. You're direct and data-driven. You give actionable advice.

IMPORTANT STYLE RULES:
- Write like a professional colleague, not a customer service bot
- Keep responses concise: 2-5 sentences unless they ask for detail
- Never use bullet points or numbered lists — write in natural sentences
- Never say things like "Certainly!", "Great question!", "I'd be happy to help!"
- Give real opinions: if a group pairing seems weak, say so
- Suggest concrete next steps when appropriate

WHAT YOU KNOW ABOUT THIS AGENT:
Name: ${profile.name ?? 'the agent'}
City: ${profile.city ?? 'unknown'}
Plan: ${plan.replace('agent_', '')}

THEIR ACTIVE LISTINGS: ${listingSummary}

WHAT YOU CAN HELP WITH:
- Evaluating renter compatibility for group formation
- Suggesting optimal group compositions based on lifestyle and budget
- Advising on pricing and rent-share calculations
- Tips for writing compelling group invite messages
- Market insights for their city
- Best practices for the placement pipeline

Only reference listings that are listed above — never make up data.
Focus on actionable advice that helps the agent close placements faster.`;
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
      max_tokens: 500,
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

async function extractAndSaveProfileUpdate(
  supabase: any,
  userId: string,
  aiResponse: string
): Promise<string> {
  const match = aiResponse.match(/<profile_update>([\s\S]*?)<\/profile_update>/);
  const cleanedResponse = aiResponse.replace(/<profile_update>[\s\S]*?<\/profile_update>/, '').trim();
  if (!match) return cleanedResponse;

  try {
    const update = JSON.parse(match[1].trim());
    const { field, value } = update;

    if (!field || value === undefined) return cleanedResponse;

    const fieldMap: Record<string, string> = {
      sleep_schedule:        'sleep_schedule',
      cleanliness:           'cleanliness',
      smoking:               'smoking',
      pets:                  'pets',
      move_in_date:          'move_in_date',
      budget_max:            'budget_max',
      room_type:             'room_type',
      desired_bedrooms:      'desired_bedrooms',
      budget_per_person_max: 'budget_per_person_max',
      preferred_trains:      'preferred_trains',
      amenity_must_haves:    'amenity_must_haves',
    };

    const dbColumn = fieldMap[field];
    if (!dbColumn) return cleanedResponse;

    const apartmentPrefFields = [
      'desired_bedrooms', 'budget_per_person_max',
      'preferred_trains', 'amenity_must_haves'
    ];

    if (apartmentPrefFields.includes(field)) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('desired_bedrooms, budget_per_person_max, preferred_trains, amenity_must_haves')
        .eq('user_id', userId)
        .single();

      const updatedProfile = { ...currentProfile, [dbColumn]: value };
      const allPrefsComplete =
        updatedProfile.desired_bedrooms != null &&
        updatedProfile.budget_per_person_max != null &&
        updatedProfile.preferred_trains?.length > 0 &&
        updatedProfile.amenity_must_haves?.length > 0;

      await supabase
        .from('profiles')
        .update({
          [dbColumn]: value,
          ...(allPrefsComplete ? { apartment_prefs_complete: true } : {}),
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('profiles')
        .update({ [dbColumn]: value })
        .eq('user_id', userId);
    }

    console.log(`[AI] Profile updated: ${field} = ${JSON.stringify(value)} for user ${userId}`);
  } catch (e) {
    console.warn('[AI] Failed to parse/save profile update:', e);
  }

  return cleanedResponse;
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
