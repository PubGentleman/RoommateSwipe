import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { groupId, inviteCode, email, phone, isCouple } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: group } = await supabase
      .from('preformed_groups')
      .select('name, group_lead_id')
      .eq('id', groupId)
      .eq('group_lead_id', caller.id)
      .single();

    if (!group) {
      return new Response(JSON.stringify({ error: 'Not authorized to send invites for this group' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const inviterName = caller.user_metadata?.full_name || 'Someone';
    const groupName = group?.name || 'a group';
    const joinLink = `https://rhome.app/join/${inviteCode}`;

    if (email) {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'Rhome <hello@rhomeapp.io>',
            to: email,
            subject: `${inviterName} invited you to search for apartments on Rhome`,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #333;">You're invited!</h2>
                <p>${inviterName} wants you to join <strong>${groupName}</strong> on Rhome to search for apartments together.</p>
                ${isCouple ? '<p style="color: #ec4899;">You\'re being added as a couple — you\'ll share one bedroom.</p>' : ''}
                <a href="${joinLink}" style="display: inline-block; background: #ff6b5b; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 16px 0;">Join the Group</a>
                <p style="color: #888; font-size: 13px;">Or use invite code: <strong>${inviteCode}</strong></p>
                <p style="color: #aaa; font-size: 11px; margin-top: 32px;">Always Rhome Inc. — hello@rhomeapp.io</p>
              </div>
            `,
          }),
        });
      }

      await supabase
        .from('group_invites')
        .update({ delivery_status: 'sent' })
        .eq('invite_code', inviteCode);
    }

    if (phone) {
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioFrom = Deno.env.get('TWILIO_FROM_NUMBER');

      if (twilioSid && twilioToken && twilioFrom) {
        const message = `${inviterName} invited you to search for apartments together on Rhome! Join here: ${joinLink}`;
        const params = new URLSearchParams({
          To: phone,
          From: twilioFrom,
          Body: message,
        });

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
      }

      await supabase
        .from('group_invites')
        .update({ delivery_status: 'sent' })
        .eq('invite_code', inviteCode);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-group-invite error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send invite' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
