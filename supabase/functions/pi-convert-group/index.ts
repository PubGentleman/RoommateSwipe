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
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this group' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await admin
      .from('groups')
      .select('id')
      .eq('pi_auto_group_id', auto_group_id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ group_id: existing.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: autoGroup } = await admin
      .from('pi_auto_groups')
      .select('*')
      .eq('id', auto_group_id)
      .single();

    if (!autoGroup) {
      return new Response(JSON.stringify({ error: 'Auto group not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: members } = await admin
      .from('pi_auto_group_members')
      .select('user_id')
      .eq('group_id', auto_group_id)
      .eq('status', 'accepted');

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'No accepted members' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allMembers = await admin
      .from('pi_auto_group_members')
      .select('user_id, status')
      .eq('group_id', auto_group_id);

    const allAccepted = (allMembers.data ?? []).every(
      (m: { status: string }) => m.status === 'accepted'
    );

    if (!allAccepted) {
      return new Response(JSON.stringify({ error: 'Not all members have accepted' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creatorId = autoGroup.anchor_user_id || members[0].user_id;

    const { data: newGroup, error: groupError } = await admin
      .from('groups')
      .insert({
        name: 'Pi Match Group',
        created_by: creatorId,
        group_type: 'roommate',
        pi_auto_group_id: auto_group_id,
      })
      .select('id')
      .single();

    if (groupError) {
      if (groupError.code === '23505') {
        const { data: raceGroup } = await admin
          .from('groups')
          .select('id')
          .eq('pi_auto_group_id', auto_group_id)
          .limit(1)
          .single();
        if (raceGroup) {
          return new Response(JSON.stringify({ group_id: raceGroup.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: 'Failed to create group' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberInserts = members.map((m: { user_id: string }) => ({
      group_id: newGroup.id,
      user_id: m.user_id,
      role: m.user_id === creatorId ? 'admin' : 'member',
      joined_at: new Date().toISOString(),
    }));

    const { error: memberError } = await admin
      .from('group_members')
      .insert(memberInserts);

    if (memberError) {
      await admin.from('groups').delete().eq('id', newGroup.id);
      return new Response(JSON.stringify({ error: 'Failed to add members' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin
      .from('pi_auto_groups')
      .update({ status: 'placed' })
      .eq('id', auto_group_id);

    return new Response(JSON.stringify({ group_id: newGroup.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
