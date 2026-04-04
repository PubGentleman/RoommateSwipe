import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrimeSummary {
  total: number;
  categories: Record<string, number>;
  period: string;
}

async function fetchNYCCrimeData(lat: number, lng: number): Promise<CrimeSummary | null> {
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
    return { total: data.length, categories, period: '90 days' };
  } catch {
    return null;
  }
}

async function fetchWalkScore(address: string, lat: number, lng: number): Promise<{ walk: number | null; transit: number | null; bike: number | null } | null> {
  try {
    const wsKey = Deno.env.get('WALKSCORE_API_KEY');
    if (!wsKey) return null;
    const url = `https://api.walkscore.com/score?format=json&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lng}&transit=1&bike=1&wsapikey=${wsKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      walk: data.walkscore ?? null,
      transit: data.transit?.score ?? null,
      bike: data.bike?.score ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchOverpassAmenities(lat: number, lng: number): Promise<{
  transitStops: number;
  restaurants: number;
  grocery: { name: string; distance: number }[];
  parks: number;
  cafes: number;
  laundromats: number;
} | null> {
  try {
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    const query = `[out:json][timeout:10];(node["amenity"="subway_entrance"](around:800,${latStr},${lngStr});node["highway"="bus_stop"](around:800,${latStr},${lngStr});node["amenity"="bus_station"](around:800,${latStr},${lngStr});node["railway"="station"](around:800,${latStr},${lngStr});node["amenity"="restaurant"](around:500,${latStr},${lngStr});node["amenity"="cafe"](around:500,${latStr},${lngStr});node["amenity"="supermarket"](around:800,${latStr},${lngStr});node["shop"="supermarket"](around:800,${latStr},${lngStr});node["amenity"="laundry"](around:500,${latStr},${lngStr});node["shop"="laundry"](around:500,${latStr},${lngStr});node["leisure"="park"](around:500,${latStr},${lngStr}););out body;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const elements = data.elements || [];
    let transitStops = 0;
    let restaurants = 0;
    let cafes = 0;
    let parks = 0;
    let laundromats = 0;
    const groceryList: { name: string; distance: number }[] = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const highway = tags.highway || '';
      const railway = tags.railway || '';
      if (amenity === 'subway_entrance' || highway === 'bus_stop' || amenity === 'bus_station' || railway === 'station') transitStops++;
      else if (amenity === 'restaurant') restaurants++;
      else if (amenity === 'cafe') cafes++;
      else if (leisure === 'park') parks++;
      else if (amenity === 'laundry' || shop === 'laundry') laundromats++;
      else if (amenity === 'supermarket' || shop === 'supermarket') {
        const dLat = (el.lat - lat) * 111320;
        const dLng = (el.lon - lng) * 111320 * Math.cos(lat * Math.PI / 180);
        const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
        groceryList.push({ name: tags.name || 'Grocery store', distance: dist });
      }
    }
    groceryList.sort((a, b) => a.distance - b.distance);
    return { transitStops, restaurants, cafes, grocery: groceryList.slice(0, 3), parks, laundromats };
  } catch {
    return null;
  }
}

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

function buildDataContext(
  crime: CrimeSummary | null,
  walkScores: { walk: number | null; transit: number | null; bike: number | null } | null,
  amenities: Awaited<ReturnType<typeof fetchOverpassAmenities>>,
  isNYC: boolean,
): string {
  const sections: string[] = [];

  if (walkScores) {
    const parts: string[] = [];
    if (walkScores.walk !== null) parts.push(`Walk Score: ${walkScores.walk}/100`);
    if (walkScores.transit !== null) parts.push(`Transit Score: ${walkScores.transit}/100`);
    if (walkScores.bike !== null) parts.push(`Bike Score: ${walkScores.bike}/100`);
    if (parts.length > 0) sections.push(parts.join(' | '));
  }

  if (crime) {
    const topCats = Object.entries(crime.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    sections.push(`Crime incidents within 500m (last ${crime.period}): ${crime.total} total. Top categories: ${topCats}`);
  } else if (isNYC) {
    sections.push('Crime data: No incidents found within 500m in the last 90 days, or data temporarily unavailable.');
  }

  if (amenities) {
    const parts: string[] = [];
    if (amenities.transitStops > 0) parts.push(`Transit stops nearby: ${amenities.transitStops}`);
    if (amenities.restaurants > 0) parts.push(`Restaurants within walking distance: ${amenities.restaurants}`);
    if (amenities.cafes > 0) parts.push(`Cafes nearby: ${amenities.cafes}`);
    if (amenities.parks > 0) parts.push(`Parks nearby: ${amenities.parks}`);
    if (amenities.laundromats > 0) parts.push(`Laundromats nearby: ${amenities.laundromats}`);
    if (amenities.grocery.length > 0) {
      const nearest = amenities.grocery[0];
      parts.push(`Nearest grocery: ${nearest.name} (~${nearest.distance}m away)`);
    }
    if (parts.length > 0) sections.push(parts.join('\n'));
  }

  if (sections.length === 0) {
    return 'Limited neighborhood data available for this area.';
  }

  return sections.join('\n\n');
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

    const { question, neighborhood, city, listingId, conversationHistory } = await req.json();

    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({
        reply: 'Could you rephrase your question? I want to make sure I give you accurate info.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let listingContext = '';
    let neighborhoodName = neighborhood || '';
    let cityName = city || '';
    let lat: number | null = null;
    let lng: number | null = null;
    let fullAddress = '';

    if (listingId) {
      const { data: listing } = await supabase
        .from('listings')
        .select('address, city, state, zip, neighborhood, rent, bedrooms, bathrooms, title, lat, lng')
        .eq('id', listingId)
        .single();

      if (listing) {
        neighborhoodName = neighborhoodName || listing.neighborhood || listing.city || '';
        cityName = cityName || listing.city || '';
        lat = listing.lat;
        lng = listing.lng;
        fullAddress = `${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}`;
        listingContext = `LISTING: ${listing.title || fullAddress}
Address: ${fullAddress}
Neighborhood: ${neighborhoodName}
Rent: $${listing.rent}/mo | ${listing.bedrooms}bd/${listing.bathrooms}ba`;
      }
    }

    let dataContext = 'No real-time neighborhood data available for this area.';

    if (lat && lng) {
      const nyc = isNYCArea(cityName, '', lat, lng);

      const [crimeData, walkScores, amenities] = await Promise.all([
        nyc ? fetchNYCCrimeData(lat, lng) : Promise.resolve(null),
        fetchWalkScore(fullAddress || `${neighborhoodName}, ${cityName}`, lat, lng),
        fetchOverpassAmenities(lat, lng),
      ]);

      dataContext = buildDataContext(crimeData, walkScores, amenities, nyc);
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({
        reply: `Based on available data for ${neighborhoodName || 'this area'}: ${dataContext.split('\n')[0]}. For more specific details, I'd recommend visiting the neighborhood at different times of day.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are Pi, a neighborhood expert for Rhome, a rental housing app.
You answer questions about ${neighborhoodName || 'this neighborhood'}${cityName ? ` in ${cityName}` : ''}.

${listingContext}

REAL DATA ABOUT THIS AREA:
${dataContext}

RULES:
- Give a specific, honest 2-3 sentence answer based on the real data above
- Reference actual numbers, scores, and place names from the data
- NEVER say "check local forums" or give vague advice like "visit the area" or "look it up online"
- If crime data is available, use it honestly — don't sensationalize but don't sugarcoat
- If Walk Score is available, reference it to characterize walkability
- For cities where crime data isn't available, use Walk Score and amenity data and be transparent: "Based on walkability and amenity data for this area..."
- Keep it conversational and concise
- If asked about something the data doesn't cover, give your best informed answer based on the neighborhood characteristics shown in the data, and be upfront about what you're inferring vs what you know`;

    try {
      const anthropic = new Anthropic({ apiKey });

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...(conversationHistory || []),
        { role: 'user', content: question },
      ];

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages,
      });

      const reply = response.content[0].type === 'text' ? response.content[0].text : '';

      if (!reply) {
        return new Response(JSON.stringify({
          reply: `For ${neighborhoodName || 'this area'}: ${dataContext.split('\n')[0]}. Feel free to ask me a more specific question.`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (claudeError) {
      console.error('Claude API error in neighborhood-chat:', claudeError);
      return new Response(JSON.stringify({
        reply: `Based on data for ${neighborhoodName || 'this area'}: ${dataContext.split('\n')[0]}. I'm having trouble with a detailed analysis right now, but feel free to try again.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('neighborhood-chat error:', error);
    return new Response(JSON.stringify({
      reply: 'I ran into an issue looking that up. Try asking again in a moment.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
