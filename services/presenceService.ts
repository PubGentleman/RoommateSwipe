import { supabase } from '../lib/supabase';

type PresenceState = {
  onlineUsers: Set<string>;
  typingUsers: Map<string, string[]>;
};

let presenceState: PresenceState = {
  onlineUsers: new Set(),
  typingUsers: new Map(),
};

const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribeToPresence(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function isUserOnline(userId: string): boolean {
  return presenceState.onlineUsers.has(userId);
}

export function getTypingUsers(conversationId: string): string[] {
  return presenceState.typingUsers.get(conversationId) || [];
}

let globalChannel: any = null;

export function joinGlobalPresence(userId: string) {
  if (globalChannel) return;

  globalChannel = supabase.channel('online-users', {
    config: { presence: { key: userId } },
  });

  globalChannel
    .on('presence', { event: 'sync' }, () => {
      const state = globalChannel.presenceState();
      presenceState.onlineUsers = new Set(Object.keys(state));
      notifyListeners();
    })
    .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
      presenceState.onlineUsers.add(key);
      notifyListeners();
    })
    .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
      presenceState.onlineUsers.delete(key);
      notifyListeners();
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await globalChannel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
}

export function leaveGlobalPresence() {
  if (globalChannel) {
    globalChannel.untrack();
    supabase.removeChannel(globalChannel);
    globalChannel = null;
  }
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startPresenceHeartbeat(userId: string) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString(), is_online: true })
    .eq('id', userId)
    .then(() => {});

  heartbeatInterval = setInterval(async () => {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString(), is_online: true })
      .eq('id', userId);
  }, 60000);
}

export function stopPresenceHeartbeat(userId: string) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  supabase
    .from('users')
    .update({ is_online: false, last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .then(() => {});
}

const typingChannels = new Map<string, any>();
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function joinConversationTyping(conversationId: string, userId: string) {
  if (typingChannels.has(conversationId)) return;

  const channel = supabase.channel(`typing-${conversationId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const typers: string[] = [];
      Object.entries(state).forEach(([key, presences]: [string, any]) => {
        const latest = presences[presences.length - 1];
        if (latest?.is_typing && key !== userId) {
          typers.push(key);
        }
      });
      presenceState.typingUsers.set(conversationId, typers);
      notifyListeners();
    })
    .subscribe();

  typingChannels.set(conversationId, channel);
}

export function leaveConversationTyping(conversationId: string) {
  const channel = typingChannels.get(conversationId);
  if (channel) {
    channel.untrack();
    supabase.removeChannel(channel);
    typingChannels.delete(conversationId);
  }
  presenceState.typingUsers.delete(conversationId);
}

export function sendTypingIndicator(conversationId: string, isTyping: boolean) {
  const channel = typingChannels.get(conversationId);
  if (!channel) return;

  channel.track({ is_typing: isTyping });

  const existing = typingTimeouts.get(conversationId);
  if (existing) clearTimeout(existing);

  if (isTyping) {
    typingTimeouts.set(conversationId, setTimeout(() => {
      channel.track({ is_typing: false });
    }, 5000));
  }
}

export async function getLastSeen(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('last_seen_at, is_online')
    .eq('id', userId)
    .single();

  if (data?.is_online) return 'online';
  return data?.last_seen_at || null;
}

export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return '';
  if (lastSeen === 'online') return 'Online';

  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  return `Last seen ${date.toLocaleDateString()}`;
}
