import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (req.method === 'GET') {
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('existing_roommates')
      .select(`
        id, first_name, sleep_schedule, cleanliness, smoking, pets,
        lifestyle_tags, guests_frequency, noise_level, profile_completed,
        listings!existing_roommates_listing_id_fkey (
          address, neighborhood, bedrooms
        )
      `)
      .eq('invite_token', token)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const {
      token: bodyToken,
      firstName,
      sleepSchedule,
      cleanliness,
      smoking,
      pets,
      lifestyleTags,
      guestsFrequency,
      noiseLevel,
    } = body;

    const useToken = bodyToken || token;

    if (!useToken) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabase
      .from('existing_roommates')
      .select('id, profile_completed')
      .eq('invite_token', useToken)
      .single();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('existing_roommates')
      .update({
        first_name: firstName,
        sleep_schedule: sleepSchedule,
        cleanliness: parseInt(cleanliness) || null,
        smoking: Boolean(smoking),
        pets: Boolean(pets),
        lifestyle_tags: lifestyleTags || [],
        guests_frequency: guestsFrequency,
        noise_level: noiseLevel,
        profile_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('invite_token', useToken);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: corsHeaders,
  });
});
