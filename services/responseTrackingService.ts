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
  } catch (e) { console.warn('[ResponseTracking] Failed to update renter timestamp:', e); }

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
  } catch (e) { console.warn('[ResponseTracking] Failed to update agent timestamp:', e); }

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
  } catch (e) { console.warn('[ResponseTracking] Failed to update response rate:', e); }

  const users = await StorageService.getUsers();
  const userIdx = users.findIndex(u => u.id === agentId);
  if (userIdx >= 0) {
    (users[userIdx] as any).response_rate = Math.round(rate * 100) / 100;
    await StorageService.setUsers(users);
  }

  return rate;
}

export async function getAgentResponseAlerts(companyId: string): Promise<ResponseAlert[]> {
  try {
    const { data: teamMembers } = await supabase
      .from('company_team_members')
      .select('user_id')
      .eq('company_id', companyId);

    if (!teamMembers || teamMembers.length === 0) return [];
    const companyAgentIds = teamMembers.map(m => m.user_id);

    const { data: matches } = await supabase
      .from('matches')
      .select('id, host_id, renter_id, last_renter_message_at, last_agent_response_at, listing_id')
      .in('host_id', companyAgentIds)
      .not('last_renter_message_at', 'is', null)
      .order('last_renter_message_at', { ascending: false })
      .limit(50);

    if (!matches || matches.length === 0) return [];

    const alerts: ResponseAlert[] = [];
    const agentIds = [...new Set(matches.map(m => m.host_id))];
    const renterIds = [...new Set(matches.map(m => m.renter_id).filter(Boolean))];

    const { data: agentUsers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', agentIds);

    const { data: renterUsers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', renterIds);

    const agentMap = new Map((agentUsers || []).map(u => [u.id, u.full_name || 'Agent']));
    const renterMap = new Map((renterUsers || []).map(u => [u.id, u.full_name || 'Renter']));

    for (const match of matches) {
      if (!match.last_renter_message_at) continue;
      const renterTime = new Date(match.last_renter_message_at).getTime();
      const agentTime = match.last_agent_response_at ? new Date(match.last_agent_response_at).getTime() : 0;
      if (agentTime >= renterTime) continue;

      const status = getResponseStatus(match.last_renter_message_at);
      if (status === 'active') continue;

      alerts.push({
        agentId: match.host_id,
        agentName: agentMap.get(match.host_id) || 'Agent',
        conversationId: match.id,
        renterName: renterMap.get(match.renter_id) || 'Renter',
        renterId: match.renter_id,
        status,
        hoursSinceMessage: getHoursSinceMessage(match.last_renter_message_at),
        listingId: match.listing_id,
      });
    }

    return alerts;
  } catch (e) {
    console.warn('[ResponseTracking] getAgentResponseAlerts DB query failed, falling back:', e);
    const allAlerts = await runResponseStatusCheck();
    const { data: teamMembers } = await supabase
      .from('company_team_members')
      .select('user_id')
      .eq('company_id', companyId);
    if (teamMembers && teamMembers.length > 0) {
      const companyAgentIds = teamMembers.map(m => m.user_id);
      return allAlerts.filter(alert => companyAgentIds.includes(alert.agentId));
    }
    return [];
  }
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
  let ownerId: string | null = null;

  try {
    const { data: companyOwner } = await supabase
      .from('company_team_members')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('role', 'owner')
      .limit(1)
      .single();
    if (companyOwner) ownerId = companyOwner.user_id;
  } catch (e) {
    console.warn('[ResponseTracking] Failed to find company owner via Supabase:', e);
  }

  if (!ownerId) {
    const users = await StorageService.getUsers();
    const fallback = users.find(
      (u: any) => u.company_id === companyId && u.teamRole === 'owner'
    );
    if (fallback) ownerId = fallback.id;
  }

  if (!ownerId) return;

  await StorageService.addNotification({
    id: `notif_reassign_${Date.now()}`,
    userId: ownerId!,
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
