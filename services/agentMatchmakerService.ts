import { StorageService } from '../utils/storage';
import { Property, RoommateProfile, AgentGroupInvite, AgentPlacement } from '../types/models';
import { calculateCompatibility } from '../utils/matchingAlgorithm';
import { AgentPlan, getAgentPlanLimits, canAgentShortlist, canAgentCreateGroup, canAgentPlace } from '../constants/planLimits';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SHORTLIST_KEY = '@rhome/agent_shortlists';
const AGENT_GROUPS_KEY = '@rhome/agent_groups';
const AGENT_INVITES_KEY = '@rhome/agent_invites';
const AGENT_PLACEMENTS_KEY = '@rhome/agent_placements';

export interface AgentRenter {
  id: string;
  name: string;
  age: number;
  occupation: string;
  photos: string[];
  city?: string;
  neighborhood?: string;
  preferredNeighborhoods?: string[];
  budgetMin?: number;
  budgetMax?: number;
  moveInDate?: string;
  cleanliness?: number;
  sleepSchedule?: string;
  smoking?: boolean;
  pets?: boolean;
  interests?: string[];
  roomType?: string;
  gender?: string;
  bio?: string;
  compatibility?: number;
  isShortlisted?: boolean;
}

export interface AgentGroup {
  id: string;
  name: string;
  agentId: string;
  targetListingId?: string;
  targetListing?: Property;
  members: AgentRenter[];
  memberIds: string[];
  groupStatus: 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved';
  avgCompatibility: number;
  combinedBudgetMin: number;
  combinedBudgetMax: number;
  coversRent: boolean;
  invites: AgentGroupInvite[];
  createdAt: string;
  agentMessage?: string;
}

export async function getShortlistedRenterIds(agentId: string): Promise<string[]> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(SHORTLIST_KEY);
    const list = data ? JSON.parse(data) : [];
    return list.filter((s: any) => s.agentId === agentId).map((s: any) => s.renterId);
  }

  const { data, error } = await supabase
    .from('agent_shortlists')
    .select('renter_id')
    .eq('agent_id', agentId);

  if (error) {
    console.warn('[AgentService] getShortlistedRenterIds error:', error.message);
    return [];
  }
  return (data || []).map(s => s.renter_id);
}

export async function addToShortlist(agentId: string, renterId: string, listingId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(SHORTLIST_KEY);
    const list = data ? JSON.parse(data) : [];
    const exists = list.find((s: any) => s.agentId === agentId && s.renterId === renterId);
    if (exists) return false;
    list.push({ id: `sl_${Date.now()}`, agentId, renterId, listingId, createdAt: new Date().toISOString() });
    await StorageService.storeData(SHORTLIST_KEY, JSON.stringify(list));
    return true;
  }

  const { data: existing } = await supabase
    .from('agent_shortlists')
    .select('id')
    .eq('agent_id', agentId)
    .eq('renter_id', renterId)
    .maybeSingle();

  if (existing) return false;

  const { error } = await supabase
    .from('agent_shortlists')
    .insert({ agent_id: agentId, renter_id: renterId, listing_id: listingId || null });

  if (error) {
    console.warn('[AgentService] addToShortlist error:', error.message);
    return false;
  }
  return true;
}

export async function removeFromShortlist(agentId: string, renterId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(SHORTLIST_KEY);
    const list = data ? JSON.parse(data) : [];
    const filtered = list.filter((s: any) => !(s.agentId === agentId && s.renterId === renterId));
    await StorageService.storeData(SHORTLIST_KEY, JSON.stringify(filtered));
    return;
  }

  await supabase
    .from('agent_shortlists')
    .delete()
    .eq('agent_id', agentId)
    .eq('renter_id', renterId);
}

export async function getAgentGroups(agentId: string): Promise<AgentGroup[]> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_GROUPS_KEY);
    const groups = data ? JSON.parse(data) : [];
    return groups.filter((g: AgentGroup) => g.agentId === agentId);
  }

  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      id,
      name,
      created_by_agent,
      target_listing_id,
      group_status,
      created_at,
      group_members(
        user_id,
        role,
        user:users!user_id(id, full_name, avatar_url)
      ),
      listing:listings!target_listing_id(id, title, rent, bedrooms, neighborhood)
    `)
    .eq('created_by_agent', agentId)
    .eq('agent_assembled', true)
    .order('created_at', { ascending: false });

  if (error || !groups) {
    console.warn('[AgentService] getAgentGroups error:', error?.message);
    return [];
  }

  return groups.map(g => {
    const rawMembers = g.group_members || [];
    const memberProfiles = rawMembers.map((m: any) => ({
      id: m.user?.id ?? m.user_id,
      name: m.user?.full_name ?? 'Unknown',
      age: 0,
      occupation: '',
      photos: m.user?.avatar_url ? [m.user.avatar_url] : [],
    }));

    const listing = Array.isArray(g.listing) ? g.listing[0] : g.listing;

    return {
      id: g.id,
      name: g.name || 'Untitled Group',
      agentId: g.created_by_agent,
      targetListingId: g.target_listing_id,
      targetListing: listing ? {
        id: listing.id,
        title: listing.title,
        price: listing.rent || 0,
        bedrooms: listing.bedrooms,
        neighborhood: listing.neighborhood,
      } as any : undefined,
      members: memberProfiles,
      memberIds: rawMembers.map((m: any) => m.user_id),
      groupStatus: g.group_status || 'assembling',
      avgCompatibility: 0,
      combinedBudgetMin: 0,
      combinedBudgetMax: 0,
      coversRent: false,
      invites: [],
      createdAt: g.created_at,
    };
  });
}

export async function createAgentGroup(group: AgentGroup): Promise<AgentGroup> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_GROUPS_KEY);
    const groups = data ? JSON.parse(data) : [];
    groups.push(group);
    await StorageService.storeData(AGENT_GROUPS_KEY, JSON.stringify(groups));
    return group;
  }

  const { data: newGroup, error } = await supabase
    .from('groups')
    .insert({
      name: group.name,
      type: 'roommate',
      created_by: group.agentId,
      created_by_agent: group.agentId,
      agent_assembled: true,
      target_listing_id: group.targetListingId || null,
      group_status: group.groupStatus || 'assembling',
      is_discoverable: false,
    })
    .select()
    .single();

  if (error || !newGroup) {
    console.warn('[AgentService] createAgentGroup error:', error?.message);
    return group;
  }

  if (group.memberIds.length > 0) {
    const members = group.memberIds.map(userId => ({
      group_id: newGroup.id,
      user_id: userId,
      role: 'member' as const,
    }));
    await supabase.from('group_members').insert(members);
  }

  return { ...group, id: newGroup.id };
}

export async function updateAgentGroupStatus(
  groupId: string,
  status: 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved'
): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_GROUPS_KEY);
    const groups = data ? JSON.parse(data) : [];
    const idx = groups.findIndex((g: AgentGroup) => g.id === groupId);
    if (idx >= 0) {
      groups[idx].groupStatus = status;
      await StorageService.storeData(AGENT_GROUPS_KEY, JSON.stringify(groups));
    }
    return;
  }

  await supabase
    .from('groups')
    .update({ group_status: status })
    .eq('id', groupId);
}

export async function getAgentInvitesForRenter(renterId: string): Promise<AgentGroupInvite[]> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    return invites.filter((i: AgentGroupInvite) => i.renterId === renterId);
  }

  const { data, error } = await supabase
    .from('agent_group_invites')
    .select('*')
    .eq('renter_id', renterId)
    .order('sent_at', { ascending: false });

  if (error || !data) return [];

  return data.map(inv => ({
    id: inv.id,
    agentId: inv.agent_id,
    renterId: inv.renter_id,
    groupId: inv.group_id,
    listingId: inv.listing_id,
    status: inv.status,
    message: inv.message,
    sentAt: inv.sent_at,
    respondedAt: inv.responded_at,
    agentName: inv.agent_name,
    listingTitle: inv.listing_title,
    listingRent: inv.listing_rent,
    listingBedrooms: inv.listing_bedrooms,
    listingNeighborhood: inv.listing_neighborhood,
    listingAvailableDate: inv.listing_available_date,
    groupMembers: inv.group_members || [],
  }));
}

export async function sendAgentInvites(
  agentId: string,
  agentName: string,
  groupId: string,
  renterIds: string[],
  listing: Property,
  message: string,
  memberNames: Array<{ id: string; name: string; photo?: string }>
): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];

    for (const renterId of renterIds) {
      invites.push({
        id: `inv_${Date.now()}_${renterId}`,
        agentId,
        renterId,
        groupId,
        listingId: listing.id,
        status: 'pending',
        message,
        sentAt: new Date().toISOString(),
        agentName,
        listingTitle: listing.title,
        listingRent: listing.price,
        listingBedrooms: listing.bedrooms,
        listingNeighborhood: listing.neighborhood,
        listingAvailableDate: listing.availableDate?.toString(),
        groupMembers: memberNames.map(m => ({ ...m, compatibility: 0 })),
      });
    }

    await StorageService.storeData(AGENT_INVITES_KEY, JSON.stringify(invites));
    return;
  }

  const rows = renterIds.map(renterId => ({
    agent_id: agentId,
    renter_id: renterId,
    group_id: groupId,
    listing_id: listing.id,
    status: 'pending',
    message,
    agent_name: agentName,
    listing_title: listing.title,
    listing_rent: listing.price,
    listing_bedrooms: listing.bedrooms,
    listing_neighborhood: listing.neighborhood || null,
    listing_available_date: listing.availableDate?.toString() || null,
    group_members: memberNames.map(m => ({ ...m, compatibility: 0 })),
  }));

  const { data: insertedInvites, error } = await supabase
    .from('agent_group_invites')
    .insert(rows)
    .select('id, renter_id');

  if (error) {
    console.warn('[AgentService] sendAgentInvites error:', error.message);
  }

  if (insertedInvites && insertedInvites.length > 0) {
    const notificationRows = insertedInvites.map(inv => ({
      user_id: inv.renter_id,
      type: 'agent_invite',
      title: `${agentName} wants you in their group!`,
      body: `"${listing.title}" - ${listing.bedrooms}BR at $${listing.price?.toLocaleString()}/mo`,
      data: {
        agentInviteId: inv.id,
        groupId,
        listingTitle: listing.title,
        listingRent: listing.price,
        listingBedrooms: listing.bedrooms,
        groupMembers: memberNames,
      },
      read: false,
    }));

    const { error: notifError } = await supabase.from('notifications').insert(notificationRows);
    if (notifError) {
      console.warn('[AgentService] notification insert error:', notifError.message);
    }
  }

  await supabase
    .from('groups')
    .update({ group_status: 'invited' })
    .eq('id', groupId);
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    const idx = invites.findIndex((i: AgentGroupInvite) => i.id === inviteId);
    if (idx >= 0) {
      invites[idx].status = accept ? 'accepted' : 'declined';
      invites[idx].respondedAt = new Date().toISOString();
      await StorageService.storeData(AGENT_INVITES_KEY, JSON.stringify(invites));

      if (accept) {
        const invite = invites[idx];
        const groupData = await StorageService.getData(AGENT_GROUPS_KEY);
        const groups = groupData ? JSON.parse(groupData) : [];
        const gIdx = groups.findIndex((g: AgentGroup) => g.id === invite.groupId);
        if (gIdx >= 0) {
          const pendingInvites = invites.filter(
            (i: AgentGroupInvite) => i.groupId === invite.groupId && i.status === 'pending'
          );
          if (pendingInvites.length === 0) {
            groups[gIdx].groupStatus = 'active';
            await StorageService.storeData(AGENT_GROUPS_KEY, JSON.stringify(groups));
          }
        }
      }
    }
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('agent_group_invites')
    .update({
      status: accept ? 'accepted' : 'declined',
      responded_at: now,
    })
    .eq('id', inviteId);

  if (error) {
    console.warn('[AgentService] respondToInvite error:', error.message);
    return;
  }

  if (accept) {
    const { data: invite } = await supabase
      .from('agent_group_invites')
      .select('group_id, renter_id')
      .eq('id', inviteId)
      .single();

    if (invite) {
      await supabase
        .from('group_members')
        .upsert({
          group_id: invite.group_id,
          user_id: invite.renter_id,
          role: 'member',
        }, { onConflict: 'group_id,user_id' });

      const { data: pending } = await supabase
        .from('agent_group_invites')
        .select('id')
        .eq('group_id', invite.group_id)
        .eq('status', 'pending');

      if (!pending || pending.length === 0) {
        await supabase
          .from('groups')
          .update({ group_status: 'active' })
          .eq('id', invite.group_id);
      }
    }
  }
}

export async function recordPlacement(
  agentId: string,
  groupId: string,
  listingId: string,
  placementFeeCents: number
): Promise<AgentPlacement> {
  if (!isSupabaseConfigured) {
    const placement: AgentPlacement = {
      id: `pl_${Date.now()}`,
      agentId,
      groupId,
      listingId,
      placementFeeCents,
      placedAt: new Date().toISOString(),
      billingStatus: 'pending',
    };
    const data = await StorageService.getData(AGENT_PLACEMENTS_KEY);
    const placements = data ? JSON.parse(data) : [];
    placements.push(placement);
    await StorageService.storeData(AGENT_PLACEMENTS_KEY, JSON.stringify(placements));
    return placement;
  }

  const { data, error } = await supabase
    .from('agent_placements')
    .insert({
      agent_id: agentId,
      group_id: groupId,
      listing_id: listingId,
      placement_fee_cents: placementFeeCents,
      billing_status: 'pending',
    })
    .select()
    .single();

  if (error || !data) {
    console.warn('[AgentService] recordPlacement error:', error?.message);
    return {
      id: `pl_${Date.now()}`,
      agentId,
      groupId,
      listingId,
      placementFeeCents,
      placedAt: new Date().toISOString(),
      billingStatus: 'pending',
    };
  }

  return {
    id: data.id,
    agentId: data.agent_id,
    groupId: data.group_id,
    listingId: data.listing_id,
    placementFeeCents: data.placement_fee_cents,
    placedAt: data.placed_at,
    billingStatus: data.billing_status,
  };
}

export async function chargeAgentPlacementFee(
  agentId: string,
  placementId: string,
  groupId: string,
  listingId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_PLACEMENTS_KEY);
    const placements: AgentPlacement[] = data ? JSON.parse(data) : [];
    const idx = placements.findIndex(p => p.id === placementId);
    if (idx >= 0) {
      placements[idx].billingStatus = 'charged';
      await StorageService.storeData(AGENT_PLACEMENTS_KEY, JSON.stringify(placements));
    }
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('charge-placement-fee', {
      body: { placementId, groupId, listingId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? false, error: data?.error };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'Payment failed' };
  }
}

export async function getMonthlyPlacementCount(agentId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    const data = await StorageService.getData(AGENT_PLACEMENTS_KEY);
    const placements: AgentPlacement[] = data ? JSON.parse(data) : [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return placements.filter(
      p => p.agentId === agentId && new Date(p.placedAt) >= startOfMonth
    ).length;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from('agent_placements')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .gte('placed_at', startOfMonth);

  if (error) {
    console.warn('[AgentService] getMonthlyPlacementCount error:', error.message);
    return 0;
  }
  return count || 0;
}

export function generateAISuggestions(renters: AgentRenter[], listing: Property): Array<{
  renter: AgentRenter;
  listingFitScore: number;
  reason: string;
}> {
  const sharePerPerson = listing.price / listing.bedrooms;

  return renters
    .map(renter => {
      const budgetOk = (renter.budgetMax ?? 0) >= sharePerPerson;
      const moveInOk = isMoveInCompatible(renter.moveInDate ?? null, listing.availableDate?.toString() ?? null);

      if (!budgetOk || !moveInOk) return null;

      const budgetScore = Math.min(100, ((renter.budgetMax ?? 0) / sharePerPerson) * 100);
      const profileComplete = renter.bio && renter.photos.length > 0 ? 80 : 50;
      const lifestyleScore = 70;

      const listingFitScore = Math.round(
        (budgetScore * 0.4) + (profileComplete * 0.3) + (lifestyleScore * 0.3)
      );

      let reason = '';
      if (listingFitScore >= 90) reason = 'Strong profile, move-in ready';
      else if (listingFitScore >= 75) reason = 'Good fit, verify lifestyle preferences';
      else reason = 'Marginal fit — check budget flexibility';

      return { renter, listingFitScore, reason };
    })
    .filter(Boolean)
    .sort((a, b) => b!.listingFitScore - a!.listingFitScore)
    .slice(0, 5) as Array<{ renter: AgentRenter; listingFitScore: number; reason: string }>;
}

function isMoveInCompatible(renterDate: string | null, listingDate: string | null): boolean {
  if (!renterDate || !listingDate) return true;
  const moveIn = new Date(renterDate);
  const available = new Date(listingDate);
  const diffDays = Math.abs((moveIn.getTime() - available.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 30;
}

export function generateBestGroupSuggestion(
  shortlisted: AgentRenter[],
  listing: Property
): {
  group: AgentRenter[];
  names: string[];
  avgCompatibility: number;
  combinedBudgetMin: number;
  combinedBudgetMax: number;
  coversRent: boolean;
  score: number;
} | null {
  if (shortlisted.length < 2) return null;
  const needed = Math.min(listing.bedrooms, shortlisted.length);
  if (needed < 2) return null;

  const combinations = getCombinations(shortlisted, needed);
  if (combinations.length === 0) return null;

  const scored = combinations.map(group => {
    const combinedMin = group.reduce((sum, r) => sum + (r.budgetMin ?? 0), 0);
    const combinedMax = group.reduce((sum, r) => sum + (r.budgetMax ?? 0), 0);
    const coversRent = combinedMax >= listing.price;

    const pairs = getPairs(group);
    const avgCompatibility = pairs.length > 0
      ? Math.round(pairs.reduce((sum, [a, b]) => sum + calculatePairCompatibility(a, b), 0) / pairs.length)
      : 70;

    return {
      group,
      names: group.map(r => r.name),
      avgCompatibility,
      combinedBudgetMin: combinedMin,
      combinedBudgetMax: combinedMax,
      coversRent,
      score: coversRent ? avgCompatibility : avgCompatibility * 0.5,
    };
  });

  return scored.sort((a, b) => b.score - a.score)[0] ?? null;
}

function calculatePairCompatibility(a: AgentRenter, b: AgentRenter): number {
  let score = 50;
  if (a.cleanliness !== undefined && b.cleanliness !== undefined) {
    const diff = Math.abs(a.cleanliness - b.cleanliness);
    score += diff <= 2 ? 15 : diff <= 4 ? 5 : -5;
  }
  if (a.sleepSchedule && b.sleepSchedule) {
    score += a.sleepSchedule === b.sleepSchedule ? 15 : -5;
  }
  if (a.smoking !== undefined && b.smoking !== undefined) {
    score += a.smoking === b.smoking ? 10 : -10;
  }
  if (a.pets !== undefined && b.pets !== undefined) {
    score += a.pets === b.pets ? 5 : -5;
  }
  return Math.max(0, Math.min(100, score));
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k > arr.length || k <= 0) return [];
  if (k === arr.length) return [arr];
  if (k === 1) return arr.map(el => [el]);

  const result: T[][] = [];
  const maxCombinations = 50;

  function combine(start: number, combo: T[]) {
    if (result.length >= maxCombinations) return;
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length && result.length < maxCombinations; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

function getPairs<T>(arr: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]]);
    }
  }
  return pairs;
}

export function calculatePairMatrix(renters: AgentRenter[]): { a: string; b: string; score: number }[] {
  const pairs: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < renters.length; i++) {
    for (let j = i + 1; j < renters.length; j++) {
      pairs.push({
        a: renters[i].id,
        b: renters[j].id,
        score: calculatePairCompatibility(renters[i], renters[j]),
      });
    }
  }
  return pairs;
}
