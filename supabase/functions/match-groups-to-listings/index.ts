import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const NEIGHBORHOOD_TRAINS: Record<string, string[]> = {
  'Astoria': ['N', 'W'], 'Long Island City': ['7', 'E', 'M', 'G'],
  'Williamsburg': ['L', 'J', 'M', 'Z'], 'Bushwick': ['L', 'J', 'M'],
  'Crown Heights': ['2', '3', '4', '5'], 'Flatbush': ['B', 'Q', '2', '5'],
  'Park Slope': ['F', 'G', 'R'], 'Sunset Park': ['D', 'N', 'R'],
  'Bay Ridge': ['R'], 'Flushing': ['7'], 'Jamaica': ['E', 'J', 'Z'],
  'Forest Hills': ['E', 'F', 'M', 'R'], 'Jackson Heights': ['7', 'E', 'F', 'M', 'R'],
  'Harlem': ['2', '3', 'A', 'B', 'C', 'D'],
  'Washington Heights': ['A', '1'],
  'Upper West Side': ['1', '2', '3', 'B', 'C'],
  'Upper East Side': ['4', '5', '6'],
  'Midtown': ['1', '2', '3', 'A', 'C', 'E', 'B', 'D', 'F', 'M', 'N', 'Q', 'R', 'W', '4', '5', '6', '7'],
  'Chelsea': ['1', 'C', 'E'], 'Greenwich Village': ['A', 'C', 'E', 'B', 'D', 'F', 'M'],
  'East Village': ['L', '4', '5', '6'], 'Lower East Side': ['F', 'J', 'M', 'Z'],
  'Tribeca': ['1', '2', '3', 'A', 'C', 'E'],
  'Financial District': ['2', '3', '4', '5', 'A', 'C', 'J', 'Z'],
};

const MATCH_THRESHOLD = 70;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const authHeader = req.headers.get('Authorization');
  const serviceHeader = req.headers.get('x-service-key');
  if (!authHeader && serviceHeader !== SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  const { groupId, listingId } = await req.json().catch(() => ({}));

  const groupQuery = supabase
    .from('groups')
    .select('id, group_members(user_id)')
    .eq('status', 'active');

  if (groupId) groupQuery.eq('id', groupId);

  const { data: groups } = await groupQuery.limit(50);
  if (!groups || groups.length === 0) {
    return new Response(JSON.stringify({ matched: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const listingQuery = supabase
    .from('listings')
    .select('id, host_id, title, price, bedrooms, neighborhood, amenities, available_date')
    .eq('available', true);

  if (listingId) listingQuery.eq('id', listingId);

  const { data: listings } = await listingQuery.limit(100);
  if (!listings || listings.length === 0) {
    return new Response(JSON.stringify({ matched: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let matchCount = 0;

  for (const group of groups) {
    const memberIds = (group.group_members ?? []).map((m: any) => m.user_id);
    if (memberIds.length < 2) continue;

    const { data: members } = await supabase
      .from('users')
      .select(`id, profile:profiles(
        budget_per_person_min, budget_per_person_max, preferred_trains,
        desired_bedrooms, amenity_must_haves, move_in_date,
        location_flexible, wfh, apartment_prefs_complete
      )`)
      .in('id', memberIds);

    const completeCount = (members ?? []).filter(
      (m: any) => m.profile?.apartment_prefs_complete
    ).length;
    if (completeCount < Math.ceil(memberIds.length / 2)) continue;

    const memberProfiles = (members ?? []).map((m: any) => ({
      id: m.id,
      apartmentPrefs: m.profile?.apartment_prefs_complete ? {
        desiredBedrooms: m.profile.desired_bedrooms,
        budgetPerPersonMin: m.profile.budget_per_person_min,
        budgetPerPersonMax: m.profile.budget_per_person_max,
        preferredTrains: m.profile.preferred_trains ?? [],
        amenityMustHaves: m.profile.amenity_must_haves ?? [],
        moveInDate: m.profile.move_in_date,
        locationFlexible: m.profile.location_flexible,
        wfh: m.profile.wfh,
      } : undefined,
    }));

    for (const listing of listings) {
      if (memberIds.includes(listing.host_id)) continue;

      const { data: existing } = await supabase
        .from('group_listing_matches')
        .select('id, unlock_status')
        .eq('group_id', group.id)
        .eq('listing_id', listing.id)
        .single();

      if (existing?.unlock_status === 'unlocked') continue;

      const combinedBudgetMax = memberProfiles.reduce(
        (sum: number, m: any) => sum + (m.apartmentPrefs?.budgetPerPersonMax ?? 0), 0
      );
      const allTrains = [...new Set(
        memberProfiles.flatMap((m: any) => m.apartmentPrefs?.preferredTrains ?? [])
      )];
      const desiredBedrooms = memberProfiles[0]?.apartmentPrefs?.desiredBedrooms ?? 2;

      if (listing.price > combinedBudgetMax * 1.1) continue;
      if (listing.bedrooms !== desiredBedrooms) continue;

      const nearbyTrains = NEIGHBORHOOD_TRAINS[listing.neighborhood ?? ''] ?? [];
      const transitMatches = allTrains.filter((t: string) => nearbyTrains.includes(t));
      const transitScore = allTrains.length > 0
        ? Math.round((transitMatches.length / allTrains.length) * 100)
        : 60;

      const budgetScore = combinedBudgetMax > 0
        ? Math.min(100, Math.round((combinedBudgetMax / listing.price) * 80))
        : 0;

      const matchScore = Math.round(transitScore * 0.45 + budgetScore * 0.55);

      if (matchScore < MATCH_THRESHOLD) continue;

      const { data: hostData } = await supabase
        .from('users')
        .select('plan, host_type')
        .eq('id', listing.host_id)
        .single();

      const hostPlan = hostData?.plan ?? 'free';
      let unlockFeeCents = 2900;
      if (hostPlan === 'pro') unlockFeeCents = 1900;
      if (hostPlan === 'business') unlockFeeCents = 0;

      await supabase
        .from('group_listing_matches')
        .upsert({
          group_id: group.id,
          listing_id: listing.id,
          match_score: matchScore,
          score_breakdown: { transitScore, budgetScore },
          unlock_fee_cents: unlockFeeCents,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'group_id,listing_id' });

      if (!existing) {
        await supabase
          .from('notifications')
          .insert({
            user_id: listing.host_id,
            type: 'group_match',
            title: 'A group might be perfect for your listing',
            body: `A group of ${memberIds.length} renters is a ${matchScore}% match for your ${listing.bedrooms}BR in ${listing.neighborhood ?? 'your area'}. Unlock their profile to connect.`,
            data: JSON.stringify({
              listing_id: listing.id,
              group_id: group.id,
              match_score: matchScore,
              member_count: memberIds.length,
            }),
          });

        matchCount++;
      }
    }
  }

  return new Response(JSON.stringify({ matched: matchCount }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
