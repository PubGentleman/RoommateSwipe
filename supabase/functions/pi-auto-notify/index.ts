import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CORS_HEADERS, errorResponse, jsonResponse, stripName,
  getPiNotifContent, sendPushNotifications,
} from '../_shared/pi-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

const ACCEPTANCE_HOURS = 72;

function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`) return true;
  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return true;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (!verifyCronAuth(req)) {
    return errorResponse('Unauthorized: service-role or cron secret required', 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const groupId: string = body.pi_auto_group_id || body.group_id;

    if (!groupId) return errorResponse('pi_auto_group_id is required', 400);

    const { data: group, error: groupError } = await supabase
      .from('pi_auto_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) return errorResponse('Group not found', 404);

    const { data: members, error: memberError } = await supabase
      .from('pi_auto_group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('invited_at', { ascending: true });

    if (memberError || !members || members.length === 0) {
      return errorResponse('No members found', 404);
    }

    const memberUserIds = members.map((m: any) => m.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, name')
      .in('id', memberUserIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const deadline = new Date(Date.now() + ACCEPTANCE_HOURS * 60 * 60 * 1000).toISOString();

    await supabase
      .from('pi_auto_groups')
      .update({
        status: 'pending_acceptance',
        acceptance_deadline: deadline,
      })
      .eq('id', groupId);

    const avgScore = group.avg_compatibility_score || 0;
    let notificationsSent = 0;
    let pushNotificationsSent = 0;

    for (const member of members) {
      const otherNames = members
        .filter((m: any) => m.user_id !== member.user_id)
        .map((m: any) => {
          const u = userMap.get(m.user_id);
          return stripName(u?.full_name || u?.name);
        });

      const content = getPiNotifContent('pi_group_assembled', {
        groupId,
        memberNames: otherNames,
        groupScore: avgScore,
        deadline,
        memberCount: members.length,
        city: group.city,
      });

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: member.user_id,
        type: 'pi_group_assembled',
        title: content.title,
        body: content.body,
        read: false,
        data: {
          groupId,
          memberNames: otherNames,
          groupScore: avgScore,
          deadline,
          memberCount: members.length,
          city: group.city,
        },
      });

      if (!notifError) notificationsSent++;

      const pushCount = await sendPushNotifications(
        supabase,
        member.user_id,
        content.title,
        content.body,
        { type: 'pi_group_assembled', groupId }
      );
      pushNotificationsSent += pushCount;
    }

    return jsonResponse({
      success: true,
      group_id: groupId,
      notifications_sent: notificationsSent,
      push_notifications_sent: pushNotificationsSent,
      deadline,
      members_notified: memberUserIds,
    });
  } catch (err: any) {
    console.error('pi-auto-notify error:', err);
    return errorResponse('Notification delivery failed', 500);
  }
});
