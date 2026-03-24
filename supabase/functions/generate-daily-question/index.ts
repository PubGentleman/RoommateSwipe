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
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('daily_questions')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', now)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ question: existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: recentQuestions } = await supabase
      .from('daily_questions')
      .select('question_text, question_category')
      .eq('user_id', user.id)
      .not('selected_value', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(10);

    const { data: aiMemory } = await supabase
      .from('user_ai_memory')
      .select('memory_text')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentTopics = recentQuestions?.map(q => q.question_text).join('\n') || 'None yet';
    const memoryContext = aiMemory?.map(m => m.memory_text).join('\n') || '';

    const profileData = profile?.profile_data || {};
    const prefs = profileData?.preferences || {};
    const profileSummary = `
- Sleep: ${prefs.sleepSchedule || 'unknown'}
- Cleanliness: ${prefs.cleanliness || 'unknown'}
- Noise tolerance: ${prefs.noiseTolerance || 'unknown'}
- Guests: ${prefs.guestPolicy || 'unknown'}
- Work style: ${prefs.workLocation || 'unknown'}
- Smoking: ${prefs.smoking || 'unknown'}
- Pets: ${prefs.pets || 'unknown'}
- Dealbreakers: ${profileData.dealbreakers?.join(', ') || 'none specified'}
- Personality: ${profileData.personalityAnswers ? JSON.stringify(profileData.personalityAnswers) : 'unknown'}
- Budget: $${profileData.budgetMin || '?'}-$${profileData.budget || '?'}/mo
- Occupation: ${profileData.occupation || 'unknown'}
    `.trim();

    const systemPrompt = `You are generating a "Question of the Day" for a roommate matching app called Rhome.

Your job is to invent ONE original, thoughtful question that helps reveal roommate compatibility. You must write:
1. The question itself (conversational, specific, not generic)
2. Exactly 3 or 4 answer options (each with a short label + a Feather icon name)
3. A category tag

RULES:
- The question must NOT repeat topics already covered in the user's profile questionnaire (sleep, cleanliness, noise, guests, smoking, pets are already known)
- The question must NOT repeat any of the recent questions listed
- The question should feel natural and a little unexpected — not a standard survey question
- The question must be specifically useful for roommate compatibility (not general personality trivia)
- Answer options must be mutually exclusive, cover the realistic range, and have no "right" answer
- Write conversationally — like you're a friend asking, not a form
- For icons, use valid Feather icon names only (e.g. "sun", "moon", "home", "clock", "heart", "star", "zap", "coffee", "music", "book", "globe", "shield", "users", "thumbs-up", "thermometer", "volume-x", "monitor", "smile", "lock", "wind", "droplet", "calendar", "map-pin", "navigation", "truck", "mic", "message-square", "check-circle", "alert-triangle", "minus-circle", "refresh-cw", "package", "box", "clipboard", "user", "shopping-bag")

CATEGORIES (pick the best fit):
- lifestyle: daily routines, home habits, morning/evening patterns
- social: how they interact with others at home, shared spaces
- habits: household maintenance, shared responsibilities, kitchen/bathroom behaviors
- values: what they care about in a home environment, priorities
- communication: how they handle conflict, preferences, disagreements

OUTPUT FORMAT — respond with ONLY valid JSON, nothing else:
{
  "question_text": "...",
  "question_category": "...",
  "options": [
    { "value": "option_1", "label": "...", "icon": "..." },
    { "value": "option_2", "label": "...", "icon": "..." },
    { "value": "option_3", "label": "...", "icon": "..." }
  ]
}`;

    const userPrompt = `Here is what I already know about this user:
${profileSummary}

Additional context from AI memory:
${memoryContext}

Recent questions already asked (do NOT repeat these topics):
${recentTopics}

Generate one original question for today. Make it specific and genuinely useful for finding a compatible roommate. Avoid anything already answered in their profile.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const generated = JSON.parse(content.text.trim());

    if (!generated.question_text || !generated.options || !Array.isArray(generated.options)) {
      throw new Error('Invalid question format from Claude');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: newQuestion, error: insertError } = await supabase
      .from('daily_questions')
      .insert({
        user_id: user.id,
        question_text: generated.question_text,
        question_category: generated.question_category,
        options: generated.options,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ question: newQuestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-daily-question error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
