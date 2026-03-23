import { StorageService } from '../utils/storage';
import { Property, RoommateProfile, AgentGroupInvite, AgentPlacement } from '../types/models';
import { calculateCompatibility } from '../utils/matchingAlgorithm';
import { AgentPlan, getAgentPlanLimits, canAgentShortlist, canAgentCreateGroup, canAgentPlace } from '../constants/planLimits';

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
  const data = await StorageService.getData(SHORTLIST_KEY);
  const list = data ? JSON.parse(data) : [];
  return list.filter((s: any) => s.agentId === agentId).map((s: any) => s.renterId);
}

export async function addToShortlist(agentId: string, renterId: string, listingId?: string): Promise<boolean> {
  const data = await StorageService.getData(SHORTLIST_KEY);
  const list = data ? JSON.parse(data) : [];
  const exists = list.find((s: any) => s.agentId === agentId && s.renterId === renterId);
  if (exists) return false;
  list.push({ id: `sl_${Date.now()}`, agentId, renterId, listingId, createdAt: new Date().toISOString() });
  await StorageService.storeData(SHORTLIST_KEY, JSON.stringify(list));
  return true;
}

export async function removeFromShortlist(agentId: string, renterId: string): Promise<void> {
  const data = await StorageService.getData(SHORTLIST_KEY);
  const list = data ? JSON.parse(data) : [];
  const filtered = list.filter((s: any) => !(s.agentId === agentId && s.renterId === renterId));
  await StorageService.storeData(SHORTLIST_KEY, JSON.stringify(filtered));
}

export async function getAgentGroups(agentId: string): Promise<AgentGroup[]> {
  const data = await StorageService.getData(AGENT_GROUPS_KEY);
  const groups = data ? JSON.parse(data) : [];
  return groups.filter((g: AgentGroup) => g.agentId === agentId);
}

export async function createAgentGroup(group: AgentGroup): Promise<AgentGroup> {
  const data = await StorageService.getData(AGENT_GROUPS_KEY);
  const groups = data ? JSON.parse(data) : [];
  groups.push(group);
  await StorageService.storeData(AGENT_GROUPS_KEY, JSON.stringify(groups));
  return group;
}

export async function updateAgentGroupStatus(
  groupId: string,
  status: 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved'
): Promise<void> {
  const data = await StorageService.getData(AGENT_GROUPS_KEY);
  const groups = data ? JSON.parse(data) : [];
  const idx = groups.findIndex((g: AgentGroup) => g.id === groupId);
  if (idx >= 0) {
    groups[idx].groupStatus = status;
    await StorageService.storeData(AGENT_GROUPS_KEY, JSON.stringify(groups));
  }
}

export async function getAgentInvitesForRenter(renterId: string): Promise<AgentGroupInvite[]> {
  const data = await StorageService.getData(AGENT_INVITES_KEY);
  const invites = data ? JSON.parse(data) : [];
  return invites.filter((i: AgentGroupInvite) => i.renterId === renterId);
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
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
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
}

export async function recordPlacement(
  agentId: string,
  groupId: string,
  listingId: string,
  placementFeeCents: number
): Promise<AgentPlacement> {
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

export async function getMonthlyPlacementCount(agentId: string): Promise<number> {
  const data = await StorageService.getData(AGENT_PLACEMENTS_KEY);
  const placements: AgentPlacement[] = data ? JSON.parse(data) : [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return placements.filter(
    p => p.agentId === agentId && new Date(p.placedAt) >= startOfMonth
  ).length;
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
