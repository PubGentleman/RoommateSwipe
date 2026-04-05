import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, RoommateProfile, AgentGroupInvite, AgentPlacement } from '../types/models';
import { calculateCompatibility } from '../utils/matchingAlgorithm';
import { AgentPlan, getAgentPlanLimits, canAgentShortlist, canAgentCreateGroup, canAgentPlace } from '../constants/planLimits';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { shouldLoadMockData } from '../utils/dataUtils';

const useLocalData = () => shouldLoadMockData() || !isSupabaseConfigured;

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
  smoking?: string | boolean;
  pets?: boolean;
  hasPets?: boolean;
  noPetsAllergy?: boolean;
  interests?: string[];
  roomType?: string;
  gender?: string;
  bio?: string;
  compatibility?: number;
  isShortlisted?: boolean;
  acceptAgentOffers?: boolean;
  guestPolicy?: string;
  noiseTolerance?: number;
  workLocation?: string;
  lastActiveAt?: string;
  desiredBedrooms?: number;
  locationFlexible?: boolean;
  apartmentPrefsComplete?: boolean;
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
  isDiscoverable?: boolean;
}

export async function getShortlistedRenterIds(agentId: string): Promise<string[]> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(SHORTLIST_KEY);
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

export async function addToShortlist(agentId: string, renterId: string, listingId?: string): Promise<{ success: boolean; error?: string }> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(SHORTLIST_KEY);
    const list = data ? JSON.parse(data) : [];
    const exists = list.find((s: any) => s.agentId === agentId && s.renterId === renterId);
    if (exists) return { success: false, error: 'Already shortlisted' };
    list.push({ id: `sl_${Date.now()}`, agentId, renterId, listingId, createdAt: new Date().toISOString() });
    await AsyncStorage.setItem(SHORTLIST_KEY, JSON.stringify(list));
    return { success: true };
  }

  const { data: renter } = await supabase
    .from('users')
    .select('accept_agent_offers')
    .eq('id', renterId)
    .maybeSingle();

  if (renter && renter.accept_agent_offers === false) {
    return { success: false, error: 'This renter is not accepting offers from agents' };
  }

  const { data, error } = await supabase
    .from('agent_shortlists')
    .upsert(
      { agent_id: agentId, renter_id: renterId, listing_id: listingId || null },
      { onConflict: 'agent_id,renter_id', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    console.warn('[AgentService] addToShortlist error:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function removeFromShortlist(agentId: string, renterId: string): Promise<void> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(SHORTLIST_KEY);
    const list = data ? JSON.parse(data) : [];
    const filtered = list.filter((s: any) => !(s.agentId === agentId && s.renterId === renterId));
    await AsyncStorage.setItem(SHORTLIST_KEY, JSON.stringify(filtered));
    return;
  }

  await supabase
    .from('agent_shortlists')
    .delete()
    .eq('agent_id', agentId)
    .eq('renter_id', renterId);
}

async function getAgentGroupsFromLocal(agentId: string): Promise<AgentGroup[]> {
  const data = await AsyncStorage.getItem(AGENT_GROUPS_KEY);
  const groups = data ? JSON.parse(data) : [];
  return groups.filter((g: AgentGroup) => g.agentId === agentId);
}

export interface AgentGroupsResult {
  groups: AgentGroup[];
  isStale: boolean;
}

export async function getAgentGroups(agentId: string): Promise<AgentGroupsResult> {
  if (useLocalData()) {
    return { groups: await getAgentGroupsFromLocal(agentId), isStale: false };
  }

  try {
    const queryPromise = supabase
      .from('groups')
      .select(`
        id,
        name,
        created_by_agent,
        target_listing_id,
        group_status,
        is_discoverable,
        created_at,
        group_members(
          user_id,
          role,
          user:users!user_id(id, full_name, avatar_url, age, occupation,
            profile:profiles(budget_min, budget_max)
          )
        ),
        listing:listings!target_listing_id(id, title, rent, bedrooms, neighborhood)
      `)
      .eq('created_by_agent', agentId)
      .eq('agent_assembled', true)
      .order('created_at', { ascending: false });

    let queryFinished = false;
    const wrappedQuery = queryPromise.then(result => { queryFinished = true; return result; });
    const timeout = new Promise<null>((resolve) => setTimeout(() => {
      if (!queryFinished) console.warn('[AgentService] getAgentGroups query timed out');
      resolve(null);
    }, 5000));
    const result = await Promise.race([wrappedQuery, timeout]);
    if (!result) {
      console.warn('[AgentService] getAgentGroups timed out, falling back to local');
      return { groups: await getAgentGroupsFromLocal(agentId), isStale: true };
    }
    const { data: groups, error } = result;

    if (error || !groups) {
      console.warn('[AgentService] getAgentGroups error, falling back to local:', error?.message);
      return { groups: await getAgentGroupsFromLocal(agentId), isStale: true };
    }

    if (groups.length === 0) {
      return { groups: await getAgentGroupsFromLocal(agentId), isStale: false };
    }

    const mapped = groups.map(g => {
      const rawMembers = g.group_members || [];
      const memberProfiles = rawMembers.map((m: any) => ({
        id: m.user?.id ?? m.user_id,
        name: m.user?.full_name ?? 'Unknown',
        age: m.user?.age ?? 0,
        occupation: m.user?.occupation ?? '',
        photos: m.user?.avatar_url ? [m.user.avatar_url] : [],
      }));

      const listing = Array.isArray(g.listing) ? g.listing[0] : g.listing;
      const listingPrice = listing?.rent ?? 0;

      const avgCompatibility = (g as any).avg_compatibility ?? 0;
      const combinedBudgetMin = memberProfiles.reduce((sum: number, _m: any, i: number) => {
        const rawMember = rawMembers[i] as any;
        const profile = rawMember?.user?.profile;
        const p = Array.isArray(profile) ? profile[0] : profile;
        return sum + (p?.budget_min ?? 0);
      }, 0);
      const combinedBudgetMax = memberProfiles.reduce((sum: number, _m: any, i: number) => {
        const rawMember = rawMembers[i] as any;
        const profile = rawMember?.user?.profile;
        const p = Array.isArray(profile) ? profile[0] : profile;
        return sum + (p?.budget_max ?? 0);
      }, 0);

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
        avgCompatibility,
        combinedBudgetMin,
        combinedBudgetMax,
        coversRent: listingPrice > 0 ? combinedBudgetMax >= listingPrice : false,
        invites: [],
        createdAt: g.created_at,
        isDiscoverable: (g as any).is_discoverable ?? false,
      };
    });
    return { groups: mapped, isStale: false };
  } catch (e) {
    console.warn('[AgentService] getAgentGroups exception, falling back to local:', e);
    return { groups: await getAgentGroupsFromLocal(agentId), isStale: true };
  }
}

export async function createAgentGroup(group: AgentGroup): Promise<AgentGroup> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_GROUPS_KEY);
    const groups = data ? JSON.parse(data) : [];
    groups.push(group);
    await AsyncStorage.setItem(AGENT_GROUPS_KEY, JSON.stringify(groups));
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
    console.error('[AgentService] createAgentGroup error:', error?.message);
    throw new Error(error?.message || 'Failed to create group');
  }

  return { ...group, id: newGroup.id };
}

export async function updateAgentGroupStatus(
  groupId: string,
  status: 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved'
): Promise<void> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_GROUPS_KEY);
    const groups = data ? JSON.parse(data) : [];
    const idx = groups.findIndex((g: AgentGroup) => g.id === groupId);
    if (idx >= 0) {
      groups[idx].groupStatus = status;
      await AsyncStorage.setItem(AGENT_GROUPS_KEY, JSON.stringify(groups));
    }
    return;
  }

  await supabase
    .from('groups')
    .update({ group_status: status })
    .eq('id', groupId);
}

export async function getAgentInvitesForRenter(renterId: string): Promise<AgentGroupInvite[]> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    return invites.filter((i: AgentGroupInvite) => i.renterId === renterId);
  }

  const { data, error } = await supabase
    .from('agent_group_invites')
    .select('id, agent_id, renter_id, group_id, status, sent_at, responded_at, listing_id, message')
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
  listing: Property | null | undefined,
  message: string,
  memberNames: Array<{ id: string; name: string; photo?: string }>
): Promise<void> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];

    for (const renterId of renterIds) {
      invites.push({
        id: `inv_${Date.now()}_${renterId}`,
        agentId,
        renterId,
        groupId,
        listingId: listing?.id || null,
        status: 'pending',
        message,
        sentAt: new Date().toISOString(),
        agentName,
        listingTitle: listing?.title || 'No listing assigned yet',
        listingRent: listing?.price,
        listingBedrooms: listing?.bedrooms,
        listingNeighborhood: listing?.neighborhood,
        listingAvailableDate: listing?.availableDate?.toString(),
        groupMembers: memberNames.map(m => ({ ...m, compatibility: 0 })),
      });
    }

    await AsyncStorage.setItem(AGENT_INVITES_KEY, JSON.stringify(invites));
    return;
  }

  const { data: eligibleRenters } = await supabase
    .from('users')
    .select('id')
    .in('id', renterIds)
    .eq('accept_agent_offers', true);

  const eligibleIds = (eligibleRenters || []).map(r => r.id);
  if (eligibleIds.length === 0) {
    console.warn('[AgentService] No eligible renters accept agent offers');
    return;
  }

  const rows = eligibleIds.map(renterId => ({
    agent_id: agentId,
    renter_id: renterId,
    group_id: groupId,
    listing_id: listing?.id || null,
    status: 'pending',
    message,
    agent_name: agentName,
    listing_title: listing?.title || 'No listing assigned yet',
    listing_rent: listing?.price || null,
    listing_bedrooms: listing?.bedrooms || null,
    listing_neighborhood: listing?.neighborhood || null,
    listing_available_date: listing?.availableDate?.toString() || null,
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
      body: listing
        ? `"${listing.title}" - ${listing.bedrooms}BR at $${listing.price?.toLocaleString()}/mo`
        : 'You have a new group invitation from an agent',
      data: {
        agentInviteId: inv.id,
        groupId,
        listingTitle: listing?.title,
        listingRent: listing?.price,
        listingBedrooms: listing?.bedrooms,
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
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    const idx = invites.findIndex((i: AgentGroupInvite) => i.id === inviteId);
    if (idx >= 0) {
      invites[idx].status = accept ? 'accepted' : 'declined';
      invites[idx].respondedAt = new Date().toISOString();
      await AsyncStorage.setItem(AGENT_INVITES_KEY, JSON.stringify(invites));

      if (accept) {
        const invite = invites[idx];
        const groupData = await AsyncStorage.getItem(AGENT_GROUPS_KEY);
        const groups = groupData ? JSON.parse(groupData) : [];
        const gIdx = groups.findIndex((g: AgentGroup) => g.id === invite.groupId);
        if (gIdx >= 0) {
          const pendingInvites = invites.filter(
            (i: AgentGroupInvite) => i.groupId === invite.groupId && i.status === 'pending'
          );
          if (pendingInvites.length === 0) {
            groups[gIdx].groupStatus = 'active';
            await AsyncStorage.setItem(AGENT_GROUPS_KEY, JSON.stringify(groups));
          }
        }
      }
    }
    return;
  }

  const newStatus = accept ? 'accepted' : 'declined';

  const { data: rpcResult, error: rpcError } = await supabase.rpc('respond_to_invite', {
    p_invite_id: inviteId,
    p_status: newStatus,
  });

  if (rpcError) {
    const now = new Date().toISOString();
    const { data: invite, error: fetchError } = await supabase
      .from('agent_group_invites')
      .select('group_id, renter_id')
      .eq('id', inviteId)
      .single();

    if (fetchError || !invite) {
      console.warn('[AgentService] respondToInvite: invite not found');
      return;
    }

    const { error: updateError } = await supabase
      .from('agent_group_invites')
      .update({ status: newStatus, responded_at: now })
      .eq('id', inviteId)
      .eq('status', 'pending');

    if (updateError) {
      console.warn('[AgentService] respondToInvite error:', updateError.message);
      return;
    }

    if (accept) {
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
  if (useLocalData()) {
    const placement: AgentPlacement = {
      id: `pl_${Date.now()}`,
      agentId,
      groupId,
      listingId,
      placementFeeCents,
      placedAt: new Date().toISOString(),
      billingStatus: 'pending',
    };
    const data = await AsyncStorage.getItem(AGENT_PLACEMENTS_KEY);
    const placements = data ? JSON.parse(data) : [];
    placements.push(placement);
    await AsyncStorage.setItem(AGENT_PLACEMENTS_KEY, JSON.stringify(placements));
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
    console.error('[AgentService] recordPlacement error:', error?.message);
    throw new Error(error?.message || 'Failed to record placement');
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
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_PLACEMENTS_KEY);
    const placements: AgentPlacement[] = data ? JSON.parse(data) : [];
    const idx = placements.findIndex(p => p.id === placementId);
    if (idx >= 0) {
      placements[idx].billingStatus = 'charged';
      await AsyncStorage.setItem(AGENT_PLACEMENTS_KEY, JSON.stringify(placements));
    }
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('charge-placement-fee', {
      body: { placementId, groupId, listingId, agentId },
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
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_PLACEMENTS_KEY);
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
  const sharePerPerson = listing.bedrooms > 1 ? listing.price / listing.bedrooms : listing.price;

  return renters
    .map(renter => {
      const renterShare = renter.roomType === 'entire_apartment' ? listing.price : sharePerPerson;
      const budgetOk = (renter.budgetMax ?? 0) >= renterShare;
      const moveInOk = isMoveInCompatible(renter.moveInDate ?? null, listing.availableDate?.toString() ?? null);

      if (!budgetOk || !moveInOk) return null;

      const budgetScore = Math.min(100, ((renter.budgetMax ?? 0) / renterShare) * 100);
      const profileComplete = renter.bio && renter.photos.length > 0 ? 80 : 50;

      let lifestyleScore = 50;
      if (renter.cleanliness !== undefined) lifestyleScore += renter.cleanliness >= 7 ? 15 : 5;
      if (renter.sleepSchedule) lifestyleScore += 10;
      if (renter.smoking === false) lifestyleScore += 10;
      if (renter.interests && renter.interests.length > 0) lifestyleScore += 5;
      lifestyleScore = Math.min(100, lifestyleScore);

      const listingFitScore = Math.round(
        (budgetScore * 0.4) + (profileComplete * 0.3) + (lifestyleScore * 0.3)
      );

      const reasons: string[] = [];
      if (budgetScore >= 90) reasons.push('budget well-matched');
      if (profileComplete >= 80) reasons.push('complete profile');
      if (renter.cleanliness !== undefined && renter.cleanliness >= 7) reasons.push('high cleanliness');
      if (renter.smoking === false) reasons.push('non-smoker');
      const reason = reasons.length > 0
        ? reasons.slice(0, 2).join(', ').replace(/^./, c => c.toUpperCase())
        : (listingFitScore >= 75 ? 'Good fit, verify lifestyle preferences' : 'Marginal fit — check budget flexibility');

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

  const sharePerPerson = listing.price / Math.max(needed, 1);

  const scored = combinations.map(group => {
    const combinedMin = group.reduce((sum, r) => sum + (r.budgetMin ?? 0), 0);
    const combinedMax = group.reduce((sum, r) => sum + (r.budgetMax ?? 0), 0);
    const coversRent = combinedMax >= listing.price;
    const allCanAffordShare = group.every(r => (r.budgetMax ?? 0) >= sharePerPerson);

    const pairs = getPairs(group);
    const avgCompatibility = pairs.length > 0
      ? Math.round(pairs.reduce((sum, [a, b]) => sum + calculatePairCompatibility(a, b), 0) / pairs.length)
      : 70;

    const budgetScore = allCanAffordShare ? 1 : coversRent ? 0.75 : 0.5;

    return {
      group,
      names: group.map(r => r.name),
      avgCompatibility,
      combinedBudgetMin: combinedMin,
      combinedBudgetMax: combinedMax,
      coversRent,
      score: avgCompatibility * budgetScore,
    };
  });

  return scored.sort((a, b) => b.score - a.score)[0] ?? null;
}

export function calculatePairCompatibility(a: AgentRenter, b: AgentRenter): number {
  let totalWeighted = 0;
  let totalWeight = 0;

  const w_sleep = 15;
  totalWeight += w_sleep;
  const sa = a.sleepSchedule ?? 'flexible';
  const sb = b.sleepSchedule ?? 'flexible';
  if (sa === sb) totalWeighted += w_sleep;
  else if (sa === 'flexible' || sb === 'flexible') totalWeighted += w_sleep * 0.7;
  else totalWeighted += w_sleep * 0.15;

  const w_clean = 15;
  totalWeight += w_clean;
  const ca = a.cleanliness ?? 5;
  const cb = b.cleanliness ?? 5;
  const cleanDiff = Math.abs(ca - cb);
  if (cleanDiff <= 1) totalWeighted += w_clean;
  else if (cleanDiff <= 2) totalWeighted += w_clean * 0.8;
  else if (cleanDiff <= 3) totalWeighted += w_clean * 0.55;
  else totalWeighted += w_clean * 0.2;

  const w_smoke = 12;
  totalWeight += w_smoke;
  const smokingA = typeof a.smoking === 'string' ? a.smoking : (a.smoking ? 'yes' : 'no');
  const smokingB = typeof b.smoking === 'string' ? b.smoking : (b.smoking ? 'yes' : 'no');
  if (smokingA === smokingB) totalWeighted += w_smoke;
  else if (smokingA === 'outside_only' || smokingB === 'outside_only' || smokingA === 'outside' || smokingB === 'outside')
    totalWeighted += w_smoke * 0.5;

  const w_pets = 8;
  totalWeight += w_pets;
  const hasPetsA = a.hasPets ?? a.pets ?? false;
  const hasPetsB = b.hasPets ?? b.pets ?? false;
  if (hasPetsA === hasPetsB) totalWeighted += w_pets;
  else if ((hasPetsA && b.noPetsAllergy === true) || (hasPetsB && a.noPetsAllergy === true))
    totalWeighted += 0;
  else totalWeighted += w_pets * 0.6;

  const w_guests = 10;
  totalWeight += w_guests;
  if (a.guestPolicy && b.guestPolicy) {
    const gDiff = Math.abs(guestPolicyRank(a.guestPolicy) - guestPolicyRank(b.guestPolicy));
    if (gDiff === 0) totalWeighted += w_guests;
    else if (gDiff <= 1) totalWeighted += w_guests * 0.7;
    else totalWeighted += w_guests * 0.3;
  } else { totalWeighted += w_guests * 0.5; }

  const w_noise = 8;
  totalWeight += w_noise;
  const na = a.noiseTolerance ?? 5;
  const nb = b.noiseTolerance ?? 5;
  const noiseDiff = Math.abs(na - nb);
  if (noiseDiff <= 1) totalWeighted += w_noise;
  else if (noiseDiff <= 2) totalWeighted += w_noise * 0.65;
  else totalWeighted += w_noise * 0.25;

  const w_budget = 10;
  totalWeight += w_budget;
  const aMax = a.budgetMax ?? a.budgetMin ?? 0;
  const bMax = b.budgetMax ?? b.budgetMin ?? 0;
  if (aMax > 0 && bMax > 0) {
    const ratio = Math.min(aMax, bMax) / Math.max(aMax, bMax);
    if (ratio >= 0.85) totalWeighted += w_budget;
    else if (ratio >= 0.65) totalWeighted += w_budget * 0.6;
    else totalWeighted += w_budget * 0.25;
  } else { totalWeighted += w_budget * 0.5; }

  const w_moveIn = 8;
  totalWeight += w_moveIn;
  if (a.moveInDate && b.moveInDate) {
    const daysDiff = Math.abs((new Date(a.moveInDate).getTime() - new Date(b.moveInDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 14) totalWeighted += w_moveIn;
    else if (daysDiff <= 30) totalWeighted += w_moveIn * 0.6;
    else totalWeighted += w_moveIn * 0.2;
  } else { totalWeighted += w_moveIn * 0.5; }

  return totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) : 50;
}

function guestPolicyRank(policy: string): number {
  const ranks: Record<string, number> = { 'never': 0, 'rarely': 1, 'sometimes': 2, 'often': 3, 'anytime': 4 };
  return ranks[policy] ?? 2;
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

export function analyzeGroupDynamics(renters: AgentRenter[]): {
  avgScore: number;
  minPairScore: number;
  weakestPair: { a: string; b: string; score: number } | null;
  conflicts: string[];
  strengths: string[];
} {
  const pairs = calculatePairMatrix(renters);
  const avgScore = pairs.length > 0
    ? Math.round(pairs.reduce((sum, p) => sum + p.score, 0) / pairs.length)
    : 0;

  const weakest = pairs.length > 0
    ? pairs.reduce((min, p) => p.score < min.score ? p : min, { a: '', b: '', score: 100 })
    : null;
  const minPairScore = weakest?.score ?? 0;

  const conflicts: string[] = [];
  const strengths: string[] = [];

  for (const pair of pairs) {
    if (pair.score < 35) {
      const rA = renters.find(r => r.id === pair.a);
      const rB = renters.find(r => r.id === pair.b);
      conflicts.push(`${rA?.name || 'Unknown'} and ${rB?.name || 'Unknown'} have low compatibility (${pair.score}%)`);
    }
  }

  const smokingValues = renters.map(r => typeof r.smoking === 'string' ? r.smoking : (r.smoking ? 'yes' : 'no'));
  const hasSmokers = smokingValues.some(s => s === 'yes' || s === 'inside');
  const hasNonSmokers = smokingValues.some(s => s === 'no' || s === 'never');
  if (hasSmokers && hasNonSmokers) {
    conflicts.push('Group has both smokers and non-smokers');
  }

  const schedules = renters.map(r => r.sleepSchedule).filter(Boolean);
  if (schedules.includes('early') && schedules.includes('late')) {
    conflicts.push('Group has both early birds and night owls');
  }

  const cleanScores = renters.map(r => r.cleanliness).filter(c => c != null) as number[];
  if (cleanScores.length >= 2) {
    const spread = Math.max(...cleanScores) - Math.min(...cleanScores);
    if (spread >= 4) {
      conflicts.push(`Cleanliness standards vary widely (${Math.min(...cleanScores)}-${Math.max(...cleanScores)}/10)`);
    }
  }

  const petOwners = renters.filter(r => r.hasPets === true || r.pets === true);
  const allergyMembers = renters.filter(r => r.noPetsAllergy === true);
  if (petOwners.length > 0 && allergyMembers.length > 0) {
    conflicts.push('Pet owner + pet allergy conflict');
  }

  if (avgScore >= 80) strengths.push('Excellent overall group compatibility');
  if (minPairScore >= 60) strengths.push('No weak links — all pairs are compatible');

  const budgets = renters.map(r => r.budgetMax).filter(Boolean) as number[];
  if (budgets.length >= 2) {
    const ratio = Math.min(...budgets) / Math.max(...budgets);
    if (ratio >= 0.85) strengths.push('Budgets are well-aligned');
  }

  const moveIns = renters.map(r => r.moveInDate).filter(Boolean);
  if (moveIns.length >= 2) {
    const dates = moveIns.map(d => new Date(d!).getTime());
    const spread = Math.max(...dates) - Math.min(...dates);
    if (spread <= 14 * 24 * 60 * 60 * 1000) {
      strengths.push('Move-in dates are aligned (within 2 weeks)');
    }
  }

  return { avgScore, minPairScore, weakestPair: weakest, conflicts, strengths };
}

export function scoreGroupForListing(
  members: AgentRenter[],
  listing: Property,
  pairMatrix: { a: string; b: string; score: number }[]
): { total: number; compatibility: number; budgetFit: number; locationFit: number; timelineFit: number } {
  const avgPairScore = pairMatrix.length > 0
    ? pairMatrix.reduce((sum, p) => sum + p.score, 0) / pairMatrix.length : 50;
  const minPairScore = pairMatrix.length > 0
    ? Math.min(...pairMatrix.map(p => p.score)) : 50;
  const compatibilityScore = avgPairScore * 0.7 + minPairScore * 0.3;

  const combinedMax = members.reduce((sum, m) => sum + (m.budgetMax ?? 0), 0);
  const combinedMin = members.reduce((sum, m) => sum + (m.budgetMin ?? 0), 0);
  let budgetFit = 50;
  if (combinedMax >= listing.price && combinedMin <= listing.price) budgetFit = 100;
  else if (combinedMax >= listing.price) budgetFit = 80;
  else if (combinedMax >= listing.price * 0.9) budgetFit = 60;
  else budgetFit = 30;

  const neighborhoodMatches = members.filter(m =>
    m.preferredNeighborhoods?.includes(listing.neighborhood ?? '')
  ).length;
  const locationFit = members.length > 0 ? Math.round((neighborhoodMatches / members.length) * 100) : 50;

  let timelineFit = 50;
  if (listing.availableDate) {
    const availDate = new Date(listing.availableDate instanceof Date ? listing.availableDate : listing.availableDate);
    const avgDaysDiff = members.reduce((sum, m) => {
      if (!m.moveInDate) return sum + 30;
      return sum + Math.abs((availDate.getTime() - new Date(m.moveInDate).getTime()) / (1000 * 60 * 60 * 24));
    }, 0) / members.length;

    if (avgDaysDiff <= 7) timelineFit = 100;
    else if (avgDaysDiff <= 14) timelineFit = 85;
    else if (avgDaysDiff <= 30) timelineFit = 65;
    else if (avgDaysDiff <= 60) timelineFit = 40;
    else timelineFit = 20;
  }

  const total = Math.round(
    compatibilityScore * 0.40 + budgetFit * 0.25 + locationFit * 0.20 + timelineFit * 0.15
  );

  return { total, compatibility: Math.round(compatibilityScore), budgetFit, locationFit, timelineFit };
}

export function getOptimalGroupSize(listing: Property): { recommended: number; reason: string } {
  const bedrooms = listing.bedrooms || 1;
  const price = listing.price || 0;
  if (bedrooms === 1) return { recommended: 1, reason: 'Studio/1BR — best for individual or couple' };
  if (bedrooms === 2) return { recommended: 2, reason: '2BR — ideal for 2 renters sharing' };
  if (bedrooms === 3) {
    const perBedroom = price / bedrooms;
    if (perBedroom > 2000) return { recommended: 2, reason: '3BR luxury — 2 renters each getting more space' };
    return { recommended: 3, reason: '3BR — one renter per room' };
  }
  if (bedrooms >= 4) return { recommended: bedrooms, reason: `${bedrooms}BR — one renter per room` };
  return { recommended: 2, reason: 'Standard group size' };
}

export function calculateRenterRelevance(renter: AgentRenter, listing: Property): number {
  let score = 0;
  const perPersonRent = listing.price / (listing.bedrooms || 1);
  if ((renter.budgetMax ?? 0) >= perPersonRent) score += 30;
  else if ((renter.budgetMax ?? 0) >= perPersonRent * 0.8) score += 15;

  if (listing.availableDate && renter.moveInDate) {
    const daysDiff = Math.abs((new Date(listing.availableDate instanceof Date ? listing.availableDate : listing.availableDate).getTime() - new Date(renter.moveInDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 14) score += 20;
    else if (daysDiff <= 30) score += 10;
    else if (daysDiff <= 60) score += 5;
  }

  if (renter.preferredNeighborhoods?.includes(listing.neighborhood ?? '')) score += 20;

  if (listing.bedrooms === 1 && renter.roomType === 'entire') score += 15;
  else if ((listing.bedrooms ?? 0) > 1 && renter.roomType === 'room') score += 15;

  if (renter.lastActiveAt) {
    const hoursSince = (Date.now() - new Date(renter.lastActiveAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) score += 15;
    else if (hoursSince < 72) score += 10;
    else if (hoursSince < 168) score += 5;
  }

  return score;
}

export async function getGroupInviteStatuses(groupId: string): Promise<{
  renterId: string;
  renterName: string;
  avatarUrl?: string;
  status: 'pending' | 'accepted' | 'declined';
  respondedAt: string | null;
}[]> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    return invites
      .filter((inv: any) => inv.groupId === groupId)
      .map((inv: any) => ({
        renterId: inv.renterId,
        renterName: inv.renterName || 'Unknown',
        status: inv.status || 'pending',
        respondedAt: inv.respondedAt || null,
      }));
  }

  const { data, error } = await supabase
    .from('agent_group_invites')
    .select('renter_id, status, responded_at, user:users!renter_id(full_name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((inv: any) => ({
    renterId: inv.renter_id,
    renterName: inv.user?.full_name || 'Unknown',
    avatarUrl: inv.user?.avatar_url,
    status: inv.status,
    respondedAt: inv.responded_at,
  }));
}

export async function addMemberToGroup(groupId: string, renterId: string, agentId: string): Promise<{ success: boolean; error?: string }> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    invites.push({ id: `inv_${Date.now()}`, groupId, renterId, status: 'pending', invitedBy: agentId, createdAt: new Date().toISOString() });
    await AsyncStorage.setItem(AGENT_INVITES_KEY, JSON.stringify(invites));
    return { success: true };
  }

  const { data: group } = await supabase.from('groups').select('group_status').eq('id', groupId).single();
  if (!group || !['assembling', 'invited'].includes(group.group_status)) {
    return { success: false, error: 'Group cannot be modified in current status' };
  }

  const { error } = await supabase
    .from('agent_group_invites')
    .insert({ group_id: groupId, renter_id: renterId, status: 'pending', invited_by: agentId });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeMemberFromGroup(groupId: string, renterId: string): Promise<{ success: boolean; error?: string }> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_INVITES_KEY);
    const invites = data ? JSON.parse(data) : [];
    const filtered = invites.filter((inv: any) => !(inv.groupId === groupId && inv.renterId === renterId));
    await AsyncStorage.setItem(AGENT_INVITES_KEY, JSON.stringify(filtered));
    return { success: true };
  }

  const { data: group } = await supabase.from('groups').select('group_status').eq('id', groupId).single();
  if (!group || !['assembling', 'invited'].includes(group.group_status)) {
    return { success: false, error: 'Group cannot be modified in current status' };
  }

  await supabase.from('agent_group_invites').delete().eq('group_id', groupId).eq('renter_id', renterId);
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', renterId);
  return { success: true };
}

export async function changeGroupListing(groupId: string, newListingId: string): Promise<{ success: boolean; error?: string }> {
  if (useLocalData()) {
    const data = await AsyncStorage.getItem(AGENT_GROUPS_KEY);
    const groups = data ? JSON.parse(data) : [];
    const idx = groups.findIndex((g: any) => g.id === groupId);
    if (idx >= 0) { groups[idx].targetListingId = newListingId; await AsyncStorage.setItem(AGENT_GROUPS_KEY, JSON.stringify(groups)); }
    return { success: true };
  }

  const { data: group } = await supabase.from('groups').select('group_status').eq('id', groupId).single();
  if (!group || !['assembling', 'invited', 'active'].includes(group.group_status)) {
    return { success: false, error: 'Group cannot be modified in current status' };
  }

  const { error } = await supabase.from('groups').update({ target_listing_id: newListingId }).eq('id', groupId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function recordPlacementFeedback(
  placementId: string,
  agentId: string,
  feedback: { stillTogether: boolean; monthsElapsed: number; satisfaction: 1 | 2 | 3 | 4 | 5; notes?: string }
): Promise<void> {
  if (useLocalData()) {
    const key = '@rhome/placement_feedback';
    const data = await AsyncStorage.getItem(key);
    const list = data ? JSON.parse(data) : [];
    list.push({ placementId, agentId, ...feedback, createdAt: new Date().toISOString() });
    await AsyncStorage.setItem(key, JSON.stringify(list));
    return;
  }

  await supabase.from('agent_placement_feedback').upsert({
    placement_id: placementId,
    agent_id: agentId,
    still_together: feedback.stillTogether,
    months_elapsed: feedback.monthsElapsed,
    satisfaction_rating: feedback.satisfaction,
    notes: feedback.notes,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'placement_id' });
}

export async function findSimilarRenters(
  targetRenter: AgentRenter,
  existingIds: string[],
  limit: number = 10
): Promise<{ renter: AgentRenter; similarityScore: number; reasons: string[] }[]> {
  if (useLocalData()) return [];

  const excludeIds = [targetRenter.id, ...existingIds];
  const { data: candidates } = await supabase
    .from('users')
    .select('id, full_name, age, occupation, avatar_url, last_active_at, gender, city, accept_agent_offers, profile:profiles(*)')
    .eq('role', 'renter')
    .eq('onboarding_step', 'complete')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .gte('last_active_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  if (!candidates) return [];

  const scored = candidates.map((c: any) => {
    const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile;
    const candidate = mapToAgentRenter(c, profile);
    const similarityScore = calculatePairCompatibility(targetRenter, candidate);
    const reasons: string[] = [];

    if (candidate.sleepSchedule && candidate.sleepSchedule === targetRenter.sleepSchedule) reasons.push('Same sleep schedule');
    const smokingC = typeof candidate.smoking === 'string' ? candidate.smoking : (candidate.smoking ? 'yes' : 'no');
    const smokingT = typeof targetRenter.smoking === 'string' ? targetRenter.smoking : (targetRenter.smoking ? 'yes' : 'no');
    if (smokingC === smokingT) reasons.push('Same smoking preference');
    if (Math.abs((candidate.cleanliness ?? 5) - (targetRenter.cleanliness ?? 5)) <= 1) reasons.push('Similar cleanliness');
    if (Math.abs((candidate.budgetMax ?? 0) - (targetRenter.budgetMax ?? 0)) <= 300) reasons.push('Similar budget');
    if (candidate.guestPolicy && candidate.guestPolicy === targetRenter.guestPolicy) reasons.push('Same guest policy');
    const sharedInterests = (candidate.interests ?? []).filter((i: string) => (targetRenter.interests ?? []).includes(i));
    if (sharedInterests.length >= 2) reasons.push(`${sharedInterests.length} shared interests`);

    return { renter: candidate, similarityScore, reasons };
  });

  return scored
    .filter(s => s.similarityScore >= 60)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

export function mapToAgentRenter(user: any, profile: any): AgentRenter {
  const p = Array.isArray(profile) ? (profile[0] ?? null) : (profile ?? null);
  return {
    id: user.id,
    name: user.full_name || 'Unknown',
    age: user.age || 0,
    occupation: user.occupation || '',
    photos: p?.photos || (user.avatar_url ? [user.avatar_url] : []),
    city: user.city,
    preferredNeighborhoods: p?.preferred_neighborhoods || [],
    budgetMin: p?.budget_per_person_min ?? (p?.budget_max ? p.budget_max * 0.8 : undefined),
    budgetMax: p?.budget_per_person_max ?? p?.budget_max,
    moveInDate: p?.move_in_date,
    cleanliness: p?.cleanliness,
    sleepSchedule: p?.sleep_schedule,
    smoking: p?.smoking,
    pets: p?.pets === 'yes' || p?.pets === true,
    hasPets: p?.pets === 'yes' || p?.pets === true,
    noPetsAllergy: p?.no_pets_allergy === true,
    interests: p?.interests || p?.interest_tags || [],
    roomType: p?.room_type,
    gender: user.gender,
    bio: p?.bio || user.bio,
    acceptAgentOffers: user.accept_agent_offers !== false,
    guestPolicy: p?.guest_policy,
    noiseTolerance: p?.noise_tolerance,
    workLocation: p?.work_location,
    lastActiveAt: user.last_active_at,
  };
}
