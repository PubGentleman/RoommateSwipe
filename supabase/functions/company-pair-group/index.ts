import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { listingId, companyHostId } = await req.json();

    if (!listingId || !companyHostId) {
      return new Response(JSON.stringify({ error: 'listingId and companyHostId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listing } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (!listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: shortlisted } = await supabase
      .from('company_shortlisted_renters')
      .select(`
        renter_id,
        profiles:users!company_shortlisted_renters_renter_id_fkey (
          id, full_name, age, bio,
          profile:profiles (
            sleep_schedule, cleanliness, smoking, pets,
            move_in_date, budget_max, budget_per_person_max,
            desired_bedrooms, preferred_trains, amenity_must_haves,
            lifestyle_tags, occupation
          )
        )
      `)
      .eq('company_host_id', companyHostId)
      .or(`listing_id.eq.${listingId},listing_id.is.null`);

    if (!shortlisted || shortlisted.length < 2) {
      return new Response(JSON.stringify({ error: 'Need at least 2 shortlisted renters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const renters = shortlisted
      .map((s: any) => {
        const u = s.profiles;
        const p = u?.profile;
        return u ? {
          id: u.id,
          full_name: u.full_name,
          age: u.age,
          bio: u.bio,
          occupation: p?.occupation,
          sleep_schedule: p?.sleep_schedule,
          cleanliness: p?.cleanliness,
          smoking: p?.smoking,
          pets: p?.pets,
          move_in_date: p?.move_in_date,
          budget_max: p?.budget_max,
          budget_per_person_max: p?.budget_per_person_max,
          preferred_trains: p?.preferred_trains,
          lifestyle_tags: p?.lifestyle_tags,
        } : null;
      })
      .filter(Boolean);

    const bedroomsNeeded = listing.bedrooms - (listing.host_lives_in ? 1 : 0);

    const systemPrompt = `You are an expert roommate matching AI for a property management company.
Your job is to analyze a pool of pre-screened renter candidates and recommend the best possible group to fill a specific apartment unit.
The company needs to fill vacancies quickly with compatible, reliable tenants.
You must respond ONLY with valid JSON — no markdown, no explanation outside the JSON.`;

    const userPrompt = `
LISTING TO FILL:
- Address: ${listing.address || 'N/A'}, ${listing.neighborhood || listing.city}
- Bedrooms: ${listing.bedrooms} (${bedroomsNeeded} rooms available for renters)
- Monthly Rent: $${listing.price}
- Per-person cost: ~$${Math.round(listing.price / Math.max(1, bedroomsNeeded))}/month
- Amenities: ${listing.amenities?.join(', ') || 'standard'}
- Available: ${listing.available_date || 'ASAP'}

SHORTLISTED CANDIDATES (${renters.length} total):
${renters.map((r: any, i: number) => `
Candidate ${i + 1}: ${r.full_name}
- Budget: up to $${r.budget_per_person_max || r.budget_max || 'unknown'}/month per person
- Move-in: ${r.move_in_date || 'flexible'}
- Sleep schedule: ${r.sleep_schedule || 'unknown'}
- Cleanliness: ${r.cleanliness || 'unknown'}/5
- Smoking: ${r.smoking ? 'yes' : 'no'}
- Pets: ${r.pets ? 'yes' : 'no'}
- Subway lines: ${r.preferred_trains?.join(', ') || 'flexible'}
- Occupation: ${r.occupation || 'not specified'}
- Lifestyle: ${r.lifestyle_tags?.join(', ') || 'not specified'}
`).join('')}

Task: Select the best ${bedroomsNeeded} candidates to form a group for this unit. Consider:
1. Budget compatibility with the listing price per person
2. Lifestyle compatibility among the group members
3. Move-in timing alignment with listing availability
4. Deal-breakers (smoking, pets, sleep schedule conflicts)
5. Overall group harmony for long-term tenancy

Respond ONLY with this JSON structure:
{
  "recommendedGroup": ["1", "2"],
  "confidence": 85,
  "fillScore": 92,
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "concerns": ["concern 1"],
  "alternativeGroup": ["3", "4"],
  "alternativeReason": "why this is a backup option",
  "excludedRenters": [{"id": "5", "reason": "budget too low for this unit"}],
  "estimatedFillTime": "3-5 days",
  "recommendation": "This group is your strongest option."
}

Use the candidate index numbers (1, 2, 3...) as the IDs.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const aiResponse = await response.json();
    const responseText = aiResponse.content?.[0]?.text || '{}';

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: responseText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const indexedRenters = renters.map((r: any, i: number) => ({ index: String(i + 1), ...r }));
    result.recommendedGroupProfiles = (result.recommendedGroup || [])
      .map((idx: string) => indexedRenters.find((r: any) => r.index === idx))
      .filter(Boolean);
    result.alternativeGroupProfiles = (result.alternativeGroup || [])
      .map((idx: string) => indexedRenters.find((r: any) => r.index === idx))
      .filter(Boolean);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
