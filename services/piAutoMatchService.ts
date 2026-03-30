import { supabase } from '../lib/supabase';
import { PiAutoGroup, PiAutoGroupMember, PiGroupClaim } from '../types/models';
import { getAutoClaimLimits } from '../constants/planLimits';
import { RENTER_PLAN_LIMITS, RenterPlan } from '../constants/renterPlanLimits';

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function triggerAutoMatch(userId: string): Promise<{ success: boolean; groupId?: string }> {
  try {
    await supabase
      .from('profiles')
      .update({ pi_last_match_attempt: new Date().toISOString() })
      .eq('user_id', userId);

    const { data: existing } = await supabase
      .from('pi_auto_group_members')
      .select('group_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted'])
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: true, groupId: existing[0].group_id };
    }

    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function getUserAutoGroups(userId: string): Promise<PiAutoGroup[]> {
  try {
    const { data: memberRows } = await supabase
      .from('pi_auto_group_members')
      .select('group_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted']);

    if (!memberRows || memberRows.length === 0) return [];

    const groupIds = memberRows.map(r => r.group_id);
    const { data } = await supabase
      .from('pi_auto_groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    return (data as PiAutoGroup[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAutoGroupMembers(groupId: string): Promise<PiAutoGroupMember[]> {
  try {
    const { data } = await supabase
      .from('pi_auto_group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('invited_at', { ascending: true });

    return (data as PiAutoGroupMember[]) ?? [];
  } catch {
    return [];
  }
}

export async function getPendingGroupInvite(userId: string): Promise<PiAutoGroupMember | null> {
  try {
    const { data } = await supabase
      .from('pi_auto_group_members')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })
      .limit(1)
      .single();

    return (data as PiAutoGroupMember) ?? null;
  } catch {
    return null;
  }
}

export async function acceptGroupInvite(groupId: string): Promise<boolean> {
  return respondToAutoGroupInvite(groupId, true);
}

export async function declineGroupInvite(groupId: string): Promise<boolean> {
  return respondToAutoGroupInvite(groupId, false);
}

export async function respondToAutoGroupInvite(groupId: string, accept: boolean): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('pi_auto_group_members')
      .update({
        status: accept ? 'accepted' : 'declined',
        [accept ? 'accepted_at' : 'declined_at']: now,
      })
      .eq('group_id', groupId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

export async function getMyAutoGroup(userId: string): Promise<PiAutoGroup | null> {
  try {
    const groups = await getUserAutoGroups(userId);
    const active = groups.find(g => g.status === 'forming' || g.status === 'ready');
    return active ?? null;
  } catch {
    return null;
  }
}

export async function convertToRealGroup(autoGroupId: string): Promise<string | null> {
  try {
    const { data: autoGroup } = await supabase
      .from('pi_auto_groups')
      .select('*')
      .eq('id', autoGroupId)
      .single();

    if (!autoGroup) return null;

    if (autoGroup.status === 'placed') {
      const { data: existing } = await supabase
        .from('groups')
        .select('id')
        .eq('pi_auto_group_id', autoGroupId)
        .limit(1)
        .single();
      return existing?.id ?? null;
    }

    const { data: members } = await supabase
      .from('pi_auto_group_members')
      .select('user_id')
      .eq('group_id', autoGroupId)
      .eq('status', 'accepted');

    if (!members || members.length === 0) return null;

    const creatorId = autoGroup.anchor_user_id || members[0].user_id;

    const { data: newGroup, error } = await supabase
      .from('groups')
      .insert({
        name: 'Pi Match Group',
        created_by: creatorId,
        group_type: 'roommate',
        pi_auto_group_id: autoGroupId,
      })
      .select('id')
      .single();

    if (error || !newGroup) return null;

    const memberInserts = members.map((m: { user_id: string }) => ({
      group_id: newGroup.id,
      user_id: m.user_id,
      role: m.user_id === creatorId ? 'admin' : 'member',
      joined_at: new Date().toISOString(),
    }));

    const { error: memberError } = await supabase
      .from('group_members')
      .insert(memberInserts);

    if (memberError) {
      await supabase.from('groups').delete().eq('id', newGroup.id);
      return null;
    }

    await supabase
      .from('pi_auto_groups')
      .update({ status: 'placed' })
      .eq('id', autoGroupId);

    return newGroup.id;
  } catch {
    return null;
  }
}

export async function dissolveGroup(autoGroupId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('pi_auto_groups')
      .update({ status: 'dissolved', dissolved_at: now })
      .eq('id', autoGroupId);
    return !error;
  } catch {
    return false;
  }
}

export async function findReplacementMember(autoGroupId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pi_auto_groups')
      .update({ status: 'forming' })
      .eq('id', autoGroupId);

    if (error) return false;

    await supabase
      .from('pi_auto_group_members')
      .delete()
      .eq('group_id', autoGroupId)
      .in('status', ['declined', 'left']);

    return true;
  } catch {
    return false;
  }
}

export async function getAvailableGroups(filters?: {
  city?: string;
  minSize?: number;
  maxSize?: number;
}): Promise<PiAutoGroup[]> {
  try {
    let query = supabase
      .from('pi_auto_groups')
      .select('*')
      .eq('status', 'ready');

    if (filters?.city) query = query.eq('city', filters.city);
    if (filters?.minSize) query = query.gte('max_members', filters.minSize);
    if (filters?.maxSize) query = query.lte('max_members', filters.maxSize);

    const { data } = await query.order('created_at', { ascending: false });
    return (data as PiAutoGroup[]) ?? [];
  } catch {
    return [];
  }
}

export async function claimGroup(
  groupId: string,
  hostId: string,
  listingId: string,
  isFree: boolean,
  priceCents: number
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: claimError } = await supabase
      .from('pi_group_claims')
      .insert({
        group_id: groupId,
        host_id: hostId,
        listing_id: listingId,
        is_free_claim: isFree,
        claim_price_cents: priceCents,
        status: 'pending',
        created_at: now,
        expires_at: expiresAt,
      });
    if (claimError) return false;

    await supabase
      .from('pi_auto_groups')
      .update({ status: 'claimed' })
      .eq('id', groupId);

    return true;
  } catch {
    return false;
  }
}

export async function releaseGroup(groupId: string, hostId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('pi_group_claims')
      .update({ status: 'withdrawn', responded_at: now })
      .eq('group_id', groupId)
      .eq('host_id', hostId)
      .eq('status', 'pending');

    if (error) return false;

    await supabase
      .from('pi_auto_groups')
      .update({ status: 'ready' })
      .eq('id', groupId);

    return true;
  } catch {
    return false;
  }
}

export async function setAutoMatchEnabled(userId: string, enabled: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ pi_auto_match_enabled: enabled })
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function isAutoMatchEnabled(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('pi_auto_match_enabled')
      .eq('user_id', userId)
      .single();
    return data?.pi_auto_match_enabled ?? true;
  } catch {
    return true;
  }
}

export async function getAutoMatchStats(userId: string): Promise<{
  totalGroups: number;
  activeGroup: PiAutoGroup | null;
  pendingInvites: number;
  lastMatchAttempt: string | null;
}> {
  try {
    const [groups, pendingCount, profileData] = await Promise.all([
      getUserAutoGroups(userId),
      getPendingAutoGroupCount(userId),
      supabase
        .from('profiles')
        .select('pi_last_match_attempt')
        .eq('user_id', userId)
        .single(),
    ]);

    const activeGroup = groups.find(g => g.status === 'forming' || g.status === 'ready') ?? null;

    return {
      totalGroups: groups.length,
      activeGroup,
      pendingInvites: pendingCount,
      lastMatchAttempt: profileData.data?.pi_last_match_attempt ?? null,
    };
  } catch {
    return { totalGroups: 0, activeGroup: null, pendingInvites: 0, lastMatchAttempt: null };
  }
}

export async function getGroupClaims(groupId: string): Promise<PiGroupClaim[]> {
  try {
    const { data } = await supabase
      .from('pi_group_claims')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    return (data as PiGroupClaim[]) ?? [];
  } catch {
    return [];
  }
}

export async function getClaimsUsedThisMonth(
  hostId: string
): Promise<{ total: number; free: number; paid: number }> {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('pi_group_claims')
      .select('is_free_claim')
      .eq('host_id', hostId)
      .gte('created_at', monthStart.toISOString());

    if (!data) return { total: 0, free: 0, paid: 0 };

    const free = data.filter(c => c.is_free_claim).length;
    return { total: data.length, free, paid: data.length - free };
  } catch {
    return { total: 0, free: 0, paid: 0 };
  }
}

export async function getClaimAllowance(
  hostId: string,
  plan: string,
  hostType?: string
): Promise<{ allowed: boolean; isFree: boolean; priceCents: number; freeRemaining: number }> {
  const limits = getAutoClaimLimits(plan, hostType);
  if (limits.freePerMonth === -1) {
    return { allowed: true, isFree: true, priceCents: 0, freeRemaining: -1 };
  }

  const usage = await getClaimsUsedThisMonth(hostId);
  const freeRemaining = Math.max(0, limits.freePerMonth - usage.free);

  if (freeRemaining > 0) {
    return { allowed: true, isFree: true, priceCents: 0, freeRemaining };
  }

  if (limits.extraPriceCents > 0) {
    return { allowed: true, isFree: false, priceCents: limits.extraPriceCents, freeRemaining: 0 };
  }

  return { allowed: false, isFree: false, priceCents: 0, freeRemaining: 0 };
}

export async function getPendingAutoGroupCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('pi_auto_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function updateAutoMatchPreferences(
  userId: string,
  preferences: {
    desired_roommate_count?: number;
    desired_bedroom_count?: number;
    household_gender_preference?: string;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(preferences)
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function canJoinAutoGroup(
  userId: string,
  renterPlan: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const normalized = (renterPlan === 'basic' ? 'free' : renterPlan) as RenterPlan;
  const limits = RENTER_PLAN_LIMITS[normalized] ?? RENTER_PLAN_LIMITS.free;
  const current = await getPendingAutoGroupCount(userId);
  return {
    allowed: current < limits.maxPendingAutoGroups,
    current,
    limit: limits.maxPendingAutoGroups,
  };
}
