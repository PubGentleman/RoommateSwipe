import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, record, table } = payload;

    if (type !== 'INSERT') {
      return new Response('Not an insert', { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (table === 'messages') {
      const { match_id, sender_id, content, message_type } = record;

      const { data: match } = await supabase
        .from('matches')
        .select('user_id_1, user_id_2')
        .eq('id', match_id)
        .single();

      if (!match) return new Response('Match not found', { status: 200 });

      const recipientId = match.user_id_1 === sender_id
        ? match.user_id_2
        : match.user_id_1;

      const { data: sender } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', sender_id)
        .single();

      const { data: tokenRow } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', recipientId)
        .single();

      if (!tokenRow?.token) return new Response('No push token', { status: 200 });

      const senderName = sender?.full_name || 'Someone';
      let body = content || '';
      if (message_type === 'image') body = 'Sent a photo';
      if (message_type === 'file') body = 'Sent a file';
      if (message_type === 'visit_request') body = 'Sent a visit request';
      if (message_type === 'booking_offer') body = 'Sent a booking offer';
      if (body.length > 100) body = body.substring(0, 97) + '...';

      await sendExpoPush(tokenRow.token, {
        title: senderName,
        body,
        data: {
          type: 'new_message',
          matchId: match_id,
          senderId: sender_id,
        },
        channelId: 'messages',
      });

    } else if (table === 'group_messages') {
      const { group_id, sender_id, content } = record;

      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', group_id)
        .eq('status', 'active')
        .neq('user_id', sender_id);

      if (!members || members.length === 0) {
        return new Response('No recipients', { status: 200 });
      }

      const { data: group } = await supabase
        .from('groups')
        .select('name, listing_address')
        .eq('id', group_id)
        .single();

      const { data: sender } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', sender_id)
        .single();

      const groupName = group?.name || group?.listing_address || 'Group';
      const senderName = sender?.full_name || 'Someone';
      let body = content || '';
      if (body.length > 100) body = body.substring(0, 97) + '...';

      const recipientIds = members.map((m: any) => m.user_id);
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', recipientIds);

      if (!tokens || tokens.length === 0) {
        return new Response('No push tokens', { status: 200 });
      }

      const pushMessages = tokens.map((t: any) => ({
        to: t.token,
        title: groupName,
        body: `${senderName}: ${body}`,
        data: {
          type: 'new_group_message',
          groupId: group_id,
          senderId: sender_id,
        },
        channelId: 'messages',
        sound: 'default',
      }));

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function sendExpoPush(token: string, message: {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
}) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title: message.title,
      body: message.body,
      data: message.data || {},
      sound: 'default',
      channelId: message.channelId || 'messages',
    }),
  });

  if (!response.ok) {
    console.error('Expo push failed:', await response.text());
  }
}
