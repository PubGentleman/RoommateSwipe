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
      .select('title, price, bedrooms, rooms_available, existing_roommates_count, host_lives_in, neighborhood, amenities, available_date')
      .eq('id', listingId)
      .single();

    if (!listing) return errorResponse('Listing not found', 404);

    const bedroomsNeeded = listing.rooms_available ?? listing.bedrooms;

    const { data: renters } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        age,
        occupation,
        city,
        gender,
        profile:profiles(
          budget_max,
          budget_per_person_min,
          budget_per_person_max,
          move_in_date,
          cleanliness,
          sleep_schedule,
          smoking,
          pets,
          no_pets_allergy,
          drinking,
          guests,
          guest_policy,
          noise_tolerance,
          interests,
          interest_tags,
          preferred_trains,
          preferred_neighborhoods,
          desired_bedrooms,
          location_flexible,
          wfh,
          work_location,
          bio
        )
      `)
      .in('id', renterIds);

    if (!renters || renters.length === 0) {
      return errorResponse('Could not fetch renter profiles', 404);
    }

    const sharePerPerson = listing.price / Math.max(1, bedroomsNeeded);

    const systemPrompt = `You are an expert real estate agent's AI assistant specializing in roommate group assembly.

Your job is to analyze a pool of potential renters and recommend the BEST group for a specific listing.

SCORING PRIORITIES (in order):
1. DEAL-BREAKERS (must pass): No smoker+non-smoker conflicts, no pet allergy+pet conflicts
2. SLEEP SCHEDULE ALIGNMENT: Most common source of roommate conflict
3. CLEANLINESS ALIGNMENT: Second most common conflict source
4. BUDGET COVERAGE: Combined budget must cover rent (ideally 10-20% above for comfort)
5. MOVE-IN TIMELINE: All members should be able to move in within 2 weeks of each other
6. NEIGHBORHOOD/TRANSIT FIT: Members should want to live in or near the listing's area
7. LIFESTYLE COMPATIBILITY: Guest policy, noise tolerance, work-from-home alignment
8. SHARED INTERESTS: Bonus for common activities (not required)

GROUP DYNAMICS TO CONSIDER:
- A group where everyone is compatible with everyone else (no weak pairs)
- Budget balance — avoid pairing $800/mo and $2500/mo renters (resentment risk)
- Age proximity — within 5-8 years is ideal for shared living
- Don't just pick the top individuals — pick the best COMBINATION

RESPONSE FORMAT:
{
  "recommendedGroup": ["renter_id_1", "renter_id_2"],
  "groupNames": ["Name 1", "Name 2"],
  "confidence": 0-100,
  "headline": "One sentence summary of why this group works",
  "reasons": ["reason1", "reason2", "reason3"],
  "concerns": ["any yellow flags to discuss with renters"],
  "alternativeGroup": ["alt_renter_id_1", ...] or null,
  "alternativeReason": "Why this is a backup option",
  "excludedRenters": [{"id": "...", "name": "...", "reason": "Why they don't fit this group"}]
}`;

    const renterSummaries = renters.map((r: any) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : (r.profile ?? {});
      const interests = p.interests?.length ? p.interests : (p.interest_tags ?? []);
      return `RENTER: ${r.full_name} (ID: ${r.id})
  Age: ${r.age} | Gender: ${r.gender ?? 'not specified'} | Occupation: ${r.occupation}
  Budget: $${p.budget_per_person_min ?? 0}–$${p.budget_per_person_max ?? p.budget_max ?? 0}/mo per person
  Move-in: ${p.move_in_date ?? 'flexible'}
  Sleep schedule: ${p.sleep_schedule ?? 'not specified'}
  Cleanliness: ${p.cleanliness ?? 'not specified'}/10
  Smoking: ${p.smoking ? 'yes' : 'no'} | Pets: ${p.pets ?? 'no'} | Pet allergy: ${p.no_pets_allergy ? 'yes' : 'no'}
  Drinking: ${p.drinking ?? 'not specified'} | Guest policy: ${p.guest_policy ?? p.guests ?? 'not specified'}
  Noise tolerance: ${p.noise_tolerance ?? 'not specified'}/10
  Work: ${p.work_location ?? (p.wfh ? 'WFH' : 'office')} | Location flexible: ${p.location_flexible ? 'yes' : 'no'}
  Preferred neighborhoods: ${(p.preferred_neighborhoods ?? []).join(', ') || 'flexible'}
  Preferred trains: ${(p.preferred_trains ?? []).join(', ') || 'flexible'}
  Interests: ${interests.join(', ') || 'not specified'}
  Desires: ${p.desired_bedrooms ?? listing.bedrooms}BR apartment
  Bio: ${p.bio ?? 'no bio'}`;
    }).join('\n\n');

    let existingOccupantsSection = '';
    if (listing.existing_roommates_count > 0) {
      const { data: existingRoommates } = await supabase
        .from('existing_roommates')
        .select('*')
        .eq('listing_id', listing.id)
        .eq('profile_completed', true);

      if (existingRoommates && existingRoommates.length > 0) {
        existingOccupantsSection = `\nEXISTING OCCUPANTS (already living in the unit — new tenants must be compatible with them):
${existingRoommates.map((er: any, i: number) => `
Existing Roommate ${i + 1}: ${er.first_name || 'Anonymous'}
- Sleep schedule: ${er.sleep_schedule || 'unknown'}
- Cleanliness: ${er.cleanliness || 'unknown'}/5
- Smoking: ${er.smoking ? 'yes' : 'no'}
- Pets: ${er.pets ? 'yes' : 'no'}
- Guest preference: ${er.guests_frequency || 'unknown'}
- Home vibe: ${er.noise_level || 'unknown'}
- Lifestyle: ${(er.lifestyle_tags || []).join(', ') || 'not specified'}
`).join('')}
IMPORTANT: New tenants must be compatible with the above existing occupants. Factor this heavily into your recommendation.`;
      } else {
        existingOccupantsSection = `\nNote: This unit already has ${listing.existing_roommates_count} existing roommate(s) living there. The new renter(s) must be compatible with them too.`;
      }
    }

    const userMessage = `I am an agent with a ${listing.bedrooms}BR apartment (${bedroomsNeeded} rooms available) listed at $${listing.price}/mo in ${listing.neighborhood}.
Available: ${listing.available_date ?? 'now'}
Amenities: ${(listing.amenities ?? []).join(', ') || 'standard'}
Share per person: $${sharePerPerson.toFixed(0)}/mo${existingOccupantsSection}

I have ${renters.length} shortlisted renters. Recommend the best group to fill the ${bedroomsNeeded} open room${bedroomsNeeded !== 1 ? 's' : ''}.

${renterSummaries}

Which ${bedroomsNeeded} renters should I group together? Explain your reasoning clearly.`;

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
