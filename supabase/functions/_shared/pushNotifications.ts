import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string;
}

export async function sendPushToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  payload: PushPayload
): Promise<{ sent: number; skipped: string | null }> {
  const { data: userData } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', userId)
    .single();

  if (userData?.notification_preferences) {
    const prefs = userData.notification_preferences;
    const prefMap: Record<string, string> = {
      'match': 'matches',
      'super_like': 'superLikes',
      'interest_received': 'matches',
      'interest_accepted': 'matches',
      'message': 'messages',
      'meetup_suggestion': 'messages',
      'group_invite': 'groupInvites',
      'group_accepted': 'groupUpdates',
      'group_complete': 'groupUpdates',
      'pi_group_assembled': 'groupUpdates',
      'pi_member_accepted': 'groupUpdates',
      'pi_group_confirmed': 'groupUpdates',
      'pi_member_declined': 'groupUpdates',
      'pi_group_expired': 'groupUpdates',
      'pi_deadline_reminder': 'groupUpdates',
      'property_update': 'propertyUpdates',
      'property_rented': 'propertyUpdates',
      'background_check': 'systemAlerts',
      'system': 'systemAlerts',
    };

    const prefKey = prefMap[notificationType];
    if (prefKey && prefs[prefKey] === false) {
      return { sent: 0, skipped: 'preference_disabled' };
    }
  }

  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !tokens || tokens.length === 0) {
    return { sent: 0, skipped: 'no_tokens' };
  }

  const messages = tokens.map((t: any) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: { type: notificationType, ...(payload.data || {}) },
    sound: payload.sound || 'default',
    badge: payload.badge || 1,
    ...(payload.channelId ? { channelId: payload.channelId } : {}),
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          await supabase
            .from('push_tokens')
            .update({ is_active: false })
            .eq('token', tokens[i].token);
        }
      }
    }

    return { sent: messages.length, skipped: null };
  } catch (err) {
    console.error('[Push] Send error:', err);
    return { sent: 0, skipped: 'send_failed' };
  }
}

export async function notifyUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  notification: {
    type: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    read: false,
  });

  await sendPushToUser(supabase, userId, notification.type, {
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });
}
