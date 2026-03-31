import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'autocomplete';
  const input = url.searchParams.get('input') || '';
  const placeId = url.searchParams.get('place_id') || '';

  if (!GOOGLE_KEY) {
    return new Response(
      JSON.stringify({ status: 'ERROR', error_message: 'Google Maps API key not configured' }),
      { headers: corsHeaders, status: 500 }
    );
  }

  let googleUrl: string;

  if (action === 'details' && placeId) {
    googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_components,geometry&key=${GOOGLE_KEY}`;
  } else {
    googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=geocode&components=country:us&key=${GOOGLE_KEY}`;
  }

  try {
    const response = await fetch(googleUrl);
    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'ERROR', error_message: String(error) }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
