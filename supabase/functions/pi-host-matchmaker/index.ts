import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOST_MONTHLY_LIMITS: Record<string, number> = {
  free: 5, basic: 5, starter: 10, plus: 30, pro: 100, business: 200, elite: 200,
};

const AGENT_MONTHLY_LIMITS: Record<string, number> = {
  pay_per_use: 20, starter: 100, pro: 200, business: 500,
};

const COMPANY_MONTHLY_LIMITS: Record<string, number> = {
  starter: 200, pro: 500, enterprise: -1,
};

const PI_PERSONA = `You are Pi, Rhome's AI matchmaker — now helping from the host's perspective. You're analyzing renters and groups who might be great fits for a specific listing. You understand what makes a tenancy work: financial reliability, lifestyle compatibility with the building/neighborhood, timing alignment, and group dynamics. You're practical but warm — you want both the host and the renters to have a great experience. When recommending, you consider the whole picture: can they afford it, will they be happy there, and will the host feel confident about them?`;

function stripPii(name: string | null | undefined): string {
  if (!name) return 'User';
  return name.split(' ')[0] || 'User';
}

function trimText(text: string | null | undefined, max = 500): string {
  if (!text) return '';
  let cleaned = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  cleaned = cleaned.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');
  cleaned = cleaned.replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Dr|Rd|Ln|Ct|Way|Pl)\b/gi, '[address]');
  return cleaned.length > max ? cleaned.substring(0, max) + '...' : cleaned;
}

async function getHostPlanAndLimit(supabase: any, userId: string): Promise<{ plan: string; limit: number }> {
  const { data: userData } = await supabase
    .from('users')
    .select('host_type, agent_plan')
    .eq('id', userId)
    .single();

  if (userData?.host_type === 'agent') {
    const plan = userData.agent_plan || 'pay_per_use';
    return { plan, limit: AGENT_MONTHLY_LIMITS[plan] ?? 20 };
  }

  if (userData?.host_type === 'company') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    const rawPlan = sub?.plan || 'starter';
    const normalized = rawPlan.replace('company_', '');
    return { plan: normalized, limit: COMPANY_MONTHLY_LIMITS[normalized] ?? 200 };
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  const plan = sub?.plan || 'free';
  return { plan, limit: HOST_MONTHLY_LIMITS[plan] ?? 5 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await req.json();
    const listingId = body.listing_id || body.listingId;
    if (!listingId) return errorResponse('listing_id is required', 400);

    const { data: listing } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .eq('host_id', user.id)
      .single();

    if (!listing) return errorResponse('Listing not found or not owned by you', 404);

    const { data: cached } = await supabase
      .from('pi_host_recommendations')
      .select('*')
      .eq('host_id', user.id)
      .eq('listing_id', listingId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return jsonResponse({
        recommendations: cached.recommendations,
        market_insight: cached.market_insight,
        cached: true,
      });
    }

    const { plan, limit } = await getHostPlanAndLimit(supabase, user.id);

    if (limit !== -1) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('pi_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('feature', 'host_matchmaker')
        .gte('created_at', monthStart.toISOString());

      if ((count ?? 0) >= limit) {
        return errorResponse(`Monthly Pi matchmaker limit reached (${limit}). Upgrade your plan for more.`, 429);
      }
    }

    const listingRent = listing.rent || listing.price || 0;
    const listingBedrooms = listing.bedrooms || 1;
    const sharePerPerson = listingRent / Math.max(1, listing.rooms_available || listingBedrooms);

    const budgetFloor = sharePerPerson * 0.6;
    const budgetCeiling = sharePerPerson * 1.8;

    const { data: renterCandidates } = await supabase
      .from('profiles')
      .select('*')
      .gte('budget_max', budgetFloor)
      .lte('budget_min', budgetCeiling)
      .limit(40);

    const candidateUserIds = (renterCandidates || []).map((r: any) => r.user_id).filter((id: string) => id !== user.id);

    const { data: candidateUsers } = await supabase
      .from('users')
      .select('id, full_name, age, occupation, bio, city, neighborhood, zodiac_sign, lifestyle_tags, role, onboarding_step')
      .in('id', candidateUserIds)
      .eq('role', 'renter')
      .eq('onboarding_step', 'complete');

    const validUserIds = new Set((candidateUsers || []).map((u: any) => u.id));
    const filteredCandidates = (renterCandidates || []).filter((r: any) => validUserIds.has(r.user_id));

    const { data: groupCandidates } = await supabase
      .from('groups')
      .select('id, name, member_count, budget_min, budget_max, preferred_neighborhoods, move_in_date')
      .gte('budget_max', budgetFloor)
      .gte('member_count', 2)
      .limit(10);

    const userMap = new Map((candidateUsers || []).map((u: any) => [u.id, u]));

    const listingContext = `LISTING:
- Title: ${listing.title || 'Untitled'}
- Rent: $${listingRent}/month (${listing.rooms_available || listingBedrooms} rooms available, ~$${sharePerPerson.toFixed(0)}/person)
- Bedrooms: ${listingBedrooms} | Bathrooms: ${listing.bathrooms || '?'}
- Neighborhood: ${listing.neighborhood || '?'} | City: ${listing.city || '?'}
- Available: ${listing.available_date || 'now'}
- Amenities: ${(listing.amenities || []).join(', ') || 'standard'}
- Type: ${listing.type || 'apartment'}
- Host lives in: ${listing.host_lives_in ? 'yes' : 'no'}
- Existing roommates: ${listing.existing_roommates_count || 0}
- Transit nearby: ${(listing.nearby_transit || []).join(', ') || 'not specified'}
- Pet policy: ${listing.pet_policy || 'not specified'}
- Description: ${trimText(listing.description, 400)}`;

    const renterSummaries = filteredCandidates.slice(0, 20).map((p: any) => {
      const u = userMap.get(p.user_id) || {};
      return `[RENTER:${p.user_id}] ${stripPii(u.full_name)}, ${u.age || '?'}yo, ${u.occupation || '?'}
  Bio: ${trimText(u.bio || p.bio, 300)}
  Zodiac: ${u.zodiac_sign || '-'}
  Budget: $${p.budget_min || '?'}-$${p.budget_max || '?'} | Per-person: $${p.budget_per_person_min || '?'}-$${p.budget_per_person_max || '?'}
  Move-in: ${p.move_in_date || '?'} | Lease: ${p.lease_duration || '?'}
  Room type: ${p.room_type || '?'} | Desired BR: ${p.desired_bedrooms || '?'}
  Sleep: ${p.sleep_schedule || '?'} | Clean: ${p.cleanliness ?? '?'}/10 | Noise: ${p.noise_tolerance || '?'}
  Smoke: ${p.smoking != null ? (p.smoking ? 'Y' : 'N') : '?'} | Drink: ${p.drinking || '?'} | Pets: ${p.pets || '?'}
  WFH: ${p.wfh != null ? (p.wfh ? 'Y' : 'N') : '?'} | Guests: ${p.guests || '?'}
  Trains: ${(p.preferred_trains || []).join(',') || '-'}
  Amenities: ${(p.amenity_must_haves || []).join(',') || '-'}
  Diet: ${p.diet || '-'} | Roommate vibe: ${p.roommate_relationship || '-'}
  Shared expenses: ${p.shared_expenses || '-'} | Location flexible: ${p.location_flexible != null ? (p.location_flexible ? 'Y' : 'N') : '?'}
  Interests: ${(p.interests || []).join(',') || '-'}
  Tags: ${(u.lifestyle_tags || p.lifestyle_tags || []).join(',') || '-'}
  Dealbreakers: ${(p.dealbreakers || []).join(',') || '-'}
  Neighborhoods: ${(p.preferred_neighborhoods || []).join(',') || '-'}
  Ideal roommate: ${trimText(p.ideal_roommate_text, 200)}
  Profile note: ${trimText(p.profile_note, 150)}
  Personality: ${p.personality_quiz_answers ? JSON.stringify(p.personality_quiz_answers) : '-'}`;
    }).join('\n\n');

    const groupSummaries = (groupCandidates || []).map((g: any) => {
      return `[GROUP:${g.id}] "${g.name}" — ${g.member_count} members
  Budget: $${g.budget_min || '?'}-$${g.budget_max || '?'}
  Move-in: ${g.move_in_date || '?'}
  Neighborhoods: ${(g.preferred_neighborhoods || []).join(',') || '-'}`;
    }).join('\n\n');

    const candidateSection = [
      renterSummaries ? `INDIVIDUAL RENTERS:\n${renterSummaries}` : '',
      groupSummaries ? `GROUPS:\n${groupSummaries}` : '',
    ].filter(Boolean).join('\n\n');

    if (!candidateSection) {
      return jsonResponse({
        recommendations: [],
        market_insight: 'No candidates currently match this listing\'s price range. Consider adjusting the rent or waiting for new sign-ups.',
        cached: false,
      });
    }

    const prompt = `${listingContext}

${candidateSection}

Recommend up to 5 best-fit candidates (renters or groups) for this listing. Consider:
1. Budget fit — can they actually afford it?
2. Neighborhood/transit alignment — is this area practical for them?
3. Lifestyle compatibility — would they thrive in this space?
4. Move-in timing — does the timeline work?
5. If the host lives in or there are existing roommates, compatibility with them

Also provide a brief market insight: how competitive is this listing, any pricing observations, or suggestions.

Respond with ONLY this JSON:
{
  "recommendations": [
    {
      "type": "renter",
      "id": "user_id_here",
      "name": "First name only",
      "match_strength": 0.0-1.0,
      "reason": "2-3 sentences explaining why this person is a great fit for THIS specific listing",
      "action": "suggested next step for the host (e.g., 'Send a message about their move-in timeline', 'Invite to a showing')"
    }
  ],
  "market_insight": "1-2 sentences about the listing's market position and any suggestions"
}

For groups, use "type": "group" and "id" is the group ID. Keep recommendations to 5 max. Be specific in reasons — reference actual data from both the listing and candidate profiles.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1536,
        system: PI_PERSONA,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await response.json();
    const rawText = claudeData.content?.[0]?.text ?? '';
    const tokensUsed = (claudeData.usage?.input_tokens ?? 0) + (claudeData.usage?.output_tokens ?? 0);

    let result: any = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {}

    if (!result?.recommendations) {
      return jsonResponse({
        recommendations: [],
        market_insight: 'I couldn\'t analyze candidates right now. Try again shortly.',
        cached: false,
        error: true,
      });
    }

    const validRenterIds = new Set(filteredCandidates.map((r: any) => r.user_id));
    const validGroupIds = new Set((groupCandidates || []).map((g: any) => g.id));

    result.recommendations = (result.recommendations || [])
      .filter((r: any) => {
        if (r.type === 'renter') return validRenterIds.has(r.id);
        if (r.type === 'group') return validGroupIds.has(r.id);
        return false;
      })
      .slice(0, 5)
      .map((r: any) => ({
        type: r.type || 'renter',
        id: r.id,
        name: r.name || 'Unknown',
        match_strength: typeof r.match_strength === 'number' ? Math.min(1, Math.max(0, r.match_strength)) : 0.5,
        reason: r.reason || 'Potential fit based on budget and preferences',
        action: r.action || 'Review their profile',
      }));

    await Promise.all([
      supabase.from('pi_host_recommendations').insert({
        host_id: user.id,
        listing_id: listingId,
        recommendations: result.recommendations,
        market_insight: result.market_insight || null,
        model_used: 'claude-sonnet-4-5',
      }),
      supabase.from('pi_usage_log').insert({
        user_id: user.id,
        feature: 'host_matchmaker',
        tokens_used: tokensUsed,
        model_used: 'claude-sonnet-4-5',
      }),
    ]);

    return jsonResponse({
      recommendations: result.recommendations,
      market_insight: result.market_insight || null,
      cached: false,
    });
  } catch (err: any) {
    console.error('pi-host-matchmaker error:', err);
    return errorResponse('Matchmaker analysis failed', 500);
  }
});

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
