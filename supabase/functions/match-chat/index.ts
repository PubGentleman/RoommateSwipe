import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function generateFallbackAnswer(
  question: string,
  myProfile: any,
  targetProfile: any,
  matchScore: any
): string {
  const name = targetProfile?.first_name || 'this person';
  const q = question.toLowerCase();
  const score = matchScore?.overall_score;

  if (q.includes('compatible') || q.includes('match') || q.includes('good fit')) {
    const parts: string[] = [];
    if (score) parts.push(`Your compatibility score with ${name} is ${score}%.`);
    if (myProfile?.budget_min && targetProfile?.budget_min) {
      const budgetOverlap = myProfile.budget_max >= targetProfile.budget_min && targetProfile.budget_max >= myProfile.budget_min;
      parts.push(budgetOverlap
        ? `Your budgets overlap ($${myProfile.budget_min}-$${myProfile.budget_max} vs $${targetProfile.budget_min}-$${targetProfile.budget_max}).`
        : `Your budgets don't overlap well ($${myProfile.budget_min}-$${myProfile.budget_max} vs $${targetProfile.budget_min}-$${targetProfile.budget_max}).`);
    }
    if (myProfile?.sleep_schedule && targetProfile?.sleep_schedule) {
      parts.push(myProfile.sleep_schedule === targetProfile.sleep_schedule
        ? `You both have ${myProfile.sleep_schedule} sleep schedules.`
        : `Sleep schedules differ: you're ${myProfile.sleep_schedule}, ${name} is ${targetProfile.sleep_schedule}.`);
    }
    return parts.join(' ') || `Based on available data, ${name} could be a match worth exploring.`;
  }

  if (q.includes('red flag') || q.includes('concern') || q.includes('worry') || q.includes('dealbreaker')) {
    const concerns: string[] = [];
    if (myProfile?.cleanliness_level && targetProfile?.cleanliness_level) {
      const diff = Math.abs(myProfile.cleanliness_level - targetProfile.cleanliness_level);
      if (diff >= 2) concerns.push(`cleanliness expectations differ (you: ${myProfile.cleanliness_level}/5, ${name}: ${targetProfile.cleanliness_level}/5)`);
    }
    if (myProfile?.noise_level && targetProfile?.noise_level) {
      const diff = Math.abs(myProfile.noise_level - targetProfile.noise_level);
      if (diff >= 2) concerns.push(`noise preferences differ (you: ${myProfile.noise_level}/5, ${name}: ${targetProfile.noise_level}/5)`);
    }
    if (myProfile?.smoking_preference && targetProfile?.smoking_preference && myProfile.smoking_preference !== targetProfile.smoking_preference) {
      concerns.push(`smoking preferences differ (you: ${myProfile.smoking_preference}, ${name}: ${targetProfile.smoking_preference})`);
    }
    return concerns.length > 0
      ? `Potential concerns: ${concerns.join('; ')}.`
      : `No obvious red flags based on ${name}'s profile data. Their cleanliness is ${targetProfile?.cleanliness_level || '?'}/5 and noise level is ${targetProfile?.noise_level || '?'}/5.`;
  }

  if (q.includes('schedule') || q.includes('sleep') || q.includes('routine')) {
    return `${name}'s sleep schedule is ${targetProfile?.sleep_schedule || 'not specified'}, work style is ${targetProfile?.work_style || 'not specified'}. ${myProfile?.sleep_schedule === targetProfile?.sleep_schedule ? 'You share similar schedules.' : 'Your schedules differ, which is worth discussing.'}`;
  }

  if (q.includes('common') || q.includes('share') || q.includes('similar')) {
    const shared: string[] = [];
    if (myProfile?.sleep_schedule === targetProfile?.sleep_schedule) shared.push(`${myProfile.sleep_schedule} sleep schedules`);
    if (myProfile?.work_style === targetProfile?.work_style) shared.push(`${myProfile.work_style} work styles`);
    if (myProfile?.guest_preference === targetProfile?.guest_preference) shared.push(`similar guest preferences`);
    if (myProfile?.pet_preference === targetProfile?.pet_preference) shared.push(`same pet preferences`);
    return shared.length > 0
      ? `You and ${name} share: ${shared.join(', ')}.`
      : `Based on profiles, you and ${name} have different preferences in most categories, but that's not necessarily a dealbreaker.`;
  }

  if (q.includes('message') || q.includes('say') || q.includes('start') || q.includes('draft')) {
    const topics: string[] = [];
    if (targetProfile?.occupation) topics.push(`their work as ${targetProfile.occupation}`);
    if (targetProfile?.neighborhoods?.length) topics.push(`the ${targetProfile.neighborhoods[0]} area`);
    if (targetProfile?.bio) topics.push('something from their bio');
    return `Try opening with something specific about ${topics.length > 0 ? topics[0] : `${name}'s profile`}. People respond better to personalized messages than generic greetings.`;
  }

  if (q.includes('budget') || q.includes('price') || q.includes('rent') || q.includes('afford')) {
    return `${name}'s budget range is $${targetProfile?.budget_min || '?'}-$${targetProfile?.budget_max || '?'}/mo. ${myProfile?.budget_min ? `Yours is $${myProfile.budget_min}-$${myProfile.budget_max}/mo.` : ''}`;
  }

  const details: string[] = [];
  if (targetProfile?.occupation) details.push(`works as ${targetProfile.occupation}`);
  if (targetProfile?.sleep_schedule) details.push(`${targetProfile.sleep_schedule} schedule`);
  if (targetProfile?.cleanliness_level) details.push(`cleanliness ${targetProfile.cleanliness_level}/5`);
  if (targetProfile?.budget_min) details.push(`budget $${targetProfile.budget_min}-$${targetProfile.budget_max}`);
  if (score) details.push(`${score}% compatible with you`);
  return `Here's what I know about ${name}: ${details.join(', ') || 'limited profile data available'}. Try asking something more specific for a better answer.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ reply: 'Please sign in to use this feature.' }), {
        headers: corsHeaders,
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ reply: 'Please sign in to use this feature.' }), {
        headers: corsHeaders,
      });
    }

    const body = await req.json();
    const question = body.question || body.userMessage || '';
    const matchedUserId = body.matchedUserId || body.targetProfileId || '';
    const conversationHistory = body.conversationHistory || [];
    const entryPoint = body.entryPoint || '';

    if (!matchedUserId || !question) {
      return new Response(JSON.stringify({
        reply: 'Ask me anything about this person and I\'ll help you figure out if they\'d be a good roommate.',
      }), { headers: corsHeaders });
    }

    const currentUserId = body.currentUserId || user.id;

    const [{ data: myProfile }, { data: targetProfile }] = await Promise.all([
      supabase
        .from('profiles')
        .select(`
          first_name, age, occupation, bio,
          sleep_schedule, cleanliness_level, noise_level,
          guest_preference, work_style, smoking_preference,
          pet_preference, dealbreakers, personality_answers,
          budget_min, budget_max, move_in_date,
          neighborhoods, instagram_verified
        `)
        .eq('user_id', currentUserId)
        .single(),
      supabase
        .from('profiles')
        .select(`
          first_name, age, occupation, bio,
          sleep_schedule, cleanliness_level, noise_level,
          guest_preference, work_style, smoking_preference,
          pet_preference, personality_answers,
          budget_min, budget_max, move_in_date,
          neighborhoods, instagram_verified,
          profile_note
        `)
        .eq('user_id', matchedUserId)
        .single(),
    ]);

    const { data: matchScore } = await supabase
      .from('match_scores')
      .select('overall_score, category_scores, explanation')
      .eq('user_id', currentUserId)
      .eq('target_user_id', matchedUserId)
      .single();

    let recentMessages = '';
    if (entryPoint === 'chat_screen') {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${currentUserId},user2_id.eq.${matchedUserId}),and(user1_id.eq.${matchedUserId},user2_id.eq.${currentUserId})`
        )
        .single();

      if (conversation) {
        const { data: messages } = await supabase
          .from('messages')
          .select('sender_id, content, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (messages && messages.length > 0) {
          recentMessages = messages
            .reverse()
            .map(m => `${m.sender_id === currentUserId ? myProfile?.first_name : targetProfile?.first_name}: ${m.content}`)
            .join('\n');
        }
      }
    }

    const compatibilityContext = matchScore
      ? `Compatibility score: ${matchScore.overall_score}%${matchScore.category_scores ? `. Breakdown: ${JSON.stringify(matchScore.category_scores)}` : ''}`
      : 'Compatibility score: not yet calculated';

    const myProfileSummary = myProfile ? `
USER'S OWN PROFILE (${myProfile.first_name}):
- Age: ${myProfile.age}, Occupation: ${myProfile.occupation}
- Budget: $${myProfile.budget_min}-$${myProfile.budget_max}/mo
- Sleep: ${myProfile.sleep_schedule}, Cleanliness: ${myProfile.cleanliness_level}/5
- Noise: ${myProfile.noise_level}/5, Guests: ${myProfile.guest_preference}
- Work style: ${myProfile.work_style}
- Smoking: ${myProfile.smoking_preference}, Pets: ${myProfile.pet_preference}
- Dealbreakers: ${myProfile.dealbreakers?.join(', ') || 'none'}
- Neighborhoods: ${myProfile.neighborhoods?.join(', ') || 'flexible'}
- Move-in: ${myProfile.move_in_date || 'flexible'}
- Bio: ${myProfile.bio || 'none'}`.trim() : '';

    const targetProfileSummary = targetProfile ? `
PROFILE BEING ASKED ABOUT (${targetProfile.first_name}):
- Age: ${targetProfile.age}, Occupation: ${targetProfile.occupation}
- Budget: $${targetProfile.budget_min}-$${targetProfile.budget_max}/mo
- Sleep: ${targetProfile.sleep_schedule}, Cleanliness: ${targetProfile.cleanliness_level}/5
- Noise: ${targetProfile.noise_level}/5, Guests: ${targetProfile.guest_preference}
- Work style: ${targetProfile.work_style}
- Smoking: ${targetProfile.smoking_preference}, Pets: ${targetProfile.pet_preference}
- Neighborhoods: ${targetProfile.neighborhoods?.join(', ') || 'flexible'}
- Move-in: ${targetProfile.move_in_date || 'flexible'}
- Bio: ${targetProfile.bio || 'none'}
- Instagram verified: ${targetProfile.instagram_verified ? 'yes' : 'no'}${targetProfile.profile_note ? `\n- In their own words: "${targetProfile.profile_note}"` : ''}`.trim() : '';

    const entryPointContext: Record<string, string> = {
      swipe_card: `The user is currently viewing ${targetProfile?.first_name}'s profile on the swipe screen and hasn't decided whether to like or pass yet.`,
      match_screen: `The user has just matched with ${targetProfile?.first_name} and is deciding whether to send the first message.`,
      chat_screen: `The user is currently in an active conversation with ${targetProfile?.first_name}.${recentMessages ? `\n\nRecent messages:\n${recentMessages}` : ''}`,
    };

    const systemPrompt = `You are Rhome AI, a smart roommate matching assistant. A user is asking you about a specific person they're considering as a roommate.

${entryPointContext[entryPoint] || ''}

${myProfileSummary}

${targetProfileSummary}

${compatibilityContext}

YOUR ROLE:
- Answer questions about compatibility honestly — including concerns, not just positives
- Help the user think through whether this could be a good match
- Suggest specific questions they could ask the person directly
- If in chat context, help draft messages or navigate awkward topics
- Be conversational and direct — not a formal report
- Never reveal exact private data (handle, phone, specific address) that should stay private
- Keep responses concise — 2-3 sentences unless a longer answer is genuinely needed
- Use the person's first name naturally (${targetProfile?.first_name})
- If the profile has an "In their own words" note, treat it as the most authentic source of information about this person

Do NOT be a yes-machine. If there's a real compatibility concern based on the data, say so clearly.`;

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...conversationHistory,
      { role: 'user', content: question },
    ];

    let reply: string;

    try {
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!apiKey) throw new Error('No API key');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: systemPrompt,
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`Claude returned ${response.status}`);

      const aiResponse = await response.json();
      reply = aiResponse.content?.[0]?.type === 'text' ? aiResponse.content[0].text : '';
    } catch (aiError) {
      console.error('Claude API error in match-chat, using fallback:', aiError);
      reply = generateFallbackAnswer(question, myProfile, targetProfile, matchScore);
    }

    if (!reply) {
      reply = generateFallbackAnswer(question, myProfile, targetProfile, matchScore);
    }

    return new Response(JSON.stringify({
      reply,
      targetName: targetProfile?.first_name,
      compatibilityScore: matchScore?.overall_score || null,
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('match-chat error:', error);
    return new Response(JSON.stringify({
      reply: 'I can still help based on the profile data available. Try asking about compatibility, budget, schedule, or what you have in common.',
      targetName: null,
      compatibilityScore: null,
    }), { headers: corsHeaders });
  }
});
