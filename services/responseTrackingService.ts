import { supabase } from '../lib/supabase';
import { StorageService } from '../utils/storage';

export type ResponseStatus = 'active' | 'delayed' | 'unresponsive' | 'critical';

export interface ResponseAlert {
  agentId: string;
  agentName: string;
  conversationId: string;
  renterName: string;
  renterId?: string;
  status: ResponseStatus;
  hoursSinceMessage: number;
  listingTitle?: string;
  listingId?: string;
}

export async function updateRenterMessageTimestamp(conversationId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await supabase
      .from('matches')
      .update({
        last_renter_message_at: now,
        response_status: 'active',
      })
      .eq('id', conversationId);
  } catch {}

  const conversations = await StorageService.getConversations();
  const conv = conversations.find(c => c.id === conversationId);
  if (conv) {
    (conv as any).last_renter_message_at = now;
    (conv as any).response_status = 'active';
    await StorageService.setConversations(conversations);
  }
}

export async function updateAgentResponseTimestamp(conversationId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await supabase
      .from('matches')
      .update({
        last_agent_response_at: now,
        response_status: 'active',
      })
      .eq('id', conversationId);
  } catch {}

  const conversations = await StorageService.getConversations();
  const conv = conversations.find(c => c.id === conversationId);
  if (conv) {
    (conv as any).last_agent_response_at = now;
    (conv as any).response_status = 'active';
    await StorageService.setConversations(conversations);
  }
}

export function getResponseStatus(lastRenterMessageAt: string | null): ResponseStatus {
  if (!lastRenterMessageAt) return 'active';
  const hoursSince = (Date.now() - new Date(lastRenterMessageAt).getTime()) / (1000 * 60 * 60);
  if (hoursSince >= 72) return 'critical';
  if (hoursSince >= 48) return 'unresponsive';
  if (hoursSince >= 24) return 'delayed';
  return 'active';
}

export function getHoursSinceMessage(lastRenterMessageAt: string | null): number {
  if (!lastRenterMessageAt) return 0;
  return (Date.now() - new Date(lastRenterMessageAt).getTime()) / (1000 * 60 * 60);
}

export async function runResponseStatusCheck(): Promise<ResponseAlert[]> {
  const alerts: ResponseAlert[] = [];
  const conversations = await StorageService.getConversations();
  const users = await StorageService.getUsers();

  for (const conv of conversations) {
    if (!(conv as any).isInquiryThread) continue;
    const lastRenterMsg = (conv as any).last_renter_message_at;
    const lastAgentResp = (conv as any).last_agent_response_at;
    if (!lastRenterMsg) continue;

    const renterTime = new Date(lastRenterMsg).getTime();
    const agentTime = lastAgentResp ? new Date(lastAgentResp).getTime() : 0;
    if (agentTime >= renterTime) continue;

    const status = getResponseStatus(lastRenterMsg);
    if (status === 'active') continue;

    const hostId = (conv as any).hostId;
    const hostUser = users.find(u => u.id === hostId);
    if (!hostUser || hostUser.hostType !== 'agent') continue;

    if ((conv as any).response_status !== status) {
      (conv as any).response_status = status;
    }

    alerts.push({
      agentId: hostId,
      agentName: hostUser.full_name || hostUser.name || 'Agent',
      conversationId: conv.id,
      renterName: conv.participant?.name || 'Renter',
      renterId: conv.participant?.id,
      status,
      hoursSinceMessage: getHoursSinceMessage(lastRenterMsg),
      listingTitle: (conv as any).listingTitle,
      listingId: (conv as any).listingId,
    });
  }

  if (alerts.length > 0) {
    await StorageService.setConversations(conversations);
  }

  return alerts;
}

export async function calculateResponseRate(agentId: string): Promise<number> {
  const conversations = await StorageService.getConversations();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const agentConversations = conversations.filter(conv => {
    if (!(conv as any).isInquiryThread) return false;
    if ((conv as any).hostId !== agentId) return false;
    const timestamp = conv.timestamp ? new Date(conv.timestamp).getTime() : 0;
    return timestamp >= thirtyDaysAgo;
  });

  if (agentConversations.length === 0) return 100;

  const respondedWithin24h = agentConversations.filter(conv => {
    const renterMsg = (conv as any).last_renter_message_at;
    const agentResp = (conv as any).last_agent_response_at;
    if (!renterMsg || !agentResp) return true;
    const diff = new Date(agentResp).getTime() - new Date(renterMsg).getTime();
    return diff <= 24 * 60 * 60 * 1000;
  }).length;

  const rate = (respondedWithin24h / agentConversations.length) * 100;

  try {
    await supabase
      .from('users')
      .update({ response_rate: Math.round(rate * 100) / 100 })
      .eq('id', agentId);
  } catch {}

  const users = await StorageService.getUsers();
  const userIdx = users.findIndex(u => u.id === agentId);
  if (userIdx >= 0) {
    (users[userIdx] as any).response_rate = Math.round(rate * 100) / 100;
    await StorageService.setUsers(users);
  }

  return rate;
}

export async function getAgentResponseAlerts(companyId: string): Promise<ResponseAlert[]> {
  const allAlerts = await runResponseStatusCheck();
  const users = await StorageService.getUsers();
  const companyAgentIds = users
    .filter(u => u.hostType === 'agent' && (u as any).company_id === companyId)
    .map(u => u.id);

  return allAlerts.filter(alert => companyAgentIds.includes(alert.agentId));
}

export async function getAgentsWithCriticalStatus(): Promise<string[]> {
  const conversations = await StorageService.getConversations();
  const delayedAgentIds: Set<string> = new Set();

  for (const conv of conversations) {
    if (!(conv as any).isInquiryThread) continue;
    const status = (conv as any).response_status;
    if (status === 'critical' || status === 'unresponsive' || status === 'delayed') {
      const hostId = (conv as any).hostId;
      if (hostId) delayedAgentIds.add(hostId);
    }
  }

  return Array.from(delayedAgentIds);
}

export async function sendResponsePendingNotification(
  renterId: string,
  agentName: string,
  conversationId: string
): Promise<void> {
  await StorageService.addNotification({
    id: `notif_response_${Date.now()}`,
    userId: renterId,
    type: 'system',
    title: 'Response Pending',
    body: `Your message to ${agentName} is still pending a response`,
    isRead: false,
    createdAt: new Date(),
    data: {
      conversationId,
      type: 'response_pending',
    },
  });
}

export async function requestDifferentAgent(
  conversationId: string,
  companyId: string,
  renterName: string,
  agentName: string
): Promise<void> {
  const users = await StorageService.getUsers();
  const companyOwner = users.find(
    u => u.id === companyId || ((u as any).company_id === companyId && (u as any).teamRole === 'owner')
  );
  if (!companyOwner) return;

  await StorageService.addNotification({
    id: `notif_reassign_${Date.now()}`,
    userId: companyOwner.id,
    type: 'system',
    title: 'Agent Reassignment Requested',
    body: `${renterName} has requested a different agent. ${agentName} has not responded within 48 hours.`,
    isRead: false,
    createdAt: new Date(),
    data: {
      conversationId,
      type: 'reassign_request',
      agentName,
    },
  });
}
