import { StorageService } from './storage';
import { RoommateProfile } from '../types/models';
import { calculateCompatibility } from './matchingAlgorithm';

export interface GroupQuickStats {
  suggestedMemberCount: number;
  matchingApartmentCount: number;
}

export async function getGroupQuickStats(
  groupId: string,
  currentUserId: string
): Promise<GroupQuickStats> {
  try {
    const groups = await StorageService.getGroups();
    const group = groups.find((g: any) => g.id === groupId);
    if (!group) return { suggestedMemberCount: 0, matchingApartmentCount: 0 };

    const rawMembers = group.members || [];
    const memberIds: string[] = rawMembers.map((m: any) =>
      typeof m === 'string' ? m : m.id || m.user_id
    ).filter(Boolean);

    const allProfiles = await StorageService.getRoommateProfiles();
    const memberProfiles = memberIds
      .map(id => allProfiles.find((p: any) => p.id === id))
      .filter((p): p is RoommateProfile => p != null);

    const nonMemberProfiles = allProfiles.filter(
      (p: any) => !memberIds.includes(p.id) && p.id !== currentUserId
    );

    let suggestedMemberCount = 0;
    for (const candidate of nonMemberProfiles) {
      const scores = memberProfiles.map(member =>
        calculateCompatibility(member as any, candidate as any)
      );
      const avgScore = scores.length > 0
        ? scores.reduce((s, n) => s + n, 0) / scores.length
        : 0;
      if (avgScore >= 65) suggestedMemberCount++;
    }

    let matchingApartmentCount = 0;
    if (memberProfiles.length >= 2) {
      try {
        const listings = await StorageService.getListings();
        const groupBudgetMax = memberProfiles.reduce(
          (sum, m) => sum + ((m as any).budget || (m as any).apartmentPrefs?.budgetPerPersonMax || 0), 0
        );

        for (const listing of listings) {
          if (!(listing as any).available) continue;
          const price = (listing as any).price || 0;
          if (groupBudgetMax > 0 && price <= groupBudgetMax * 1.1 && price > 0) {
            matchingApartmentCount++;
          }
        }
      } catch {}
    }

    return {
      suggestedMemberCount: Math.min(suggestedMemberCount, 99),
      matchingApartmentCount: Math.min(matchingApartmentCount, 99),
    };
  } catch (err) {
    console.warn('[groupQuickStats] Error:', err);
    return { suggestedMemberCount: 0, matchingApartmentCount: 0 };
  }
}

export async function getAllGroupQuickStats(
  groupIds: string[],
  currentUserId: string
): Promise<Record<string, GroupQuickStats>> {
  const results: Record<string, GroupQuickStats> = {};
  await Promise.all(
    groupIds.map(async (id) => {
      const stats = await getGroupQuickStats(id, currentUserId);
      results[id] = stats;
    })
  );
  return results;
}
