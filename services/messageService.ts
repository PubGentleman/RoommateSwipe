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
      user2:users!user_id_2(id, full_name, avatar_url, city)
    `)
    .eq('status', 'matched')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!matches || matches.length === 0) return [];

  const conversationData = await Promise.all(
    matches.map(async (match: any) => {
      const [lastMsgResult, unreadResult] = await Promise.all([
        supabase
          .from('messages')
          .select('id, content, created_at, sender_id')
          .eq('match_id', match.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', match.id)
          .neq('sender_id', userId)
          .eq('read', false),
      ]);

      const otherUser = match.user_id_1 === userId ? match.user2 : match.user1;
      const lastMsg = lastMsgResult.data;

      return {
        matchId: match.id,
        matchType: match.match_type,
        compatibilityScore: match.compatibility_score,
        participant: otherUser,
        lastMessage: lastMsg?.content || null,
        lastMessageAt: lastMsg?.created_at || match.created_at,
        unreadCount: unreadResult.count || 0,
      };
    })
  );

  return conversationData.sort((a: any, b: any) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

export async function getMessages(matchId: string, limit = 50, offset = 0, options?: { beforeCursor?: string }) {
  let query = supabase
    .from('messages')
    .select(`
      *,
      reply_to:reply_to_id(id, content, sender_id),
      reactions:message_reactions(id, emoji, user_id)
    `)
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (options?.beforeCursor) {
    query = query.lt('created_at', options.beforeCursor).range(0, limit - 1);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function checkEmailVerification() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser && !authUser.email_confirmed_at) {
    throw new Error('Please verify your email before sending messages.');
  }
}

export async function sendMessage(userId: string, matchId: string, content: string) {
  if (!userId) throw new Error('Not authenticated');

  await checkEmailVerification();
  await checkMessagingPaywall(userId, matchId);

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();

  const plan = sub?.plan || 'basic';

  if (plan !== 'elite') {
    const DAILY_LIMITS: Record<string, number> = { basic: 20, plus: 200 };
    const limit = DAILY_LIMITS[plan] ?? 20;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .gte('created_at', todayStart.toISOString());

    if (count !== null && count >= limit) {
      throw new Error('Daily message limit reached. Upgrade your plan for more messages.');
    }
  }

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

  await checkEmailVerification();
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

  await checkEmailVerification();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();

  const plan = sub?.plan || 'basic';
  const COLD_LIMITS: Record<string, number> = { basic: 3, plus: 10, elite: 99999 };
  const limit = COLD_LIMITS[plan] ?? 3;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('match_type', 'cold')
    .gte('created_at', todayStart.toISOString())
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

  if (!countError && count !== null && count >= limit) {
    throw new Error('Daily cold message limit reached. Upgrade your plan for more.');
  }

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
      .from('groups')
      .select(`
        id,
        host_id,
        listing_id,
        listing_address,
        inquiry_status,
        created_at,
        updated_at,
        members:group_members(
          user_id,
          users:user_id(id, full_name, avatar_url)
        )
      `)
      .eq('host_id', hostId)
      .eq('type', 'listing_inquiry')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error || !inquiryGroups) return [];

    const results = await Promise.all(
      inquiryGroups.map(async (group: any) => {
        const [lastMsgResult, unreadResult] = await Promise.all([
          supabase
            .from('group_messages')
            .select('id, content, sender_id, created_at')
            .eq('group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('group_messages')
            .select('id, read_by')
            .eq('group_id', group.id)
            .neq('sender_id', hostId),
        ]);

        const lastMsg = lastMsgResult.data;
        const unreadMsgs = unreadResult.data || [];
        const unread = unreadMsgs.filter(
          (m: any) => !m.read_by || !m.read_by.includes(hostId)
        ).length;
        const memberUser = group.members?.[0]?.users;

        return {
          id: `conv-interest-${group.id}`,
          hostId: group.host_id,
          listingId: group.listing_id,
          listingAddress: group.listing_address,
          isInquiryThread: true,
          inquiryStatus: group.inquiry_status,
          name: memberUser?.full_name || 'Renter',
          avatar: memberUser?.avatar_url || null,
          participant: memberUser || null,
          lastMessage: lastMsg?.content || '',
          timestamp: lastMsg?.created_at || group.updated_at,
          unread,
          messages: [],
        };
      })
    );

    return results;
  } catch (e) {
    console.warn('[messageService] Failed to load host conversations:', e);
    return [];
  }
}

export async function searchMessages(userId: string, query: string, limit = 20) {
  if (!userId || !query || query.length < 2) return [];

  const { data: matches } = await supabase
    .from('matches')
    .select('id, user_id_1, user_id_2')
    .eq('status', 'matched')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

  if (!matches || matches.length === 0) return [];

  const matchIds = matches.map(m => m.id);

  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      match_id,
      sender_id,
      content,
      message_type,
      created_at,
      sender:users!sender_id(id, full_name, avatar_url)
    `)
    .in('match_id', matchIds)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !messages) return [];

  return messages.map((msg: any) => {
    const match = matches.find(m => m.id === msg.match_id);
    const otherUserId = match
      ? (match.user_id_1 === userId ? match.user_id_2 : match.user_id_1)
      : null;

    return {
      messageId: msg.id,
      matchId: msg.match_id,
      content: msg.content,
      messageType: msg.message_type,
      senderName: msg.sender?.full_name || 'Unknown',
      senderPhoto: msg.sender?.avatar_url,
      senderId: msg.sender_id,
      createdAt: msg.created_at,
      otherUserId,
      isMine: msg.sender_id === userId,
    };
  });
}

export async function searchGroupMessages(userId: string, query: string, limit = 10) {
  if (!userId || !query || query.length < 2) return [];

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  const { data: messages, error } = await supabase
    .from('group_messages')
    .select(`
      id,
      group_id,
      sender_id,
      content,
      created_at,
      group:groups!group_id(id, name, type, listing_address)
    `)
    .in('group_id', groupIds)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !messages) return [];

  return messages.map((msg: any) => ({
    messageId: msg.id,
    groupId: msg.group_id,
    groupName: msg.group?.name || msg.group?.listing_address || 'Group',
    groupType: msg.group?.type,
    content: msg.content,
    senderId: msg.sender_id,
    createdAt: msg.created_at,
  }));
}

export function joinChatPresence(
  matchId: string,
  userId: string,
  onTypingChange: (isTyping: boolean, typingUserId: string) => void
) {
  const channel = supabase.channel(`chat-presence-${matchId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      let otherTyping = false;
      let typingUid = '';
      for (const [uid, presences] of Object.entries(state)) {
        if (uid !== userId) {
          const latest = (presences as any[])?.[0];
          if (latest?.typing) {
            otherTyping = true;
            typingUid = uid;
            break;
          }
        }
      }
      onTypingChange(otherTyping, typingUid);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ typing: false });
      }
    });

  return {
    setTyping: async (isTyping: boolean) => {
      await channel.track({ typing: isTyping });
    },
    unsubscribe: () => {
      channel.untrack();
      supabase.removeChannel(channel);
    },
  };
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const { error } = await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id,emoji' });
  if (error) throw error;
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
  if (error) throw error;
}

export async function getReactions(messageIds: string[]) {
  if (!messageIds.length) return {};
  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji')
    .in('message_id', messageIds);
  if (error) throw error;

  const grouped: Record<string, { emoji: string; userIds: string[]; count: number }[]> = {};
  (data || []).forEach((r: any) => {
    if (!grouped[r.message_id]) grouped[r.message_id] = [];
    const existing = grouped[r.message_id].find((e: any) => e.emoji === r.emoji);
    if (existing) {
      existing.userIds.push(r.user_id);
      existing.count++;
    } else {
      grouped[r.message_id].push({ emoji: r.emoji, userIds: [r.user_id], count: 1 });
    }
  });
  return grouped;
}

export async function sendReplyMessage(
  userId: string, matchId: string, content: string, replyToId: string
) {
  await checkMessagingPaywall(userId, matchId);
  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: userId, content, reply_to_id: replyToId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(messageId: string, userId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), content: 'This message was deleted' })
    .eq('id', messageId)
    .eq('sender_id', userId);
  if (error) throw error;
}

export async function editMessage(messageId: string, userId: string, newContent: string) {
  const { error } = await supabase
    .from('messages')
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', userId);
  if (error) throw error;
}

export async function sendVoiceMessage(
  userId: string, matchId: string, audioUri: string, durationMs: number
) {
  await checkMessagingPaywall(userId, matchId);

  const fileName = `voice_${userId}_${Date.now()}.m4a`;
  const filePath = `voice-messages/${matchId}/${fileName}`;

  const response = await fetch(audioUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('chat-media')
    .upload(filePath, blob, { contentType: 'audio/m4a' });
  if (uploadError) throw uploadError;

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);
  const audioUrl = signedUrlData?.signedUrl || filePath;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: userId,
      content: 'Voice message',
      message_type: 'voice',
      metadata: { audioUrl, durationMs, filePath },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
