import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, errorResponse, jsonResponse, stripName } from '../_shared/pi-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

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

      if (accepted.length >= 2 && accepted.length >= Math.ceil(group.max_members * 0.5)) {
        await supabase
          .from('pi_auto_groups')
          .update({ status: 'forming' })
          .eq('id', group.id);

        const acceptedNames = accepted.map((m: any) => {
          const u = userMap.get(m.user_id);
          return stripName(u?.full_name || u?.name);
        });

        for (const member of accepted) {
          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'pi_member_declined',
            title: 'Some members didn\'t respond',
            body: `Not everyone in your group responded in time, but ${acceptedNames.length} of you said yes. I'm looking for a replacement to complete the group.`,
            read: false,
            data: {
              groupId: group.id,
              memberNames: acceptedNames,
              memberCount: accepted.length,
            },
          });
        }

        partial++;
        results.push({
          group_id: group.id,
          action: 'partial_acceptance',
          accepted: accepted.length,
          expired: pending.length,
        });
      } else {
        await supabase
          .from('pi_auto_groups')
          .update({ status: 'expired', dissolved_at: now })
          .eq('id', group.id);

        for (const member of [...accepted, ...members.filter((m: any) => m.status === 'declined')]) {
          const memberName = (() => {
            const u = userMap.get(member.user_id);
            return stripName(u?.full_name || u?.name);
          })();

          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'pi_group_expired',
            title: 'Group timed out',
            body: `This group's acceptance window has closed. Don't worry -- I'm still working behind the scenes to find your ideal roommates. I'll reach out when I have another strong match.`,
            read: false,
            data: { groupId: group.id },
          });
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
