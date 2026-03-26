import { supabase } from '../lib/supabase';

export interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  paypal_email: string | null;
  status: 'pending' | 'approved' | 'suspended';
  total_referrals: number;
  total_earned: number;
  created_at: string;
}

export interface AffiliateReferral {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  plan: string;
  commission: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at: string | null;
}

function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RHOME-${code}`;
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

export async function applyForAffiliate(userId: string, paypalEmail: string): Promise<Affiliate> {
  let code = generateAffiliateCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('affiliates')
      .select('id')
      .eq('affiliate_code', code)
      .single();
    if (!existing) break;
    code = generateAffiliateCode();
    attempts++;
  }

  const { data, error } = await supabase
    .from('affiliates')
    .insert({
      user_id: userId,
      affiliate_code: code,
      paypal_email: paypalEmail || null,
      status: 'approved',
      total_referrals: 0,
      total_earned: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Affiliate;
}

export async function updatePaypalEmail(affiliateId: string, paypalEmail: string): Promise<void> {
  const { error } = await supabase
    .from('affiliates')
    .update({ paypal_email: paypalEmail })
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

export async function processReferralCommission(
  userId: string,
  plan: 'plus' | 'elite'
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
    .eq('status', 'approved')
    .single();

  if (!affiliate) return;

  const { data: existingReferral } = await supabase
    .from('affiliate_referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .single();

  if (existingReferral) return;

  const commission = plan === 'elite' ? 20 : 10;

  const { error: insertError } = await supabase
    .from('affiliate_referrals')
    .insert({
      affiliate_id: affiliate.id,
      referred_user_id: userId,
      plan,
      commission,
      status: 'pending',
    });

  if (insertError) {
    console.error('[Affiliate] Failed to insert referral:', insertError.message);
    return;
  }

  await supabase
    .from('affiliates')
    .update({
      total_referrals: (affiliate.total_referrals || 0) + 1,
      total_earned: (affiliate.total_earned || 0) + commission,
    })
    .eq('id', affiliate.id);
}

export async function saveReferralCode(userId: string, code: string): Promise<void> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;

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
