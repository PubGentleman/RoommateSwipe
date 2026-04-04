import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isNYCArea(city: string, state: string, lat: number, lng: number): boolean {
  const cityLower = (city || '').toLowerCase();
  const stateLower = (state || '').toLowerCase();
  if (stateLower === 'ny' || stateLower === 'new york') {
    if (cityLower.includes('new york') || cityLower.includes('brooklyn') ||
        cityLower.includes('queens') || cityLower.includes('bronx') ||
        cityLower.includes('manhattan') || cityLower.includes('staten island')) {
      return true;
    }
  }
  if (lat >= 40.4 && lat <= 40.95 && lng >= -74.3 && lng <= -73.7) return true;
  return false;
}

async function fetchNYCCrimeData(lat: number, lng: number): Promise<{ total: number; summary: string } | null> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];
    const url = `https://data.cityofnewyork.us/resource/5uac-w243.json?$where=within_circle(latitude,longitude,${lat},${lng},500) AND cmplnt_fr_dt > '${dateStr}'&$limit=200`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const categories: Record<string, number> = {};
    for (const incident of data) {
      const cat = incident.ofns_desc || incident.pd_desc || 'Other';
      const normalized = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      categories[normalized] = (categories[normalized] || 0) + 1;
    }
    const topCats = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    return { total: data.length, summary: `${data.length} incidents within 500m (last 90 days). Top categories: ${topCats}` };
  } catch {
    return null;
  }
}

async function fetchOverpassAmenities(lat: number, lng: number): Promise<string> {
  try {
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    const query = `[out:json][timeout:10];(node["amenity"="subway_entrance"](around:800,${latStr},${lngStr});node["highway"="bus_stop"](around:800,${latStr},${lngStr});node["amenity"="bus_station"](around:800,${latStr},${lngStr});node["railway"="station"](around:800,${latStr},${lngStr});node["amenity"="restaurant"](around:500,${latStr},${lngStr});node["amenity"="cafe"](around:500,${latStr},${lngStr});node["amenity"="supermarket"](around:800,${latStr},${lngStr});node["shop"="supermarket"](around:800,${latStr},${lngStr});node["amenity"="laundry"](around:500,${latStr},${lngStr});node["shop"="laundry"](around:500,${latStr},${lngStr});node["leisure"="park"](around:500,${latStr},${lngStr});node["amenity"="gym"](around:500,${latStr},${lngStr});node["amenity"="bar"](around:500,${latStr},${lngStr}););out body;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return 'Nearby places data unavailable';
    const data = await res.json();
    const elements = data.elements || [];
    let transit = 0, restaurants = 0, cafes = 0, parks = 0, laundromats = 0, gyms = 0, bars = 0;
    const groceryNames: string[] = [];
    const transitNames: string[] = [];
    const parkNames: string[] = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const highway = tags.highway || '';
      const railway = tags.railway || '';
      if (amenity === 'subway_entrance' || highway === 'bus_stop' || amenity === 'bus_station' || railway === 'station') {
        transit++;
        if (tags.name && transitNames.length < 3) transitNames.push(tags.name);
      } else if (amenity === 'restaurant') restaurants++;
      else if (amenity === 'cafe') cafes++;
      else if (amenity === 'bar') bars++;
      else if (amenity === 'gym') gyms++;
      else if (leisure === 'park') {
        parks++;
        if (tags.name && parkNames.length < 3) parkNames.push(tags.name);
      } else if (amenity === 'laundry' || shop === 'laundry') laundromats++;
      else if (amenity === 'supermarket' || shop === 'supermarket') {
        if (tags.name) groceryNames.push(tags.name);
      }
    }
    const lines: string[] = [];
    lines.push(`Grocery stores: ${groceryNames.length > 0 ? groceryNames.join(', ') : 'none found nearby'}`);
    lines.push(`Restaurants: ${restaurants} nearby`);
    lines.push(`Cafes: ${cafes} nearby`);
    lines.push(`Bars/nightlife: ${bars} nearby`);
    lines.push(`Gyms: ${gyms} nearby`);
    lines.push(`Transit stops: ${transit}${transitNames.length > 0 ? ` (${transitNames.join(', ')})` : ''}`);
    lines.push(`Parks: ${parks}${parkNames.length > 0 ? ` (${parkNames.join(', ')})` : ''}`);
    lines.push(`Laundromats: ${laundromats} nearby`);
    return `NEARBY (within ~10 min walk):\n${lines.join('\n')}`;
  } catch {
    return 'Nearby places data unavailable';
  }
}

serve(async (req) => {
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

    const nyc = (lat && lng) ? isNYCArea(listing.city, listing.state, lat, lng) : false;

    const [walkScoreData, placesContext, crimeData] = await Promise.all([
      (async () => {
        try {
          const wsKey = Deno.env.get('WALKSCORE_API_KEY');
          if (!wsKey || !lat || !lng) return null;
          const wsUrl = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(fullAddress)}&lat=${lat}&lon=${lng}&transit=1&bike=1&wsapikey=${wsKey}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(wsUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      })(),
      (lat && lng) ? fetchOverpassAmenities(lat, lng) : Promise.resolve('Nearby places data unavailable'),
      (lat && lng && nyc) ? fetchNYCCrimeData(lat, lng) : Promise.resolve(null),
    ]);

    const walkContext = walkScoreData?.walkscore ? `
Walk Score: ${walkScoreData.walkscore}/100 (${walkScoreData.description})
Transit Score: ${walkScoreData.transit?.score ?? 'N/A'}/100 ${walkScoreData.transit?.description ? `(${walkScoreData.transit.description})` : ''}
Bike Score: ${walkScoreData.bike?.score ?? 'N/A'}/100 ${walkScoreData.bike?.description ? `(${walkScoreData.bike.description})` : ''}
    `.trim() : 'Walk/transit scores unavailable';

    const crimeContext = crimeData
      ? `\nCRIME DATA:\n${crimeData.summary}`
      : (nyc ? '\nCrime data: No incidents found within 500m in the last 90 days, or data temporarily unavailable.' : '');

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

    const systemPrompt = `You are Pi, helping a renter evaluate a specific neighborhood before committing to a lease.

${listingContext}

NEIGHBORHOOD DATA:
${walkContext}
${crimeContext}

${placesContext}

${userContext}

YOUR ROLE:
- Give honest, practical neighborhood assessments - not marketing copy
- Reference the actual data above (scores, specific place names, crime stats) to make your answers feel real and grounded
- If crime data is available, present it factually - don't sensationalize but don't hide it either
- If the user works remotely, note that transit matters less; if they mentioned a commute, factor that in
- Characterize the vibe based on what's nearby (lots of bars = nightlife area, parks + cafes = family-friendly, etc.)
- Be direct about tradeoffs - a low walk score isn't a dealbreaker, but the user should know
- Keep responses conversational and concise - 3-5 sentences unless more detail is genuinely needed
- NEVER say "check local forums" or give vague advice. Always use the real data provided above.
- For areas without crime data, acknowledge it: "Based on walkability and amenity data..."

If this is the first message (briefing request), give a structured overview covering:
1. The vibe / what kind of neighborhood this is
2. Walkability and getting around
3. What's nearby that matters day-to-day
4. One honest thing to know (positive or negative)

For follow-up questions, answer directly and conversationally.`;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({
        reply: `${listing.neighborhood || listing.city}: ${walkContext}. ${placesContext.split('\n').slice(0, 3).join('. ')}`,
        walkScore: walkScoreData?.walkscore ?? null,
        transitScore: walkScoreData?.transit?.score ?? null,
        neighborhood: listing.neighborhood || listing.city,
        fallback: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const messages: { role: 'user' | 'assistant'; content: string }[] = requestType === 'briefing'
      ? [{ role: 'user', content: 'Give me a neighborhood briefing for this listing.' }]
      : [
          ...(conversationHistory || []),
          { role: 'user', content: userMessage },
        ];

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
    return new Response(JSON.stringify({
      reply: 'This is a neighborhood with a mix of amenities and transit options. Ask me specific questions below for more details about safety, commute, nightlife, or nearby spots.',
      walkScore: null,
      transitScore: null,
      neighborhood: null,
      fallback: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
