import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ status: 'ERROR', error_message: 'Missing authorization header' }),
      { headers: corsHeaders, status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ status: 'ERROR', error_message: 'Unauthorized' }),
      { headers: corsHeaders, status: 401 }
    );
  }

  let action = 'autocomplete';
  let input = '';
  let placeId = '';

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      action = body.action || 'autocomplete';
      input = body.input || '';
      placeId = body.place_id || '';
    } catch {
      // fallback to URL params
    }
  }

  if (!input && !placeId) {
    const url = new URL(req.url);
    action = url.searchParams.get('action') || action;
    input = url.searchParams.get('input') || input;
    placeId = url.searchParams.get('place_id') || placeId;
  }

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
