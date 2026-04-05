import { supabase } from '../lib/supabase';

export interface BoostHistoryEntry {
  id: string;
  listingId: string;
  listingTitle: string;
  boostType: 'quick' | 'standard' | 'extended';
  duration: string;
  startedAt: string;
  expiresAt: string;
  usedFreeBoost: boolean;
  usedCredit: boolean;
  pricePaidCents: number;
  viewsDuring: number;
  inquiriesDuring: number;
  savesDuring: number;
  viewsBefore7d: number;
  inquiriesBefore7d: number;
  liftPercentage: number;
  isExpired: boolean;
}

export interface BoostSummary {
  totalBoosts: number;
  totalSpentCents: number;
  avgLiftPercentage: number;
  avgViewsPerBoost: number;
  avgInquiriesPerBoost: number;
  bestBoostType: string | null;
  creditBalance: { quick: number; standard: number; extended: number };
}

export interface AutoBoostSchedule {
  id: string;
  listingId: string;
  listingTitle: string;
  boostType: string;
  frequency: string;
  preferredTime: string;
  isActive: boolean;
  nextBoostAt: string | null;
  lastBoostedAt: string | null;
}

export async function recordBoostActivation(params: {
  hostId: string;
  listingId: string;
  listingTitle: string;
  boostType: 'quick' | 'standard' | 'extended';
  duration: string;
  startedAt: string;
  expiresAt: string;
  usedFreeBoost: boolean;
  usedCredit: boolean;
  pricePaidCents: number;
}): Promise<void> {
  await supabase.from('boost_history').insert({
    host_id: params.hostId,
    listing_id: params.listingId,
    listing_title: params.listingTitle,
    boost_type: params.boostType,
    duration: params.duration,
    started_at: params.startedAt,
    expires_at: params.expiresAt,
    used_free_boost: params.usedFreeBoost,
    used_credit: params.usedCredit,
    price_paid_cents: params.pricePaidCents,
  });
}

export async function updateBoostOutcome(
  boostId: string,
  metrics: {
    viewsDuring: number;
    inquiriesDuring: number;
    savesDuring: number;
    viewsBefore7d: number;
    inquiriesBefore7d: number;
  }
): Promise<void> {
  const lift = metrics.viewsBefore7d > 0
    ? Math.round(((metrics.viewsDuring - metrics.viewsBefore7d) / metrics.viewsBefore7d) * 1000) / 10
    : metrics.viewsDuring > 0 ? 100 : 0;

  await supabase.from('boost_history').update({
    views_during: metrics.viewsDuring,
    inquiries_during: metrics.inquiriesDuring,
    saves_during: metrics.savesDuring,
    views_before_7d: metrics.viewsBefore7d,
    inquiries_before_7d: metrics.inquiriesBefore7d,
    lift_percentage: lift,
  }).eq('id', boostId);
}

export async function getBoostHistory(
  hostId: string,
  limit: number = 20
): Promise<BoostHistoryEntry[]> {
  const { data, error } = await supabase
    .from('boost_history')
    .select('*')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(b => ({
    id: b.id,
    listingId: b.listing_id,
    listingTitle: b.listing_title,
    boostType: b.boost_type,
    duration: b.duration,
    startedAt: b.started_at,
    expiresAt: b.expires_at,
    usedFreeBoost: b.used_free_boost,
    usedCredit: b.used_credit,
    pricePaidCents: b.price_paid_cents,
    viewsDuring: b.views_during,
    inquiriesDuring: b.inquiries_during,
    savesDuring: b.saves_during,
    viewsBefore7d: b.views_before_7d,
    inquiriesBefore7d: b.inquiries_before_7d,
    liftPercentage: b.lift_percentage,
    isExpired: new Date(b.expires_at) < new Date(),
  }));
}

export async function getBoostSummary(
  hostId: string,
  creditBalance: { quick: number; standard: number; extended: number }
): Promise<BoostSummary> {
  const history = await getBoostHistory(hostId, 100);
  const expired = history.filter(b => b.isExpired);

  const totalSpent = history.reduce((s, b) => s + b.pricePaidCents, 0);
  const avgLift = expired.length > 0
    ? expired.reduce((s, b) => s + b.liftPercentage, 0) / expired.length
    : 0;
  const avgViews = expired.length > 0
    ? expired.reduce((s, b) => s + b.viewsDuring, 0) / expired.length
    : 0;
  const avgInquiries = expired.length > 0
    ? expired.reduce((s, b) => s + b.inquiriesDuring, 0) / expired.length
    : 0;

  const byType: Record<string, { totalLift: number; count: number }> = {};
  expired.forEach(b => {
    if (!byType[b.boostType]) byType[b.boostType] = { totalLift: 0, count: 0 };
    byType[b.boostType].totalLift += b.liftPercentage;
    byType[b.boostType].count++;
  });
  const bestType = Object.entries(byType)
    .map(([type, d]) => ({ type, avgLift: d.totalLift / d.count }))
    .sort((a, b) => b.avgLift - a.avgLift)[0];

  return {
    totalBoosts: history.length,
    totalSpentCents: totalSpent,
    avgLiftPercentage: Math.round(avgLift * 10) / 10,
    avgViewsPerBoost: Math.round(avgViews),
    avgInquiriesPerBoost: Math.round(avgInquiries * 10) / 10,
    bestBoostType: bestType?.type || null,
    creditBalance,
  };
}

export async function getAutoBoostSchedules(hostId: string): Promise<AutoBoostSchedule[]> {
  const { data } = await supabase
    .from('auto_boost_schedules')
    .select('*')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false });

  return (data || []).map((s: any) => ({
    id: s.id,
    listingId: s.listing_id,
    listingTitle: s.listing_title || 'Unknown',
    boostType: s.boost_type,
    frequency: s.frequency,
    preferredTime: s.preferred_time,
    isActive: s.is_active,
    nextBoostAt: s.next_boost_at,
    lastBoostedAt: s.last_boosted_at,
  }));
}

export async function createAutoBoostSchedule(params: {
  hostId: string;
  listingId: string;
  listingTitle: string;
  boostType: string;
  frequency: string;
  preferredTime: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('auto_boost_schedules').insert({
    host_id: params.hostId,
    listing_id: params.listingId,
    listing_title: params.listingTitle,
    boost_type: params.boostType,
    frequency: params.frequency,
    preferred_time: params.preferredTime,
    next_boost_at: calculateNextBoostTime(params.frequency, params.preferredTime),
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleAutoBoostSchedule(scheduleId: string, isActive: boolean): Promise<void> {
  await supabase.from('auto_boost_schedules').update({ is_active: isActive }).eq('id', scheduleId);
}

export async function deleteAutoBoostSchedule(scheduleId: string): Promise<void> {
  await supabase.from('auto_boost_schedules').delete().eq('id', scheduleId);
}

function calculateNextBoostTime(frequency: string, preferredTime: string): string {
  const [hours, minutes] = preferredTime.split(':').map(Number);
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  if (next <= new Date()) {
    switch (frequency) {
      case 'daily': next.setDate(next.getDate() + 1); break;
      case 'every_3_days': next.setDate(next.getDate() + 3); break;
      case 'weekly': next.setDate(next.getDate() + 7); break;
    }
  }

  return next.toISOString();
}
