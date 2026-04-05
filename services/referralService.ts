import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';

export interface Referral {
  id: string;
  referrerId: string;
  referredId?: string;
  referredEmail?: string;
  referredPhone?: string;
  referredName?: string;
  referredPhoto?: string;
  inviteMethod: string;
  status: string;
  rewardClaimed: boolean;
  rewardAmount: number;
  createdAt: string;
  signedUpAt?: string;
  onboardedAt?: string;
  subscribedAt?: string;
}

export interface ReferralStats {
  totalInvited: number;
  signedUp: number;
  onboarded: number;
  subscribed: number;
  totalCreditsEarned: number;
  currentCredits: number;
  nextMilestone: { milestone: string; description: string; progress: number; target: number } | null;
}

export interface RewardMilestone {
  milestone: string;
  rewardType: string;
  rewardValue: number | null;
  description: string;
}

export async function getMyReferralCode(userId: string): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('referral_code')
    .eq('id', userId)
    .single();
  return data?.referral_code || '';
}

export function getReferralLink(code: string): string {
  return `https://rhome.app/invite/${code}`;
}

export function getReferralDeepLink(code: string): string {
  return Linking.createURL(`/invite/${code}`);
}

export async function trackInvite(
  referrerId: string,
  method: string,
  email?: string,
  phone?: string
) {
  let query = supabase
    .from('referrals')
    .select('id')
    .eq('referrer_id', referrerId);

  if (email) query = query.eq('referred_email', email);
  else if (phone) query = query.eq('referred_phone', phone);
  else return;

  const { data: existing } = await query.single();
  if (existing) return;

  const { error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      referred_email: email,
      referred_phone: phone,
      invite_method: method,
      status: 'invited',
    });
  if (error) console.warn('[Referral] Track invite failed:', error);
}

export async function trackLinkShare(referrerId: string, method: string) {
  await supabase
    .from('referrals')
    .insert({
      referrer_id: referrerId,
      invite_method: method,
      status: 'invited',
    });
}

export async function processReferralSignup(newUserId: string, referralCode: string) {
  const { data: referrer } = await supabase
    .from('users')
    .select('id')
    .eq('referral_code', referralCode.toUpperCase())
    .single();

  if (!referrer || referrer.id === newUserId) return;

  const { data: newUser } = await supabase
    .from('users')
    .select('email')
    .eq('id', newUserId)
    .single();

  const { data: existingByEmail } = newUser?.email
    ? await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', referrer.id)
        .eq('referred_email', newUser.email)
        .single()
    : { data: null };

  if (existingByEmail) {
    await supabase
      .from('referrals')
      .update({
        referred_id: newUserId,
        status: 'signed_up',
        signed_up_at: new Date().toISOString(),
      })
      .eq('id', existingByEmail.id);
  } else {
    await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        invite_method: 'link',
        status: 'signed_up',
        signed_up_at: new Date().toISOString(),
      });
  }

  await addCredits(referrer.id, 2, 'referral_reward', 'Friend signed up');

  await supabase
    .from('referrals')
    .update({ reward_amount: 2 })
    .eq('referrer_id', referrer.id)
    .eq('referred_id', newUserId);

  await checkAndAwardMilestones(referrer.id);

  await supabase
    .from('users')
    .update({ referred_by_code: referralCode })
    .eq('id', newUserId);
}

export async function updateReferralProgress(userId: string, stage: 'onboarded' | 'subscribed') {
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, referrer_id, status, reward_amount')
    .eq('referred_id', userId)
    .single();

  if (!referral) return;

  const updates: Record<string, any> = { status: stage };
  if (stage === 'onboarded') updates.onboarded_at = new Date().toISOString();
  if (stage === 'subscribed') updates.subscribed_at = new Date().toISOString();

  await supabase
    .from('referrals')
    .update(updates)
    .eq('id', referral.id);

  const creditAmounts: Record<string, number> = {
    onboarded: 3,
    subscribed: 10,
  };

  const amount = creditAmounts[stage] || 0;
  if (amount > 0) {
    const stageDesc = `Friend ${stage.replace('_', ' ')}`;
    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', referral.referrer_id)
      .eq('referral_id', referral.id)
      .eq('description', stageDesc)
      .single();

    if (!existingTx) {
      await addCredits(referral.referrer_id, amount, 'referral_reward', stageDesc, referral.id);

      await supabase
        .from('referrals')
        .update({ reward_amount: (referral.reward_amount || 0) + amount })
        .eq('id', referral.id);
    }
  }

  await checkAndAwardMilestones(referral.referrer_id);
}

export async function addCredits(
  userId: string, amount: number, type: string, description: string, referralId?: string
) {
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount,
    type,
    description,
    referral_id: referralId,
  });

  const { data: user } = await supabase
    .from('users')
    .select('referral_credits')
    .eq('id', userId)
    .single();

  await supabase
    .from('users')
    .update({ referral_credits: (user?.referral_credits || 0) + amount })
    .eq('id', userId);
}

export async function spendCredits(userId: string, amount: number, description: string) {
  const { data: user } = await supabase
    .from('users')
    .select('referral_credits')
    .eq('id', userId)
    .single();

  if ((user?.referral_credits || 0) < amount) {
    throw new Error('Insufficient credits');
  }

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: -amount,
    type: 'subscription_discount',
    description,
  });

  await supabase
    .from('users')
    .update({ referral_credits: (user?.referral_credits || 0) - amount })
    .eq('id', userId);
}

async function checkAndAwardMilestones(userId: string) {
  const { count: totalSignups } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', userId)
    .in('status', ['signed_up', 'onboarded', 'subscribed']);

  const milestoneMap: Record<number, string> = {
    5: '5_referrals',
    10: '10_referrals',
    25: '25_referrals',
    50: '50_referrals',
  };

  const milestone = milestoneMap[totalSignups || 0];
  if (!milestone) return;

  const { data: existingTx } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('description', `Milestone: ${milestone}`)
    .single();

  if (existingTx) return;

  const { data: reward } = await supabase
    .from('referral_rewards')
    .select('*')
    .eq('milestone', milestone)
    .eq('active', true)
    .single();

  if (!reward) return;

  if (reward.reward_type === 'credits' && reward.reward_value) {
    await addCredits(userId, reward.reward_value, 'referral_reward', `Milestone: ${milestone}`);
  }
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const { data: referrals } = await supabase
    .from('referrals')
    .select('status')
    .eq('referrer_id', userId);

  const stats = {
    totalInvited: referrals?.length || 0,
    signedUp: referrals?.filter(r => ['signed_up', 'onboarded', 'subscribed'].includes(r.status)).length || 0,
    onboarded: referrals?.filter(r => ['onboarded', 'subscribed'].includes(r.status)).length || 0,
    subscribed: referrals?.filter(r => r.status === 'subscribed').length || 0,
  };

  const { data: user } = await supabase
    .from('users')
    .select('referral_credits')
    .eq('id', userId)
    .single();

  const { data: txs } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('user_id', userId)
    .gt('amount', 0);

  const totalEarned = (txs || []).reduce((sum: number, tx: any) => sum + tx.amount, 0);

  const milestones = [
    { target: 1, milestone: 'first_signup', label: 'First friend signs up' },
    { target: 5, milestone: '5_referrals', label: '5 friends signed up' },
    { target: 10, milestone: '10_referrals', label: '10 friends signed up' },
    { target: 25, milestone: '25_referrals', label: '25 friends signed up' },
    { target: 50, milestone: '50_referrals', label: '50 friends signed up' },
  ];

  const nextMilestone = milestones.find(m => stats.signedUp < m.target);

  return {
    ...stats,
    totalCreditsEarned: totalEarned,
    currentCredits: user?.referral_credits || 0,
    nextMilestone: nextMilestone ? {
      milestone: nextMilestone.milestone,
      description: nextMilestone.label,
      progress: stats.signedUp,
      target: nextMilestone.target,
    } : null,
  };
}

export async function getMyReferrals(userId: string): Promise<Referral[]> {
  const { data } = await supabase
    .from('referrals')
    .select('*, referred:users!referred_id(id, full_name, avatar_url)')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  return (data || []).map((r: any) => ({
    id: r.id,
    referrerId: r.referrer_id,
    referredId: r.referred_id,
    referredEmail: r.referred_email,
    referredPhone: r.referred_phone,
    referredName: r.referred?.full_name,
    referredPhoto: r.referred?.avatar_url,
    inviteMethod: r.invite_method,
    status: r.status,
    rewardClaimed: r.reward_claimed,
    rewardAmount: r.reward_amount,
    createdAt: r.created_at,
    signedUpAt: r.signed_up_at,
    onboardedAt: r.onboarded_at,
    subscribedAt: r.subscribed_at,
  }));
}

export async function getRewardMilestones(): Promise<RewardMilestone[]> {
  const { data } = await supabase
    .from('referral_rewards')
    .select('milestone, reward_type, reward_value, reward_description')
    .eq('active', true);

  return (data || []).map((r: any) => ({
    milestone: r.milestone,
    rewardType: r.reward_type,
    rewardValue: r.reward_value,
    description: r.reward_description,
  }));
}
