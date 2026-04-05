import { supabase } from '../lib/supabase';

export async function getNotifications(userId: string, limit = 50) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  if (!userId) return;

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function getUnreadCount(userId: string) {
  if (!userId) return 0;

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  return count || 0;
}

export type PiAutoMatchNotificationType =
  | 'pi_group_assembled'
  | 'pi_member_accepted'
  | 'pi_group_confirmed'
  | 'pi_member_declined'
  | 'pi_group_expired'
  | 'pi_replacement_found'
  | 'pi_agent_new_group'
  | 'pi_deadline_reminder'
  | 'pi_replacement_vote'
  | 'pi_replacement_approved'
  | 'pi_replacement_invited'
  | 'pi_no_replacement'
  | 'pi_group_dissolved_member'
  | 'group_join_request_received'
  | 'group_join_request_approved'
  | 'group_join_request_declined';

export interface PiNotificationData {
  groupId: string;
  memberNames?: string[];
  groupScore?: number;
  acceptedBy?: string;
  declinedBy?: string;
  deadline?: string;
  city?: string;
  memberCount?: number;
  spotsNeeded?: number;
}

const PI_NOTIFICATION_TEMPLATES: Record<PiAutoMatchNotificationType, {
  title: (data: PiNotificationData) => string;
  body: (data: PiNotificationData) => string;
}> = {
  pi_group_assembled: {
    title: () => 'Pi found your roommates!',
    body: (data) => {
      const names = data.memberNames?.join(' & ') || 'your matches';
      const score = data.groupScore ? ` ${data.groupScore}% compatible.` : '';
      return `Meet ${names} --${score} I put this group together because I think you'd genuinely enjoy living together. You have 72 hours to say yes.`;
    },
  },
  pi_member_accepted: {
    title: () => 'Someone said yes!',
    body: (data) => {
      const name = data.acceptedBy || 'A group member';
      return `${name} is in! They liked what they saw and want to be part of this group. Waiting on the others now.`;
    },
  },
  pi_group_confirmed: {
    title: () => 'Your group is official!',
    body: (data) => {
      const names = data.memberNames?.join(', ') || 'Everyone';
      return `${names} -- everyone said yes. Your Pi-matched group is now active and ready to start the apartment search together.`;
    },
  },
  pi_member_declined: {
    title: () => 'A member passed',
    body: (data) => {
      const name = data.declinedBy || 'A group member';
      return `${name} decided this group wasn't the right fit. I'm already looking for someone who'd be a great replacement.`;
    },
  },
  pi_group_expired: {
    title: () => 'Group timed out',
    body: () => `This group's acceptance window has closed. Don't worry -- I'm still working behind the scenes to find your ideal roommates. I'll reach out when I have another strong match.`,
  },
  pi_replacement_found: {
    title: () => 'Pi found a replacement!',
    body: (data) => {
      const names = data.memberNames?.join(' & ') || 'a new match';
      return `Good news -- I found ${names} to fill the open spot. Check out their profile and let me know what you think.`;
    },
  },
  pi_agent_new_group: {
    title: () => 'New Pi-matched group available',
    body: (data) => {
      const city = data.city || 'your area';
      const count = data.memberCount || 2;
      return `A new ${count}-person group just matched in ${city}. They're pre-vetted and compatible -- claim them before another host does.`;
    },
  },
  pi_deadline_reminder: {
    title: () => 'Time is running out',
    body: () => "You have less than 24 hours to respond to your Pi group invite. Don't miss out on these roommates!",
  },
  pi_replacement_vote: {
    title: () => 'Vote on a new roommate',
    body: (data) => {
      const names = data.memberNames?.join(' & ') || 'a potential roommate';
      return `I found ${names} to fill the open spot. Check them out and vote on whether they'd be a good fit.`;
    },
  },
  pi_replacement_approved: {
    title: () => 'Replacement approved!',
    body: () => 'The group voted yes on the new roommate. They have 72 hours to accept the invite.',
  },
  pi_replacement_invited: {
    title: () => 'Pi found your new roommates!',
    body: () => "Great news -- a group voted you in as their new roommate. Check out the group and decide if it's the right fit.",
  },
  pi_no_replacement: {
    title: () => 'No replacement found',
    body: () => "I couldn't find a compatible replacement in time. The group has been dissolved, but I'm still looking for your perfect match.",
  },
  pi_group_dissolved_member: {
    title: () => 'Group dissolved',
    body: () => "A member chose to start fresh. Don't worry -- Pi is still looking for your perfect roommates.",
  },
  group_join_request_received: {
    title: () => 'Someone wants to join your group',
    body: (data) => {
      const name = data.acceptedBy || 'A renter';
      return `${name} sent a request to join your group. Review their profile and vote!`;
    },
  },
  group_join_request_approved: {
    title: () => 'Your join request was approved!',
    body: () => "Great news -- the group voted you in! You're now a member. Head to the Groups tab to meet everyone.",
  },
  group_join_request_declined: {
    title: () => 'Join request update',
    body: () => "The group you applied to has filled up or decided to pass. Keep looking -- there are more groups open!",
  },
};

export function getPiNotificationContent(
  type: PiAutoMatchNotificationType,
  data: PiNotificationData
): { title: string; body: string } {
  const template = PI_NOTIFICATION_TEMPLATES[type];
  return {
    title: template.title(data),
    body: template.body(data),
  };
}

export async function createPiAutoMatchNotification(
  userId: string,
  type: PiAutoMatchNotificationType,
  data: PiNotificationData
): Promise<void> {
  const content = getPiNotificationContent(type, data);
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title: content.title,
    body: content.body,
    read: false,
    data: { groupId: data.groupId, ...data },
  });
}

export async function createSavedSearchMatchNotification(
  userId: string,
  searchName: string,
  matchCount: number,
  savedSearchId: string
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'saved_search_match',
    title: 'New matches found!',
    body: `${matchCount} new listing${matchCount !== 1 ? 's' : ''} match your "${searchName}" search.`,
    read: false,
    data: { savedSearchId, matchCount, searchName },
  });
}

export function subscribeToNotifications(userId: string, onNotification: (notification: any) => void) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
