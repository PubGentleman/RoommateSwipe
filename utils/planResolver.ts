import { User } from '../types/models';

export function resolveBasePlan(plan: string | undefined | null): string {
  if (!plan) return 'free';
  return plan.replace(/^(agent_|company_)/, '');
}

export function isFreeTier(plan: string | undefined | null): boolean {
  const base = resolveBasePlan(plan);
  return !base || base === 'free' || base === 'none' || base === 'pay_per_use';
}

export function isPaidHostPlan(plan: string | undefined | null): boolean {
  return !isFreeTier(plan);
}

export function resolveEffectiveAgentPlan(user: User | null): string {
  if (!user) return 'pay_per_use';
  const agentPlan = user.agentPlan || (user as any).agent_plan;
  if (agentPlan && !isFreeTier(agentPlan)) {
    const base = resolveBasePlan(agentPlan);
    return base === 'pay_per_use' ? base : `agent_${base}`;
  }
  const subPlan = user.hostSubscription?.plan;
  if (subPlan && !isFreeTier(subPlan)) {
    const base = resolveBasePlan(subPlan);
    return base === 'pay_per_use' ? base : `agent_${base}`;
  }
  return agentPlan || 'pay_per_use';
}

export function resolveEffectiveCompanyPlan(user: User | null): string {
  if (!user) return 'starter';
  const companyPlan = (user as any).companyPlan || (user as any).company_plan;
  if (companyPlan && !isFreeTier(companyPlan)) return resolveBasePlan(companyPlan);
  const subPlan = user.hostSubscription?.plan;
  if (subPlan && !isFreeTier(subPlan)) return resolveBasePlan(subPlan);
  return companyPlan || 'starter';
}

export function resolveEffectiveHostPlan(user: User | null): string {
  if (!user) return 'free';
  const hostType = user.hostType || (user as any).host_type;
  if (hostType === 'agent') return resolveEffectiveAgentPlan(user);
  if (hostType === 'company') return resolveEffectiveCompanyPlan(user);
  const subPlan = user.hostSubscription?.plan;
  return resolveBasePlan(subPlan) || 'free';
}

export function getHostPlanDisplayInfo(user: User | null): { label: string; price: string; description: string; isFree: boolean } {
  if (!user) return { label: 'Free', price: '$0', description: 'Upgrade to reach more renters', isFree: true };
  const hostType = user.hostType || (user as any).host_type;
  const basePlan = resolveEffectiveHostPlan(user);
  const free = isFreeTier(basePlan);

  if (hostType === 'agent') {
    switch (basePlan) {
      case 'agent_starter':
      case 'starter': return { label: 'Agent Starter', price: '$49/mo', description: 'You have full access', isFree: false };
      case 'agent_pro':
      case 'pro': return { label: 'Agent Pro', price: '$99/mo', description: 'You have full access', isFree: false };
      case 'agent_business':
      case 'business': return { label: 'Agent Business', price: '$149/mo', description: 'You have full access', isFree: false };
      default: return { label: 'Pay Per Use', price: '$0', description: 'Upgrade to reach more renters', isFree: true };
    }
  }

  if (hostType === 'company') {
    switch (basePlan) {
      case 'starter': return { label: 'Company Starter', price: '$199/mo', description: 'You have full access', isFree: false };
      case 'pro': return { label: 'Company Pro', price: '$399/mo', description: 'You have full access', isFree: false };
      case 'enterprise': return { label: 'Company Enterprise', price: 'Custom', description: 'You have full access', isFree: false };
      default: return { label: 'Company Free', price: '$0', description: 'Upgrade to reach more renters', isFree: true };
    }
  }

  switch (basePlan) {
    case 'starter': return { label: 'Starter', price: '$19.99/mo', description: 'You have full access', isFree: false };
    case 'pro': return { label: 'Pro', price: '$49.99/mo', description: 'You have full access', isFree: false };
    case 'business': return { label: 'Business', price: '$99/mo', description: 'You have full access', isFree: false };
    default: return { label: 'Free', price: '$0', description: 'Upgrade to reach more renters', isFree: true };
  }
}
