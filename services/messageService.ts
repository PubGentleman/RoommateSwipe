import { supabase } from '../lib/supabase';

export async function getConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      user_id_1,
      user_id_2,
      match_type,
      status,
      compatibility_score,
      created_at
    `)
    .eq('status', 'matched')
    .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (!matches || matches.length === 0) return [];

  const conversations = await Promise.all(
    matches.map(async (match) => {
      const otherUserId = match.user_id_1 === user.id ? match.user_id_2 : match.user_id_1;

      const { data: otherUser } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, city')
        .eq('id', otherUserId)
        .single();

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('read', false)
        .neq('sender_id', user.id);

      return {
        matchId: match.id,
        matchType: match.match_type,
        compatibilityScore: match.compatibility_score,
        participant: otherUser,
        lastMessage: messages?.[0]?.content || null,
        lastMessageAt: messages?.[0]?.created_at || match.created_at,
        unreadCount: count || 0,
      };
    })
  );

  return conversations.sort((a, b) =>
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

export async function sendMessage(matchId: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: user.id,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markMessagesAsRead(matchId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('messages')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', user.id)
    .eq('read', false);
}

export async function sendColdMessage(recipientId: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const userId1 = user.id < recipientId ? user.id : recipientId;
  const userId2 = user.id < recipientId ? recipientId : user.id;

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
      sender_id: user.id,
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
    .channel('all-messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
