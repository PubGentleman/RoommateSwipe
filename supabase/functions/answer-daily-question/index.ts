import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { questionId, selectedValue } = await req.json();
    if (!questionId || !selectedValue) {
      return new Response(JSON.stringify({ error: 'Missing questionId or selectedValue' }), { status: 400, headers: corsHeaders });
    }

    const { data: question } = await supabase
      .from('daily_questions')
      .select('*')
      .eq('id', questionId)
      .eq('user_id', user.id)
      .is('selected_value', null)
      .single();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question not found or already answered' }), { status: 404, headers: corsHeaders });
    }

    const validValues = (question.options as any[]).map((o: any) => o.value);
    if (!validValues.includes(selectedValue)) {
      return new Response(JSON.stringify({ error: 'Invalid answer value' }), { status: 400, headers: corsHeaders });
    }

    const { error: updateError } = await supabase
      .from('daily_questions')
      .update({
        selected_value: selectedValue,
        answered_at: new Date().toISOString(),
        used_in_matching: true,
      })
      .eq('id', questionId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    const { data: profile } = await supabase
      .from('profiles')
      .select('personality_answers')
      .eq('id', user.id)
      .single();

    const currentAnswers = profile?.personality_answers || {};

    const answerKey = `daily_${question?.question_category}_${new Date().toISOString().split('T')[0]}`;
    const updatedAnswers = {
      ...currentAnswers,
      [answerKey]: {
        question: question?.question_text,
        answer: selectedValue,
        date: new Date().toISOString(),
      },
    };

    await supabase
      .from('profiles')
      .update({ personality_answers: updatedAnswers })
      .eq('id', user.id);

    await supabase
      .from('user_ai_memory')
      .insert({
        user_id: user.id,
        memory_text: `Daily question answered: "${question?.question_text}" -> User chose: "${selectedValue}"`,
        memory_type: 'daily_question',
      })
      .select();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('answer-daily-question error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
