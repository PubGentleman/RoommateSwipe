import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { targetProfileId, userMessage, conversationHistory, entryPoint } = await req.json();

    if (!targetProfileId || !userMessage) {
      return new Response(JSON.stringify({ error: 'Missing targetProfileId or userMessage' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        .eq('user_id', user.id)
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
        .eq('user_id', targetProfileId)
        .single(),
    ]);

    const { data: aiMemory } = await supabase
      .from('user_ai_memory')
      .select('memory_text')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: matchScore } = await supabase
      .from('match_scores')
      .select('overall_score, category_scores, explanation')
      .eq('user_id', user.id)
      .eq('target_user_id', targetProfileId)
      .single();

    let recentMessages = '';
    if (entryPoint === 'chat_screen') {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${targetProfileId}),and(user1_id.eq.${targetProfileId},user2_id.eq.${user.id})`
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
            .map(m => `${m.sender_id === user.id ? myProfile?.first_name : targetProfile?.first_name}: ${m.content}`)
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

    const memoryContext = aiMemory?.map(m => m.memory_text).join('\n') || '';

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

What you know about the user from memory:
${memoryContext}

YOUR ROLE:
- Answer questions about compatibility honestly — including concerns, not just positives
- Help the user think through whether this could be a good match
- Suggest specific questions they could ask the person directly
- If in chat context, help draft messages or navigate awkward topics
- Be conversational and direct — not a formal report
- Never reveal exact private data (handle, phone, specific address) that should stay private
- Keep responses concise — 2-4 sentences unless a longer answer is genuinely needed
- Use the person's first name naturally (${targetProfile?.first_name})
- If the profile has an "In their own words" note, treat it as the most authentic source of information about this person — they wrote it themselves to describe how they actually live. Reference it directly when answering questions about their habits or vibe.
- Distinguish between structured profile data (what they answered in the questionnaire) and their personal note (what they chose to say in their own voice). The note often has nuance the questionnaire misses.

Do NOT be a yes-machine. If there's a real compatibility concern based on the data, say so clearly.`;

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(conversationHistory || []),
      { role: 'user', content: userMessage },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return new Response(JSON.stringify({
      reply,
      targetName: targetProfile?.first_name,
      compatibilityScore: matchScore?.overall_score || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ai-ask-about-profile error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Content-Type': 'application/json',
      },
    });
  }
});
