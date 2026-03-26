import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildFallbackExplanation(myProfile: any, theirProfile: any): {
  headline: string
  compatibilityScore: number
  topReasons: string[]
  concerns: string[]
  conversationStarter: string
} {
  const reasons: string[] = []
  const concerns: string[] = []
  let score = 50

  const myMin = myProfile.budget_min || 0
  const myMax = myProfile.budget_max || 0
  const theirMin = theirProfile.budget_min || 0
  const theirMax = theirProfile.budget_max || 0
  const budgetOverlap = Math.min(myMax, theirMax) - Math.max(myMin, theirMin)
  if (budgetOverlap > 0) {
    reasons.push(`Budget ranges overlap — you can both afford places in the $${Math.max(myMin, theirMin)}-$${Math.min(myMax, theirMax)} range`)
    score += 10
  } else if (myMax > 0 && theirMax > 0) {
    concerns.push('Your budget ranges don\'t overlap, which could make finding a shared place harder')
    score -= 5
  }

  const myNeighborhood = myProfile.neighborhood || myProfile.preferred_location || ''
  const theirNeighborhood = theirProfile.neighborhood || theirProfile.preferred_location || ''
  if (myNeighborhood && theirNeighborhood && myNeighborhood.toLowerCase() === theirNeighborhood.toLowerCase()) {
    reasons.push(`You're both looking in ${myNeighborhood}`)
    score += 10
  } else if (myNeighborhood && theirNeighborhood) {
    reasons.push(`You're looking in ${myNeighborhood} and they prefer ${theirNeighborhood}`)
  }

  const myMoveIn = myProfile.move_in_date || ''
  const theirMoveIn = theirProfile.move_in_date || ''
  if (myMoveIn && theirMoveIn) {
    const myDate = new Date(myMoveIn)
    const theirDate = new Date(theirMoveIn)
    const diffDays = Math.abs((myDate.getTime() - theirDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 30) {
      reasons.push('Your move-in timelines align within a month of each other')
      score += 8
    }
  }

  const myRooms = myProfile.room_count || myProfile.rooms_needed || 0
  const theirRooms = theirProfile.room_count || theirProfile.rooms_needed || 0
  if (myRooms && theirRooms && myRooms === theirRooms) {
    reasons.push(`You both want a ${myRooms}-bedroom place`)
    score += 5
  }

  const myTags: string[] = myProfile.lifestyle_tags || []
  const theirTags: string[] = theirProfile.lifestyle_tags || []
  const sharedTags = myTags.filter((t: string) => theirTags.includes(t))
  if (sharedTags.length >= 2) {
    reasons.push(`You share lifestyle interests: ${sharedTags.slice(0, 3).join(', ')}`)
    score += 8
  } else if (sharedTags.length === 1) {
    reasons.push(`You both enjoy ${sharedTags[0]}`)
    score += 4
  }

  const myOccupation = myProfile.occupation || ''
  const theirOccupation = theirProfile.occupation || ''
  if (myOccupation && theirOccupation) {
    reasons.push(`${theirProfile.full_name?.split(' ')[0] || 'They'} works as ${theirOccupation}`)
  }

  if (myProfile.cleanliness && theirProfile.cleanliness) {
    const diff = Math.abs(Number(myProfile.cleanliness) - Number(theirProfile.cleanliness))
    if (diff <= 1) {
      reasons.push('Similar cleanliness standards')
      score += 5
    } else if (diff >= 3) {
      concerns.push('Your cleanliness preferences are quite different')
      score -= 5
    }
  }

  if (myProfile.sleep_schedule && theirProfile.sleep_schedule && myProfile.sleep_schedule === theirProfile.sleep_schedule) {
    reasons.push('Compatible sleep schedules')
    score += 5
  }

  score = Math.max(30, Math.min(95, score))

  if (reasons.length === 0) {
    reasons.push('Both looking for a roommate in a similar timeframe')
    reasons.push('Profiles suggest general compatibility')
  }

  const theirName = theirProfile.full_name?.split(' ')[0] || 'This person'
  let headline = ''
  if (score >= 75) {
    headline = `${theirName} looks like a strong match based on your shared preferences and compatible lifestyle.`
  } else if (score >= 55) {
    headline = `You and ${theirName} have some good overlap in what you're looking for — worth exploring.`
  } else {
    headline = `${theirName} has a different profile, but there could still be potential if you're flexible.`
  }

  return {
    headline,
    compatibilityScore: score,
    topReasons: reasons.slice(0, 4),
    concerns: concerns.slice(0, 2),
    conversationStarter: `Hey ${theirName}! I saw we're both looking for a place — would love to chat about what you're looking for.`,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const targetProfileId = body.matchedProfileId || body.targetProfileId

    if (!targetProfileId) {
      return new Response(JSON.stringify({ error: 'Missing matchedProfileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requesterId = user.id

    const { data: cached } = await supabase
      .from('match_explanations')
      .select('*')
      .eq('requester_id', requesterId)
      .eq('target_profile_id', targetProfileId)
      .single()

    if (cached) {
      return new Response(JSON.stringify({
        headline: cached.explanation,
        compatibilityScore: cached.compatibility_score,
        topReasons: cached.top_reasons,
        concerns: cached.concerns,
        conversationStarter: cached.conversation_starter || '',
        id: cached.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [requesterResult, targetResult, memoryResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', requesterId).single(),
      supabase.from('profiles').select('*').eq('user_id', targetProfileId).single(),
      supabase.from('user_ai_memory').select('*').eq('user_id', requesterId).maybeSingle(),
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

    let result: any = null

    if (ANTHROPIC_API_KEY) {
      try {
        const prompt = `You are analyzing compatibility between two potential roommates for Rhome, a roommate matching app.

MY PROFILE:
- Name: ${myProfile.full_name}
- Budget: $${myProfile.budget_min || '?'}-$${myProfile.budget_max || '?'}/month
- Location: ${myProfile.neighborhood || myProfile.preferred_location || 'flexible'}
- Move-in date: ${myProfile.move_in_date || 'not specified'}
- Rooms needed: ${myProfile.room_count || myProfile.rooms_needed || 'not specified'}
- Occupation: ${myProfile.occupation || 'not specified'}
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
- Budget: $${theirProfile.budget_min || '?'}-$${theirProfile.budget_max || '?'}/month
- Location: ${theirProfile.neighborhood || theirProfile.preferred_location || 'flexible'}
- Move-in date: ${theirProfile.move_in_date || 'not specified'}
- Rooms needed: ${theirProfile.room_count || theirProfile.rooms_needed || 'not specified'}
- Occupation: ${theirProfile.occupation || 'not specified'}
- Sleep schedule: ${theirProfile.sleep_schedule || 'not specified'}
- Cleanliness: ${theirProfile.cleanliness || 'not specified'}/5
- Smoking: ${theirProfile.smoking ? 'smoker' : 'non-smoker'}
- Pets: ${theirProfile.pets ? 'has pets' : 'no pets'}
- Lifestyle tags: ${theirProfile.lifestyle_tags?.join(', ') || 'none'}
- Bio: ${theirProfile.bio || 'none'}${theirProfile.profile_note ? `\n- In their own words: "${theirProfile.profile_note}"` : ''}

Focus on: budget overlap, location compatibility, move-in timing, room count match, shared lifestyle tags, and occupation compatibility.

Analyze their compatibility and respond with ONLY this JSON:
{
  "compatibilityScore": 0-100,
  "headline": "2-3 sentences explaining why they are a good match, referencing specific overlapping preferences",
  "topReasons": [
    "specific reason 1 — be concrete about budget overlap, location, timing, etc.",
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

        if (response.ok) {
          const aiResponse = await response.json()
          const text = aiResponse.content?.[0]?.type === 'text' ? aiResponse.content[0].text : null
          if (text) {
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0])
            }
          }
        }
      } catch {
        // Claude call failed — fall through to fallback
      }
    }

    if (!result || !result.headline) {
      result = buildFallbackExplanation(myProfile, theirProfile)
    }

    try {
      const { data: saved } = await supabase
        .from('match_explanations')
        .insert({
          requester_id: requesterId,
          target_profile_id: targetProfileId,
          explanation: result.headline,
          compatibility_score: result.compatibilityScore,
          top_reasons: result.topReasons,
          concerns: result.concerns,
          conversation_starter: result.conversationStarter,
        })
        .select()
        .single()
      if (saved) result.id = saved.id
    } catch {
      // Cache save failed — not critical
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({
      headline: 'These profiles have some interesting overlap worth exploring.',
      compatibilityScore: 50,
      topReasons: ['Both actively looking for a roommate', 'Signed up around the same time'],
      concerns: [],
      conversationStarter: 'Hey! I saw your profile — would love to chat.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
