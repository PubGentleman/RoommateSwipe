import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, errorResponse, jsonResponse, stripName } from '../_shared/pi-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

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
    const now = new Date().toISOString();

    const { data: expiredGroups, error: queryError } = await supabase
      .from('pi_auto_groups')
      .select('*')
      .in('status', ['forming', 'invited'])
      .lt('acceptance_deadline', now);

    if (queryError) return errorResponse(`Query failed: ${queryError.message}`, 500);
    if (!expiredGroups || expiredGroups.length === 0) {
      return jsonResponse({ processed: 0, message: 'No expired groups' });
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
          .update({ status: 'expired', dissolved_at: now })
          .eq('id', group.id);
        dissolved++;
        continue;
      }

      const accepted = members.filter((m: any) => m.status === 'accepted');
      const pending = members.filter((m: any) => m.status === 'pending');

      await supabase
        .from('pi_auto_group_members')
        .update({ status: 'expired' })
        .eq('group_id', group.id)
        .eq('status', 'pending');

      const memberUserIds = members.map((m: any) => m.user_id);
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, name')
        .in('id', memberUserIds);
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));

      const meetsPartialThreshold = accepted.length >= 2 && accepted.length >= Math.ceil(group.max_members * 0.5);

      if (meetsPartialThreshold) {
        const spotsNeeded = group.max_members - accepted.length;
        const newDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('pi_auto_groups')
          .update({
            status: 'forming',
            acceptance_deadline: newDeadline,
          })
          .eq('id', group.id);

        const acceptedNames = accepted.map((m: any) => {
          const u = userMap.get(m.user_id);
          return stripName(u?.full_name || u?.name);
        });

        for (const member of accepted) {
          const { data: pushTokens } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('user_id', member.user_id);

          const title = 'Looking for a replacement';
          const body = `Not everyone in your group responded in time, but ${acceptedNames.length} of you said yes. I'm looking for ${spotsNeeded === 1 ? 'a replacement' : `${spotsNeeded} replacements`} to complete the group.`;

          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'pi_replacement_found',
            title,
            body,
            read: false,
            data: {
              groupId: group.id,
              memberNames: acceptedNames,
              memberCount: accepted.length,
              spotsNeeded,
            },
          });

          if (pushTokens && pushTokens.length > 0) {
            for (const tokenRow of pushTokens) {
              try {
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: tokenRow.token,
                    title,
                    body,
                    data: { type: 'pi_replacement_found', groupId: group.id },
                    sound: 'default',
                  }),
                });
              } catch (pushErr) {
                console.error('Push send error:', pushErr);
              }
            }
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
          .from('pi_auto_groups')
          .update({ status: 'expired', dissolved_at: now })
          .eq('id', group.id);

        const allNotifiable = members.filter((m: any) => m.status === 'accepted' || m.status === 'declined');
        for (const member of allNotifiable) {
          const title = 'Group timed out';
          const body = `This group's acceptance window has closed. Don't worry -- I'm still working behind the scenes to find your ideal roommates. I'll reach out when I have another strong match.`;

          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'pi_group_expired',
            title,
            body,
            read: false,
            data: { groupId: group.id },
          });

          const { data: pushTokens } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('user_id', member.user_id);

          if (pushTokens && pushTokens.length > 0) {
            for (const tokenRow of pushTokens) {
              try {
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: tokenRow.token,
                    title,
                    body,
                    data: { type: 'pi_group_expired', groupId: group.id },
                    sound: 'default',
                  }),
                });
              } catch (pushErr) {
                console.error('Push send error:', pushErr);
              }
            }
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

    return jsonResponse({
      processed: expiredGroups.length,
      dissolved,
      partial_acceptance: partial,
      results,
    });
  } catch (err: any) {
    console.error('pi-auto-expire error:', err);
    return errorResponse('Expiry processing failed', 500);
  }
});
