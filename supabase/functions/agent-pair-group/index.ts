import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { data: agentData } = await supabase
      .from('users')
      .select('agent_plan, full_name')
      .eq('id', user.id)
      .single();

    const plan = agentData?.agent_plan ?? 'pay_per_use';
    if (!['pro', 'business'].includes(plan)) {
      return errorResponse('AI pairing requires Agent Pro or Business plan', 403);
    }

    const { renterIds, listingId } = await req.json();
    if (!renterIds || renterIds.length < 2) {
      return errorResponse('Need at least 2 renters to suggest a group', 400);
    }

    const { data: listing } = await supabase
      .from('listings')
      .select('title, price, bedrooms, neighborhood, amenities, available_date')
      .eq('id', listingId)
      .single();

    if (!listing) return errorResponse('Listing not found', 404);

    const { data: renters } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        age,
        occupation,
        city,
        profile:profiles(
          budget_max,
          budget_per_person_min,
          budget_per_person_max,
          move_in_date,
          cleanliness,
          sleep_schedule,
          smoking,
          pets,
          drinking,
          guests,
          noise_tolerance,
          interests,
          preferred_trains,
          desired_bedrooms,
          location_flexible,
          wfh,
          bio
        )
      `)
      .in('id', renterIds);

    if (!renters || renters.length === 0) {
      return errorResponse('Could not fetch renter profiles', 404);
    }

    const sharePerPerson = listing.price / listing.bedrooms;

    const systemPrompt = `You are an expert real estate agent assistant specializing in NYC roommate matching.
Your job is to analyze a group of shortlisted renters and recommend the best combination to fill a specific apartment.
You understand NYC neighborhoods, subway lines, and what makes roommates compatible long-term.

When recommending a group:
1. Budget must work — combined max budgets must cover the rent
2. Lifestyle must be compatible — sleep schedules, cleanliness, smoking, pets
3. Move-in timing must align — within 30 days of each other and the listing availability
4. Transit must work for everyone — preferred train lines vs listing neighborhood
5. Group size must match bedrooms — exactly the right number of people

Always respond in this exact JSON format:
{
  "recommendedGroup": ["renter_id_1", "renter_id_2"],
  "groupNames": ["Name 1", "Name 2"],
  "confidence": 85,
  "headline": "Strong budget and lifestyle match for this 2BR",
  "reasons": [
    "Both have similar cleanliness standards (8/10 and 9/10)",
    "Same sleep schedule — both early risers",
    "Combined budget of $4,800 covers the $4,500 rent with room to spare",
    "Both on the N/W train — perfect for this Astoria listing"
  ],
  "concerns": [
    "Jordan has a dog — confirm building is pet-friendly"
  ],
  "alternativeGroup": ["renter_id_3", "renter_id_4"],
  "alternativeReason": "Slightly lower compatibility but better move-in timing",
  "excludedRenters": [
    { "id": "renter_id_5", "name": "Alex", "reason": "Budget ($1,200/mo max) too low for $1,500/person share" }
  ]
}`;

    const renterSummaries = renters.map((r: any) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : (r.profile ?? {});
      return `RENTER: ${r.full_name} (ID: ${r.id})
  Age: ${r.age} | Occupation: ${r.occupation}
  Budget: $${p.budget_per_person_min ?? 0}–$${p.budget_per_person_max ?? p.budget_max ?? 0}/mo per person
  Move-in: ${p.move_in_date ?? 'flexible'}
  Sleep schedule: ${p.sleep_schedule ?? 'not specified'}
  Cleanliness: ${p.cleanliness ?? 'not specified'}/10
  Smoking: ${p.smoking ? 'yes' : 'no'} | Pets: ${p.pets ?? 'no'}
  Drinking: ${p.drinking ?? 'not specified'} | Guests: ${p.guests ?? 'not specified'}
  Preferred trains: ${(p.preferred_trains ?? []).join(', ') || 'flexible'}
  WFH: ${p.wfh ? 'yes' : 'no'} | Location flexible: ${p.location_flexible ? 'yes' : 'no'}
  Desires: ${p.desired_bedrooms ?? listing.bedrooms}BR apartment
  Bio: ${p.bio ?? 'no bio'}`;
    }).join('\n\n');

    const userMessage = `I am an agent with a ${listing.bedrooms}BR apartment listed at $${listing.price}/mo in ${listing.neighborhood}.
Available: ${listing.available_date ?? 'now'}
Amenities: ${(listing.amenities ?? []).join(', ') || 'standard'}
Share per person: $${sharePerPerson.toFixed(0)}/mo

I have ${renters.length} shortlisted renters. Recommend the best group to fill this apartment.

${renterSummaries}

Which ${listing.bedrooms} renters should I group together? Explain your reasoning clearly.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text ?? '';

    let parsed: any = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return errorResponse('AI response could not be parsed', 500);
    }

    if (!parsed?.recommendedGroup) {
      return errorResponse('AI did not return a valid recommendation', 500);
    }

    const validRenterIds = new Set(renterIds);
    parsed.recommendedGroup = (parsed.recommendedGroup ?? []).filter((id: string) => validRenterIds.has(id));
    parsed.groupNames = parsed.groupNames ?? [];
    parsed.reasons = parsed.reasons ?? [];
    parsed.concerns = parsed.concerns ?? [];
    parsed.excludedRenters = parsed.excludedRenters ?? [];
    parsed.confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    parsed.headline = parsed.headline ?? 'Group recommendation';
    if (parsed.alternativeGroup) {
      parsed.alternativeGroup = parsed.alternativeGroup.filter((id: string) => validRenterIds.has(id));
    }

    if (parsed.recommendedGroup.length < 2) {
      return errorResponse('AI could not form a valid group from the shortlist', 500);
    }

    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature: 'agent_pairing',
      tokens_used: (claudeData.usage?.input_tokens ?? 0) + (claudeData.usage?.output_tokens ?? 0),
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('Agent pairing error:', err);
    return errorResponse('Pairing failed', 500);
  }
});

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
