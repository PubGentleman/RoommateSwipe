import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CORS_HEADERS, errorResponse, jsonResponse, stripName,
  getPiNotifContent, sendPushNotifications, verifyCronAuth,
} from '../_shared/pi-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (!verifyCronAuth(req)) {
    return errorResponse('Unauthorized: service-role or cron secret required', 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const nowIso = now.toISOString();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    let remindersSent = 0;

    const { data: groupsNearDeadline } = await supabase
      .from('pi_auto_groups')
      .select('*, pi_auto_group_members(*)')
      .eq('status', 'pending_acceptance')
      .lte('acceptance_deadline', in24h)
      .gt('acceptance_deadline', nowIso);

    if (groupsNearDeadline && groupsNearDeadline.length > 0) {
      for (const group of groupsNearDeadline) {
        const members = group.pi_auto_group_members || [];
        const unresponded = members.filter(
          (m: any) => m.status === 'pending' && !m.reminder_sent
        );

        if (unresponded.length === 0) continue;

        const memberUserIds = members.map((m: any) => m.user_id);
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, name')
          .in('id', memberUserIds);
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const acceptedNames = members
          .filter((m: any) => m.status === 'accepted')
          .map((m: any) => {
            const u = userMap.get(m.user_id);
            return stripName(u?.full_name || u?.name);
          })
          .filter(Boolean);

        const notifData = {
          groupId: group.id,
          memberNames: acceptedNames.length > 0 ? acceptedNames : undefined,
        };
        const content = getPiNotifContent('pi_deadline_reminder', notifData);

        const reminderNotifs = unresponded.map((member: any) => ({
          user_id: member.user_id,
          type: 'pi_deadline_reminder',
          title: content.title,
          body: content.body,
          read: false,
          data: { groupId: group.id },
        }));
        await supabase.from('notifications').insert(reminderNotifs);

        for (const member of unresponded) {
          await sendPushNotifications(
            supabase,
            member.user_id,
            content.title,
            content.body,
            { type: 'pi_deadline_reminder', groupId: group.id }
          );

          await supabase
            .from('pi_auto_group_members')
            .update({ reminder_sent: true })
            .eq('id', member.id);

          remindersSent++;
        }
      }
    }

    const { data: expiredGroups, error: queryError } = await supabase
      .from('pi_auto_groups')
      .select('*')
      .in('status', ['forming', 'pending_acceptance', 'partial', 'awaiting_replacement_vote'])
      .lt('acceptance_deadline', nowIso);

    if (queryError) return errorResponse(`Query failed: ${queryError.message}`, 500);
    if (!expiredGroups || expiredGroups.length === 0) {
      return jsonResponse({ processed: 0, reminders_sent: remindersSent, message: 'No expired groups' });
    }

    let dissolved = 0;
    let partial = 0;
    const results: any[] = [];

    for (const group of expiredGroups) {
      const { data: members } = await supabase
        .from('pi_auto_group_members')
        .select('*')
        .eq('group_id', group.id);

      if (!members || members.length === 0) {
        await supabase
          .from('pi_auto_groups')
          .update({ status: 'dissolved', dissolved_at: nowIso })
          .eq('id', group.id);
        dissolved++;
        continue;
      }

      const accepted = members.filter((m: any) => m.status === 'accepted');
      const pending = members.filter((m: any) => m.status === 'pending');

      const memberUserIds = members.map((m: any) => m.user_id);
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, name')
        .in('id', memberUserIds);
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));

      if (group.status === 'awaiting_replacement_vote') {
        await supabase
          .from('pi_auto_group_members')
          .update({ status: 'expired' })
          .eq('group_id', group.id)
          .eq('is_replacement', true)
          .eq('status', 'pending');

        await supabase
          .from('pi_auto_groups')
          .update({ status: 'dissolved', dissolved_at: nowIso })
          .eq('id', group.id);

        const noRepContent = getPiNotifContent('pi_no_replacement', { groupId: group.id });
        if (accepted.length > 0) {
          const noRepNotifs = accepted.map((member: any) => ({
            user_id: member.user_id,
            type: 'pi_no_replacement',
            title: noRepContent.title,
            body: noRepContent.body,
            read: false,
            data: { groupId: group.id },
          }));
          await supabase.from('notifications').insert(noRepNotifs);

          for (const member of accepted) {
            await sendPushNotifications(
              supabase, member.user_id,
              noRepContent.title, noRepContent.body,
              { type: 'pi_no_replacement', groupId: group.id }
            );
          }
        }

        dissolved++;
        results.push({ group_id: group.id, action: 'replacement_vote_expired' });
        continue;
      }

      const meetsPartialThreshold = accepted.length >= 1 && accepted.length < group.max_members;

      if (meetsPartialThreshold) {
        const spotsNeeded = group.max_members - accepted.length;
        const newDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('pi_auto_group_members')
          .update({ status: 'expired' })
          .eq('group_id', group.id)
          .eq('status', 'pending');

        await supabase
          .from('pi_auto_groups')
          .update({
            status: 'partial',
            acceptance_deadline: newDeadline,
          })
          .eq('id', group.id);

        const acceptedNames = accepted.map((m: any) => {
          const u = userMap.get(m.user_id);
          return stripName(u?.full_name || u?.name);
        });

        const notifData = {
          groupId: group.id,
          memberNames: acceptedNames,
          memberCount: accepted.length,
          spotsNeeded,
        };
        const content = getPiNotifContent('pi_replacement_found', notifData);

        if (accepted.length > 0) {
          const repFoundNotifs = accepted.map((member: any) => ({
            user_id: member.user_id,
            type: 'pi_replacement_found',
            title: content.title,
            body: content.body,
            read: false,
            data: notifData,
          }));
          await supabase.from('notifications').insert(repFoundNotifs);

          for (const member of accepted) {
            await sendPushNotifications(
              supabase,
              member.user_id,
              content.title,
              content.body,
              { type: 'pi_replacement_found', groupId: group.id }
            );
          }
        }

        try {
          await fetch(`${SUPABASE_URL}/functions/v1/pi-auto-assemble`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              city: group.city,
              replacement_for_group: group.id,
              spots_needed: spotsNeeded,
              exclude_users: memberUserIds,
            }),
          });
        } catch (replacementErr) {
          console.error('Replacement search trigger error:', replacementErr);
        }

        partial++;
        results.push({
          group_id: group.id,
          action: 'partial_acceptance',
          accepted: accepted.length,
          expired: pending.length,
          spots_needed: spotsNeeded,
          replacement_search_triggered: true,
        });
      } else {
        await supabase
          .from('pi_auto_group_members')
          .update({ status: 'expired' })
          .eq('group_id', group.id)
          .in('status', ['pending', 'accepted']);

        await supabase
          .from('pi_auto_groups')
          .update({ status: 'dissolved', dissolved_at: nowIso })
          .eq('id', group.id);

        const expiredContent = getPiNotifContent('pi_group_expired', { groupId: group.id });

        const allNotifiable = members.filter((m: any) => m.status === 'accepted' || m.status === 'declined');
        if (allNotifiable.length > 0) {
          const expiredNotifs = allNotifiable.map((member: any) => ({
            user_id: member.user_id,
            type: 'pi_group_expired',
            title: expiredContent.title,
            body: expiredContent.body,
            read: false,
            data: { groupId: group.id },
          }));
          await supabase.from('notifications').insert(expiredNotifs);

          for (const member of allNotifiable) {
            await sendPushNotifications(
              supabase,
              member.user_id,
              expiredContent.title,
              expiredContent.body,
              { type: 'pi_group_expired', groupId: group.id }
            );
          }
        }

        dissolved++;
        results.push({
          group_id: group.id,
          action: 'dissolved',
          accepted: accepted.length,
          expired: pending.length,
        });
      }
    }

    let joinRequestsExpired = 0;
    const { data: staleRequests } = await supabase
      .from('group_join_requests')
      .select('id, requester_id, pi_auto_group_id, preformed_group_id')
      .eq('status', 'pending')
      .lt('expires_at', nowIso);

    if (staleRequests && staleRequests.length > 0) {
      const staleIds = staleRequests.map((r: any) => r.id);
      await supabase
        .from('group_join_requests')
        .update({ status: 'expired', decided_at: nowIso })
        .in('id', staleIds);

      joinRequestsExpired = staleIds.length;
    }

    return jsonResponse({
      processed: expiredGroups.length,
      dissolved,
      partial_acceptance: partial,
      reminders_sent: remindersSent,
      join_requests_expired: joinRequestsExpired,
      results,
    });
  } catch (err: any) {
    console.error('pi-auto-expire error:', err);
    return errorResponse('Expiry processing failed', 500);
  }
});
