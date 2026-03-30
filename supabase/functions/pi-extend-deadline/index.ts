import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { auto_group_id } = await req.json();
    if (!auto_group_id) {
      return new Response(JSON.stringify({ error: 'Missing auto_group_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: membership } = await admin
      .from('pi_auto_group_members')
      .select('id')
      .eq('group_id', auto_group_id)
      .eq('user_id', user.id)
      .in('status', ['pending', 'accepted'])
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this group' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: group } = await admin
      .from('pi_auto_groups')
      .select('acceptance_deadline, expires_at, deadline_extended')
      .eq('id', auto_group_id)
      .single();

    if (!group) {
      return new Response(JSON.stringify({ error: 'Group not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (group.deadline_extended === true) {
      return new Response(JSON.stringify({
        error: 'Already extended',
        acceptance_deadline: group.acceptance_deadline,
        deadline_extended: true,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentDeadline = group.acceptance_deadline || group.expires_at;
    if (!currentDeadline) {
      return new Response(JSON.stringify({ error: 'No deadline set' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentTime = new Date(currentDeadline).getTime();
    const newDeadline = new Date(currentTime + 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await admin
      .from('pi_auto_groups')
      .update({ acceptance_deadline: newDeadline, deadline_extended: true })
      .eq('id', auto_group_id)
      .not('deadline_extended', 'eq', true);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to extend deadline' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      acceptance_deadline: newDeadline,
      deadline_extended: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
