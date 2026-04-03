import { supabase } from '../lib/supabase';

export interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  paypal_email: string | null;
  payout_method: 'paypal' | 'bank_transfer' | 'in_app_credit' | null;
  status: 'active' | 'suspended' | 'terminated';
  total_referrals: number;
  total_earned: number;
  terms_accepted_at: string;
  created_at: string;
}

export interface AffiliateReferral {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  referred_name: string | null;
  plan: string;
  plan_monthly_cost: number;
  commission: number;
  status: 'pending' | 'qualified' | 'forfeited' | 'paid';
  forfeited_reason: string | null;
  signup_at: string;
  qualification_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export const COMMISSION_TABLE: Record<string, { label: string; monthlyCost: number; commission: number }> = {
  plus: { label: 'Renter Plus', monthlyCost: 14.99, commission: 10.49 },
  elite: { label: 'Renter Elite', monthlyCost: 29.99, commission: 20.99 },
  starter: { label: 'Host Starter', monthlyCost: 19.99, commission: 13.99 },
  pro: { label: 'Host Pro', monthlyCost: 49.99, commission: 34.99 },
  business: { label: 'Host Business', monthlyCost: 99.99, commission: 69.99 },
  agent_starter: { label: 'Agent Starter', monthlyCost: 49.00, commission: 34.30 },
  agent_pro: { label: 'Agent Pro', monthlyCost: 99.00, commission: 69.30 },
  agent_business: { label: 'Agent Business', monthlyCost: 149.00, commission: 104.30 },
};

export function calculateCommission(planMonthlyCost: number): number {
  return Math.round(planMonthlyCost * 0.70 * 100) / 100;
}

function generateReferralCode(userName: string): string {
  const raw = (userName || 'USER').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'USER';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RS-${raw}-${random}`;
}

export async function getAffiliateForUser(userId: string): Promise<Affiliate | null> {
  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as Affiliate;
}

export async function applyForAffiliate(userId: string, userName: string): Promise<Affiliate> {
  let code = generateReferralCode(userName);
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('affiliates')
      .select('id')
      .eq('affiliate_code', code)
      .single();
    if (!existing) break;
    code = generateReferralCode(userName);
    attempts++;
  }

  const { data, error } = await supabase
    .from('affiliates')
    .insert({
      user_id: userId,
      affiliate_code: code,
      status: 'active',
      payout_method: null,
      paypal_email: null,
      total_referrals: 0,
      total_earned: 0,
      terms_accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Affiliate;
}

export async function updatePayoutSettings(
  affiliateId: string,
  method: 'paypal' | 'bank_transfer' | 'in_app_credit',
  email?: string
): Promise<void> {
  const updates: Record<string, unknown> = { payout_method: method };
  if (method === 'paypal' && email) {
    updates.paypal_email = email;
  }
  const { error } = await supabase
    .from('affiliates')
    .update(updates)
    .eq('id', affiliateId);
  if (error) throw new Error(error.message);
}

export async function updatePaypalEmail(affiliateId: string, paypalEmail: string): Promise<void> {
  const { error } = await supabase
    .from('affiliates')
    .update({ paypal_email: paypalEmail, payout_method: 'paypal' })
    .eq('id', affiliateId);
  if (error) throw new Error(error.message);
}

export async function getAffiliateReferrals(affiliateId: string): Promise<AffiliateReferral[]> {
  const { data, error } = await supabase
    .from('affiliate_referrals')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data || []) as AffiliateReferral[];
}

export function getNextPayoutDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let next: Date;
  if (d < 1) {
    next = new Date(y, m, 1);
  } else if (d < 15) {
    next = new Date(y, m, 15);
  } else {
    next = new Date(y, m + 1, 1);
  }
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDaysRemaining(qualificationDate: string | null): number {
  if (!qualificationDate) return 0;
  const now = new Date();
  const qual = new Date(qualificationDate);
  const diff = Math.ceil((qual.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export async function processReferralCommission(
  userId: string,
  plan: string
): Promise<void> {
  const { data: userData } = await supabase
    .from('users')
    .select('referred_by_code')
    .eq('id', userId)
    .single();

  if (!userData?.referred_by_code) return;

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*')
    .eq('affiliate_code', userData.referred_by_code)
    .eq('status', 'active')
    .single();

  if (!affiliate) return;

  const { data: existingReferral } = await supabase
    .from('affiliate_referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .single();

  if (existingReferral) return;

  const planKey = plan.replace(/^(agent_|company_)/, '').toLowerCase();
  const planInfo = COMMISSION_TABLE[plan] || COMMISSION_TABLE[planKey];
  const monthlyCost = planInfo?.monthlyCost || 0;
  const commission = planInfo?.commission || calculateCommission(monthlyCost);

  if (commission <= 0) return;

  const qualificationDate = new Date();
  qualificationDate.setDate(qualificationDate.getDate() + 31);

  const { error: insertError } = await supabase
    .from('affiliate_referrals')
    .insert({
      affiliate_id: affiliate.id,
      referred_user_id: userId,
      plan,
      plan_monthly_cost: monthlyCost,
      commission,
      status: 'pending',
      signup_at: new Date().toISOString(),
      qualification_date: qualificationDate.toISOString(),
    });

  if (insertError) {
    console.error('[Affiliate] Failed to insert referral:', insertError.message);
    return;
  }

  await supabase
    .from('affiliates')
    .update({
      total_referrals: (affiliate.total_referrals || 0) + 1,
    })
    .eq('id', affiliate.id);
}

export async function saveReferralCode(userId: string, code: string): Promise<void> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;

  const { data: existingUser } = await supabase
    .from('users')
    .select('referred_by_code')
    .eq('id', userId)
    .single();

  if (existingUser?.referred_by_code) return;

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, user_id')
    .eq('affiliate_code', trimmed)
    .single();

  if (!affiliate) return;
  if (affiliate.user_id === userId) return;

  await supabase
    .from('users')
    .update({ referred_by_code: trimmed })
    .eq('id', userId);
}
