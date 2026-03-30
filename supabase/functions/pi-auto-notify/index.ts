import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, errorResponse, jsonResponse, stripName } from '../_shared/pi-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ACCEPTANCE_HOURS = 72;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

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
        status: 'invited',
        acceptance_deadline: deadline,
      })
      .eq('id', groupId);

    const notifications = [];
    let notificationsSent = 0;

    for (const member of members) {
      const otherNames = members
        .filter((m: any) => m.user_id !== member.user_id)
        .map((m: any) => {
          const u = userMap.get(m.user_id);
          return stripName(u?.full_name || u?.name);
        });

      const avgScore = group.avg_compatibility_score || 0;
      const scoreText = avgScore > 0 ? ` ${avgScore}% compatible.` : '';

      const title = 'Pi found your roommates!';
      const notifBody = `Meet ${otherNames.join(' & ')} --${scoreText} I put this group together because I think you'd genuinely enjoy living together. You have ${ACCEPTANCE_HOURS} hours to say yes.`;

      notifications.push({
        user_id: member.user_id,
        type: 'pi_group_assembled',
        title,
        body: notifBody,
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
    }

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Notification insert error:', notifError);
      } else {
        notificationsSent = notifications.length;
      }
    }

    return jsonResponse({
      success: true,
      group_id: groupId,
      notifications_sent: notificationsSent,
      deadline,
      members_notified: memberUserIds,
    });
  } catch (err: any) {
    console.error('pi-auto-notify error:', err);
    return errorResponse('Notification delivery failed', 500);
  }
});
