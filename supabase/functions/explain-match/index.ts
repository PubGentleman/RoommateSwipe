import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { targetProfileId } = await req.json()

    const { data: cached } = await supabase
      .from('match_explanations')
      .select('*')
      .eq('requester_id', user.id)
      .eq('target_profile_id', targetProfileId)
      .single()

    if (cached) {
      return new Response(JSON.stringify({
        headline: cached.explanation,
        compatibilityScore: cached.compatibility_score,
        topReasons: cached.top_reasons,
        concerns: cached.concerns,
        id: cached.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [requesterResult, targetResult, memoryResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('profiles').select('*').eq('user_id', targetProfileId).single(),
      supabase.from('user_ai_memory').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    const myProfile = requesterResult.data
    const theirProfile = targetResult.data
    const myMemory = memoryResult.data

    if (!myProfile || !theirProfile) {
      return new Response(JSON.stringify({ error: 'Profiles not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = `You are analyzing compatibility between two potential roommates for Rhome, a NYC roommate matching app.

MY PROFILE:
- Name: ${myProfile.full_name}
- Budget: $${myProfile.budget_min}-$${myProfile.budget_max}/month
- Neighborhood: ${myProfile.neighborhood || 'flexible'}
- Sleep schedule: ${myProfile.sleep_schedule || 'not specified'}
- Cleanliness: ${myProfile.cleanliness || 'not specified'}/5
- Smoking: ${myProfile.smoking ? 'smoker' : 'non-smoker'}
- Pets: ${myProfile.pets ? 'has pets' : 'no pets'}
- Lifestyle tags: ${myProfile.lifestyle_tags?.join(', ') || 'none'}
- Bio: ${myProfile.bio || 'none'}${myProfile.profile_note ? `\n- In their own words: "${myProfile.profile_note}"` : ''}
${myMemory?.dealbreakers?.length ? `- Known dealbreakers: ${myMemory.dealbreakers.join(', ')}` : ''}
${myMemory?.must_haves?.length ? `- Must-haves: ${myMemory.must_haves.join(', ')}` : ''}

THEIR PROFILE:
- Name: ${theirProfile.full_name}
- Budget: $${theirProfile.budget_min}-$${theirProfile.budget_max}/month
- Neighborhood: ${theirProfile.neighborhood || 'flexible'}
- Sleep schedule: ${theirProfile.sleep_schedule || 'not specified'}
- Cleanliness: ${theirProfile.cleanliness || 'not specified'}/5
- Smoking: ${theirProfile.smoking ? 'smoker' : 'non-smoker'}
- Pets: ${theirProfile.pets ? 'has pets' : 'no pets'}
- Lifestyle tags: ${theirProfile.lifestyle_tags?.join(', ') || 'none'}
- Bio: ${theirProfile.bio || 'none'}${theirProfile.profile_note ? `\n- In their own words: "${theirProfile.profile_note}"` : ''}

Analyze their compatibility and respond with ONLY this JSON:
{
  "compatibilityScore": 0-100,
  "headline": "one sentence explaining the match in plain english, conversational tone",
  "topReasons": [
    "specific reason 1 — be concrete, not generic",
    "specific reason 2",
    "specific reason 3"
  ],
  "concerns": [
    "one honest concern if any — or empty array if no real concerns"
  ],
  "conversationStarter": "a natural first message this person could send to break the ice"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiResponse = await response.json()
    const text = aiResponse.content?.[0]?.type === 'text' ? aiResponse.content[0].text : '{}'
    const result = JSON.parse(text)

    const { data: saved } = await supabase
      .from('match_explanations')
      .insert({
        requester_id: user.id,
        target_profile_id: targetProfileId,
        explanation: result.headline,
        compatibility_score: result.compatibilityScore,
        top_reasons: result.topReasons,
        concerns: result.concerns,
      })
      .select()
      .single()

    return new Response(
      JSON.stringify({ ...result, id: saved?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
