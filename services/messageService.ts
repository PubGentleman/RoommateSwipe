import { supabase } from '../lib/supabase';
import { canAccessMessages, canAccessConversation } from '../utils/messagingAccess';

async function checkMessagingPaywall(userId: string, conversationId?: string) {
  if (!userId) return;

  const { data: userRow } = await supabase
    .from('users')
    .select('role, host_type, agent_plan, company_plan, free_message_unlock_used, free_message_unlock_conversation_id')
    .eq('id', userId)
    .single();

  if (!userRow) return;

  let hostPlan = 'free';
  if (userRow.agent_plan) hostPlan = userRow.agent_plan;
  if (userRow.company_plan) hostPlan = userRow.company_plan;

  const fakeUser = {
    role: userRow.role,
    hostType: userRow.host_type,
    agentPlan: userRow.agent_plan,
    freeMessageUnlockUsed: userRow.free_message_unlock_used,
    freeMessageUnlockConversationId: userRow.free_message_unlock_conversation_id,
    hostSubscription: { plan: hostPlan },
  } as any;

  if (!canAccessMessages(fakeUser)) {
    if (conversationId && canAccessConversation(fakeUser, conversationId)) {
      return;
    }
    throw new Error('Messaging is locked. Upgrade your plan to send messages.');
  }
}

export async function getConversations(userId: string) {
  if (!userId) return [];

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      user_id_1,
      user_id_2,
      match_type,
      status,
      compatibility_score,
      created_at,
      user1:users!user_id_1(id, full_name, avatar_url, city),
      user2:users!user_id_2(id, full_name, avatar_url, city),
      messages(id, content, created_at, sender_id, read, read_at)
    `)
    .eq('status', 'matched')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!matches || matches.length === 0) return [];

  const conversations = matches.map((match: any) => {
    const otherUser = match.user_id_1 === userId ? match.user2 : match.user1;
    const msgs = match.messages || [];
    const sortedMsgs = [...msgs].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastMsg = sortedMsgs[0];
    const unreadCount = msgs.filter(
      (m: any) => m.sender_id !== userId && !m.read && !m.read_at
    ).length;

    return {
      matchId: match.id,
      matchType: match.match_type,
      compatibilityScore: match.compatibility_score,
      participant: otherUser,
      lastMessage: lastMsg?.content || null,
      lastMessageAt: lastMsg?.created_at || match.created_at,
      unreadCount,
    };
  });

  return conversations.sort((a: any, b: any) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

export async function getMessages(matchId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function sendMessage(userId: string, matchId: string, content: string) {
  if (!userId) throw new Error('Not authenticated');

  await checkMessagingPaywall(userId, matchId);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: userId,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function sendStructuredMessage(
  userId: string,
  matchId: string,
  messageType: string,
  metadata: Record<string, any>,
  displayContent: string
) {
  if (!userId) throw new Error('Not authenticated');

  await checkMessagingPaywall(userId, matchId);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: userId,
      content: displayContent,
      message_type: messageType,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMessageMetadata(
  messageId: string,
  metadataUpdates: Record<string, any>
) {
  const { data: existing } = await supabase
    .from('messages')
    .select('metadata')
    .eq('id', messageId)
    .single();

  const merged = { ...(existing?.metadata || {}), ...metadataUpdates };

  const { error } = await supabase
    .from('messages')
    .update({ metadata: merged })
    .eq('id', messageId);

  if (error) throw error;
}

export async function markMessagesAsRead(userId: string, matchId: string) {
  if (!userId) return;

  await supabase
    .from('messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', userId)
    .eq('read', false);
}

export async function sendColdMessage(userId: string, recipientId: string, content: string) {
  if (!userId) throw new Error('Not authenticated');

  const userId1 = userId < recipientId ? userId : recipientId;
  const userId2 = userId < recipientId ? recipientId : userId;

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      user_id_1: userId1,
      user_id_2: userId2,
      match_type: 'cold',
      status: 'matched',
    })
    .select()
    .single();

  if (matchError) throw matchError;

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      match_id: match.id,
      sender_id: userId,
      content,
    })
    .select()
    .single();

  if (msgError) throw msgError;

  return { match, message };
}

export function subscribeToMessages(matchId: string, onMessage: (message: any) => void) {
  const channel = supabase
    .channel(`match-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        onMessage(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToAllMessages(userId: string, onUpdate: () => void) {
  const channel = supabase
    .channel(`user-messages-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== userId) {
          onUpdate();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getHostConversations(hostId: string): Promise<any[]> {
  try {
    const { data: inquiryGroups, error } = await supabase
      .from('inquiry_groups')
      .select(`
        id,
        host_id,
        listing_id,
        listing_address,
        status,
        created_at,
        updated_at,
        members:group_members(
          user_id,
          users:user_id(id, full_name, avatar_url)
        ),
        messages:group_messages(
          id, content, sender_id, created_at, read
        )
      `)
      .eq('host_id', hostId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error || !inquiryGroups) return [];

    return inquiryGroups.map((group: any) => {
      const sortedMsgs = (group.messages || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMsg = sortedMsgs[0];
      const unread = (group.messages || []).filter(
        (m: any) => m.sender_id !== hostId && !m.read
      ).length;
      const memberUser = group.members?.[0]?.users;

      return {
        id: `conv-interest-${group.id}`,
        hostId: group.host_id,
        listingId: group.listing_id,
        listingAddress: group.listing_address,
        isInquiryThread: true,
        inquiryStatus: group.status,
        name: memberUser?.full_name || 'Renter',
        avatar: memberUser?.avatar_url || null,
        participant: memberUser || null,
        lastMessage: lastMsg?.content || '',
        timestamp: new Date(lastMsg?.created_at || group.updated_at),
        unread,
        messages: [],
      };
    });
  } catch (e) {
    console.warn('[messageService] Failed to load host conversations:', e);
    return [];
  }
}
