import { supabase } from '../lib/supabase';
import { getPlanLimits, canUseProactiveOutreach, type HostPlan } from '../constants/planLimits';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDev } from '../utils/logger';

function getOutreachLimits(plan: HostPlan) {
  const limits = getPlanLimits(plan);
  return {
    dailyCap: limits.proactiveOutreachPerDay,
    hourlyCap: limits.proactiveOutreachPerHour,
    cooldownDays: limits.groupCooldownDays,
    canUnlock: limits.canPayToUnlock,
  };
}

const OUTREACH_LOG_KEY = '@roomdr_host_outreach_log';
const OUTREACH_QUOTA_KEY = '@roomdr_host_outreach_quota';

export interface OutreachQuotaStatus {
  canSend: boolean;
  used: number;
  dailyCap: number;
  paidExtra: number;
  remaining: number;
  hitDailyLimit: boolean;
  suspended: boolean;
  reason?: string;
}

interface OutreachLogEntry {
  id: string;
  hostId: string;
  groupId: string;
  listingId?: string;
  message: string;
  sentAt: string;
}

interface OutreachDayQuota {
  hostId: string;
  dateKey: string;
  used: number;
  paidExtra: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

async function getLocalLog(): Promise<OutreachLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTREACH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveLocalLog(log: OutreachLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(OUTREACH_LOG_KEY, JSON.stringify(log));
}

async function getLocalQuota(hostId: string, dateKey: string): Promise<OutreachDayQuota> {
  try {
    const raw = await AsyncStorage.getItem(OUTREACH_QUOTA_KEY);
    const all: OutreachDayQuota[] = raw ? JSON.parse(raw) : [];
    return all.find(q => q.hostId === hostId && q.dateKey === dateKey) || { hostId, dateKey, used: 0, paidExtra: 0 };
  } catch { return { hostId, dateKey, used: 0, paidExtra: 0 }; }
}

async function saveLocalQuota(quota: OutreachDayQuota): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OUTREACH_QUOTA_KEY);
    const all: OutreachDayQuota[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(q => q.hostId === quota.hostId && q.dateKey === quota.dateKey);
    if (idx >= 0) all[idx] = quota;
    else all.push(quota);
    await AsyncStorage.setItem(OUTREACH_QUOTA_KEY, JSON.stringify(all));
  } catch {}
}

function buildQuotaResult(used: number, dailyCap: number, paidExtra: number, suspended: boolean): OutreachQuotaStatus {
  const totalAllowed = dailyCap + paidExtra;
  const remaining = Math.max(0, totalAllowed - used);
  const hitDailyLimit = remaining <= 0;
  return {
    canSend: !hitDailyLimit && !suspended,
    used,
    dailyCap,
    paidExtra,
    remaining,
    hitDailyLimit,
    suspended,
    reason: suspended ? 'SUSPENDED' : hitDailyLimit ? 'DAILY_LIMIT' : 'OK',
  };
}

export async function getOutreachQuotaStatus(
  hostId: string,
  plan: string
): Promise<OutreachQuotaStatus> {
  if (!canUseProactiveOutreach(plan as HostPlan)) {
    return buildQuotaResult(0, 0, 0, false);
  }
  const { dailyCap } = getOutreachLimits(plan as HostPlan);

  const online = await isSupabaseAvailable();
  if (online) {
    const { data: suspended, error: suspErr } = await supabase
      .from('host_outreach_suspended')
      .select('host_id')
      .eq('host_id', hostId)
      .maybeSingle();
    if (!suspErr && suspended) {
      return buildQuotaResult(0, 0, 0, true);
    }

    const dateKey = todayKey();
    const { data: quota, error: qErr } = await supabase
      .from('host_outreach_daily_quota')
      .select('used, paid_extra')
      .eq('host_id', hostId)
      .eq('date_key', dateKey)
      .maybeSingle();

    if (!qErr) {
      return buildQuotaResult(quota?.used ?? 0, dailyCap, quota?.paid_extra ?? 0, false);
    }
  }

  const dateKey = todayKey();
  const quota = await getLocalQuota(hostId, dateKey);
  return buildQuotaResult(quota.used, dailyCap, quota.paidExtra, false);
}

export async function checkHourlyLimit(hostId: string, plan: string): Promise<boolean> {
  const { hourlyCap } = getOutreachLimits(plan as HostPlan);
  if (hourlyCap === 0) return false;

  const online = await isSupabaseAvailable();
  if (online) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('host_group_outreach')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', hostId)
      .gte('sent_at', oneHourAgo);
    if (!error) return (count ?? 0) < hourlyCap;
  }

  const log = await getLocalLog();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentCount = log.filter(e => e.hostId === hostId && new Date(e.sentAt).getTime() > oneHourAgo).length;
  return recentCount < hourlyCap;
}

export async function checkGroupCooldown(hostId: string, groupId: string): Promise<boolean> {
  const online = await isSupabaseAvailable();
  if (online) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('host_group_outreach')
      .select('id')
      .eq('host_id', hostId)
      .eq('group_id', groupId)
      .gte('sent_at', thirtyDaysAgo)
      .maybeSingle();
    if (!error) return !data;
  }

  const log = await getLocalLog();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = log.find(e => e.hostId === hostId && e.groupId === groupId && new Date(e.sentAt).getTime() > thirtyDaysAgo);
  return !recent;
}

export async function sendProactiveOutreach(
  hostId: string,
  groupId: string,
  message: string,
  plan: string,
  listingId?: string
): Promise<void> {
  if (message.trim().length < 50) throw new Error('MESSAGE_TOO_SHORT');

  const quota = await getOutreachQuotaStatus(hostId, plan);
  if (quota.suspended) throw new Error('SUSPENDED');
  if (!quota.canSend) throw new Error('DAILY_LIMIT_REACHED');

  const hourlyOk = await checkHourlyLimit(hostId, plan);
  if (!hourlyOk) throw new Error('HOURLY_LIMIT_REACHED');

  const cooldownOk = await checkGroupCooldown(hostId, groupId);
  if (!cooldownOk) throw new Error('GROUP_COOLDOWN');

  const online = await isSupabaseAvailable();
  if (online) {
    const { error } = await supabase.from('host_group_outreach').insert({
      host_id: hostId,
      group_id: groupId,
      listing_id: listingId ?? null,
      message: message.trim(),
    });
    if (error) {
      if (!isDev) throw new Error('SEND_FAILED');
    } else {
      const dateKey = todayKey();
      const { error: rpcErr } = await supabase.rpc('increment_daily_outreach', { p_host_id: hostId, p_date_key: dateKey });
      if (rpcErr && !isDev) throw new Error('SEND_FAILED');
      if (!rpcErr) return;
    }
  }

  const entry: OutreachLogEntry = {
    id: `outreach_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    hostId,
    groupId,
    listingId,
    message: message.trim(),
    sentAt: new Date().toISOString(),
  };
  const log = await getLocalLog();
  log.push(entry);
  await saveLocalLog(log);

  const dateKey = todayKey();
  const q = await getLocalQuota(hostId, dateKey);
  q.used += 1;
  await saveLocalQuota(q);
}

export async function addPaidCreditsLocal(hostId: string, credits: number): Promise<void> {
  const dateKey = todayKey();
  const q = await getLocalQuota(hostId, dateKey);
  q.paidExtra += credits;
  await saveLocalQuota(q);
}

export async function getRecentlySentGroupIds(hostId: string): Promise<string[]> {
  const online = await isSupabaseAvailable();
  if (online) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('host_group_outreach')
      .select('group_id')
      .eq('host_id', hostId)
      .gte('sent_at', thirtyDaysAgo);
    if (!error && data) return data.map((r: any) => r.group_id);
  }

  const log = await getLocalLog();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return log
    .filter(e => e.hostId === hostId && new Date(e.sentAt).getTime() > thirtyDaysAgo)
    .map(e => e.groupId);
}
