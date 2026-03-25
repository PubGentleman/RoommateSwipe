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

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { listingId, userMessage, conversationHistory, requestType } = await req.json();

    const { data: listing } = await supabase
      .from('listings')
      .select('address, city, state, zip, lat, lng, neighborhood, rent, bedrooms, bathrooms, title, neighborhood_briefing, neighborhood_briefing_at, walk_score, transit_score')
      .eq('id', listingId)
      .single();

    if (!listing) throw new Error('Listing not found');

    if (requestType === 'briefing') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      if (
        listing.neighborhood_briefing &&
        listing.neighborhood_briefing_at &&
        listing.neighborhood_briefing_at > sevenDaysAgo
      ) {
        return new Response(JSON.stringify({
          reply: listing.neighborhood_briefing,
          walkScore: listing.walk_score,
          transitScore: listing.transit_score,
          neighborhood: listing.neighborhood || listing.city,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const fullAddress = `${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}`;
    const lat = listing.lat;
    const lng = listing.lng;

    const { data: profile } = await supabase
      .from('profiles')
      .select('work_style, occupation, budget_min, budget_max, move_in_date, neighborhoods')
      .eq('user_id', user.id)
      .single();

    const [walkScoreData, nearbyPlaces] = await Promise.all([
      (async () => {
        try {
          const wsKey = Deno.env.get('WALKSCORE_API_KEY');
          if (!wsKey || !lat || !lng) return null;
          const wsUrl = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(fullAddress)}&lat=${lat}&lon=${lng}&transit=1&bike=1&wsapikey=${wsKey}`;
          const res = await fetch(wsUrl);
          return await res.json();
        } catch {
          return null;
        }
      })(),

      (async () => {
        if (!lat || !lng) return null;
        const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
        if (!googleKey) return null;
        const radius = 800;
        const categories = ['grocery_or_supermarket', 'restaurant', 'cafe', 'gym', 'bar', 'transit_station', 'park'];
        const results: Record<string, any[]> = {};

        await Promise.all(categories.map(async (type) => {
          try {
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${googleKey}`;
            const res = await fetch(url);
            const data = await res.json();
            results[type] = (data.results || []).slice(0, 3).map((p: any) => ({
              name: p.name,
              rating: p.rating,
              vicinity: p.vicinity,
            }));
          } catch {
            results[type] = [];
          }
        }));

        return results;
      })(),
    ]);

    const walkContext = walkScoreData?.walkscore ? `
Walk Score: ${walkScoreData.walkscore}/100 (${walkScoreData.description})
Transit Score: ${walkScoreData.transit?.score ?? 'N/A'}/100 ${walkScoreData.transit?.description ? `(${walkScoreData.transit.description})` : ''}
Bike Score: ${walkScoreData.bike?.score ?? 'N/A'}/100 ${walkScoreData.bike?.description ? `(${walkScoreData.bike.description})` : ''}
    `.trim() : 'Walk/transit scores unavailable';

    const placesContext = nearbyPlaces ? `
NEARBY (within ~10 min walk):
Grocery stores: ${nearbyPlaces.grocery_or_supermarket?.map((p: any) => p.name).join(', ') || 'none found'}
Restaurants: ${nearbyPlaces.restaurant?.map((p: any) => `${p.name}${p.rating ? ` (${p.rating}*)` : ''}`).join(', ') || 'none found'}
Cafes: ${nearbyPlaces.cafe?.map((p: any) => p.name).join(', ') || 'none found'}
Gyms: ${nearbyPlaces.gym?.map((p: any) => p.name).join(', ') || 'none found'}
Bars/nightlife: ${nearbyPlaces.bar?.map((p: any) => p.name).join(', ') || 'none found'}
Transit stops: ${nearbyPlaces.transit_station?.map((p: any) => p.name).join(', ') || 'none found'}
Parks: ${nearbyPlaces.park?.map((p: any) => p.name).join(', ') || 'none found'}
    `.trim() : 'Nearby places data unavailable';

    const listingContext = `
LISTING: ${listing.title || fullAddress}
Address: ${fullAddress}
Neighborhood: ${listing.neighborhood || listing.city}
Rent: $${listing.rent}/mo | ${listing.bedrooms}bd/${listing.bathrooms}ba
    `.trim();

    const userContext = profile ? `
USER CONTEXT:
- Work style: ${profile.work_style || 'unknown'} ${profile.work_style === 'remote' ? '(works from home - transit less critical)' : ''}
- Occupation: ${profile.occupation || 'unknown'}
- Budget: $${profile.budget_min}-$${profile.budget_max}/mo
- Preferred neighborhoods: ${profile.neighborhoods?.join(', ') || 'flexible'}
    `.trim() : '';

    const systemPrompt = `You are Rhome AI, helping a renter evaluate a specific neighborhood before committing to a lease.

${listingContext}

NEIGHBORHOOD DATA:
${walkContext}

${placesContext}

${userContext}

YOUR ROLE:
- Give honest, practical neighborhood assessments - not marketing copy
- Reference the actual data above (scores, specific place names) to make your answers feel real and grounded
- If the user works remotely, note that transit matters less; if they mentioned a commute, factor that in
- Characterize the vibe based on what's nearby (lots of bars = nightlife area, parks + cafes = family-friendly, etc.)
- Be direct about tradeoffs - a low walk score isn't a dealbreaker, but the user should know
- Keep responses conversational and concise - 3-5 sentences unless more detail is genuinely needed
- When asked about safety, be factual and measured - don't sensationalize, don't sugarcoat

If this is the first message (briefing request), give a structured overview covering:
1. The vibe / what kind of neighborhood this is
2. Walkability and getting around
3. What's nearby that matters day-to-day
4. One honest thing to know (positive or negative)

For follow-up questions, answer directly and conversationally.`;

    const messages: { role: 'user' | 'assistant'; content: string }[] = requestType === 'briefing'
      ? [{ role: 'user', content: 'Give me a neighborhood briefing for this listing.' }]
      : [
          ...(conversationHistory || []),
          { role: 'user', content: userMessage },
        ];

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    if (requestType === 'briefing') {
      await supabase
        .from('listings')
        .update({
          neighborhood_briefing: reply,
          neighborhood_briefing_at: new Date().toISOString(),
          walk_score: walkScoreData?.walkscore ?? null,
          transit_score: walkScoreData?.transit?.score ?? null,
        })
        .eq('id', listingId);
    }

    return new Response(JSON.stringify({
      reply,
      walkScore: walkScoreData?.walkscore ?? null,
      transitScore: walkScoreData?.transit?.score ?? null,
      neighborhood: listing.neighborhood || listing.city,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ai-neighborhood-info error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
