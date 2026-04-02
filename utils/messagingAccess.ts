import { User } from '../types/models';
import { supabase } from '../lib/supabase';

function extractBasePlan(plan: string | undefined | null): string {
  if (!plan) return '';
  return plan.replace(/^(agent_|company_)/, '');
}

function isPaidPlan(plan: string | undefined | null): boolean {
  const base = extractBasePlan(plan);
  return base === 'starter' || base === 'pro' || base === 'business' || base === 'enterprise';
}

export function canAccessMessages(user: User | null): boolean {
  if (!user) return false;
  const hostType = user.hostType || (user as any).host_type;

  if (hostType === 'agent') {
    const agentPlan = user.agentPlan || (user as any).agent_plan;
    if (isPaidPlan(agentPlan)) return true;
    const subPlan = user.hostSubscription?.plan;
    if (isPaidPlan(subPlan)) return true;
    return false;
  }

  if (hostType === 'company') {
    const companyPlan = (user as any).companyPlan || (user as any).company_plan;
    if (isPaidPlan(companyPlan)) return true;
    const subPlan = user.hostSubscription?.plan;
    if (isPaidPlan(subPlan)) return true;
    return false;
  }

  return true;
}

export function canAccessConversation(user: User | null, conversationId: string): boolean {
  if (!user) return false;
  if (canAccessMessages(user)) return true;

  const unlockedConvoId = user.freeMessageUnlockConversationId ||
    (user as any).free_message_unlock_conversation_id;
  return unlockedConvoId === conversationId;
}

export function hasFreeUnlockAvailable(user: User | null): boolean {
  if (!user) return false;
  if (canAccessMessages(user)) return false;
  const used = user.freeMessageUnlockUsed || (user as any).free_message_unlock_used;
  return !used;
}

export async function useFreeMessageUnlock(
  userId: string,
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('users')
    .update({
      free_message_unlock_used: true,
      free_message_unlock_conversation_id: conversationId,
      free_message_unlock_used_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('free_message_unlock_used', false);

  if (error) {
    return { success: false, error: 'Free unlock already used or update failed' };
  }

  const { data: check } = await supabase
    .from('users')
    .select('free_message_unlock_used, free_message_unlock_conversation_id')
    .eq('id', userId)
    .single();

  if (!check?.free_message_unlock_used || check?.free_message_unlock_conversation_id !== conversationId) {
    return { success: false, error: 'Unlock was not applied' };
  }

  return { success: true };
}

export function getMessagingUpgradePlan(user: User | null): { plan: string; price: string } {
  if (!user) return { plan: 'Starter', price: '$19.99/mo' };
  const hostType = user.hostType || (user as any).host_type;

  if (hostType === 'agent') {
    return { plan: 'Agent Starter', price: '$49/mo' };
  }
  if (hostType === 'company') {
    return { plan: 'Company Starter', price: '$199/mo' };
  }
  return { plan: 'Starter', price: '$19.99/mo' };
}
