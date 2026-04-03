import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: userData } = await supabase
      .from('users')
      .select('role, host_type')
      .eq('id', user.id)
      .single();

    if (userData?.host_type !== 'company') {
      return new Response(JSON.stringify({ error: 'Not authorized — company hosts only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { listingId, groupId, companyHostId, matchScore, aiReason } = await req.json();

    if (!listingId || !groupId || !companyHostId) {
      return new Response(JSON.stringify({ error: 'listingId, groupId, and companyHostId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (companyHostId !== user.id) {
      return new Response(JSON.stringify({ error: 'Cannot act on behalf of another company' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listingOwner } = await supabase
      .from('listings')
      .select('created_by')
      .eq('id', listingId)
      .single();

    if (!listingOwner || listingOwner.created_by !== user.id) {
      return new Response(JSON.stringify({ error: 'Listing does not belong to this company' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (!members?.length) {
      return new Response(JSON.stringify({ error: 'No group members found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listing } = await supabase
      .from('listings')
      .select('address, neighborhood, rent, bedrooms')
      .eq('id', listingId)
      .single();

    const { error: inviteError } = await supabase
      .from('company_group_invites')
      .upsert({
        company_host_id: companyHostId,
        listing_id: listingId,
        group_id: groupId,
        match_score: matchScore || 0,
        ai_reason: aiReason || null,
        status: 'pending',
      }, { onConflict: 'listing_id,group_id' });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberIds = members.map(m => m.user_id);
    for (const userId of memberIds) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'company_group_invite',
        title: 'A property matched your group!',
        body: `${listing?.bedrooms}BR in ${listing?.neighborhood} — $${listing?.rent}/mo. A property manager selected your group.`,
        data: JSON.stringify({
          type: 'company_group_invite',
          listingId,
          groupId,
        }),
      });
    }

    await supabase
      .from('listing_fill_pipeline')
      .upsert({
        listing_id: listingId,
        total_invites_sent: 0,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'listing_id', ignoreDuplicates: true });

    await supabase.rpc('increment_listing_invites', { p_listing_id: listingId });

    return new Response(JSON.stringify({ success: true, notified: memberIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
