import { RoommateProfile } from '../types/models';
import { StorageService } from './storage';
import { detectGroupConflicts, calculateGroupCompatibilityScore } from './transitMatching';

export type GroupHealthStatus = 'strong' | 'good' | 'at_risk' | 'conflict';

export interface GroupHealthResult {
  score: number;
  status: GroupHealthStatus;
  statusLabel: string;
  statusColor: string;
  topConflict: string | null;
  conflicts: string[];
  suggestions: string[];
  sharedNeighborhoods: string[];
  memberCount: number;
  desiredBedrooms: number | null;
  readyToSearch: boolean;
}

export async function getGroupHealth(
  groupId: string,
  currentUserId: string
): Promise<GroupHealthResult | null> {
  try {
    const groups = await StorageService.getGroups();
    const group = groups.find((g: any) => g.id === groupId);
    if (!group) return null;

    const rawMembers = group.members || [];
    const memberIds: string[] = rawMembers.map((m: any) =>
      typeof m === 'string' ? m : m.id || m.user_id
    ).filter(Boolean);
    if (memberIds.length < 2) {
      return {
        score: 0,
        status: 'at_risk',
        statusLabel: 'Needs Members',
        statusColor: '#f39c12',
        topConflict: 'Your group only has 1 member. Invite someone to get started.',
        conflicts: [],
        suggestions: ['Invite a roommate to join your group'],
        sharedNeighborhoods: [],
        memberCount: memberIds.length,
        desiredBedrooms: null,
        readyToSearch: false,
      };
    }

    const allProfiles = await StorageService.getRoommateProfiles();
    const memberProfiles: RoommateProfile[] = memberIds
      .map(id => allProfiles.find((p: any) => p.id === id))
      .filter((p): p is RoommateProfile => p != null);

    if (memberProfiles.length < 2) {
      return {
        score: 0,
        status: 'at_risk',
        statusLabel: 'Needs Members',
        statusColor: '#f39c12',
        topConflict: 'Not enough member profiles found.',
        conflicts: [],
        suggestions: ['Invite more roommates to your group'],
        sharedNeighborhoods: [],
        memberCount: memberProfiles.length,
        desiredBedrooms: null,
        readyToSearch: false,
      };
    }

    const conflictResult = detectGroupConflicts(memberProfiles);

    const pairs: Array<[RoommateProfile, RoommateProfile]> = [];
    for (let i = 0; i < memberProfiles.length; i++) {
      for (let j = i + 1; j < memberProfiles.length; j++) {
        pairs.push([memberProfiles[i], memberProfiles[j]]);
      }
    }

    const pairScores = pairs.map(([a, b]) =>
      calculateGroupCompatibilityScore(a, b).total
    );
    const avgScore = pairScores.length > 0
      ? Math.round(pairScores.reduce((s, n) => s + n, 0) / pairScores.length)
      : 50;

    const prefsComplete = memberProfiles.filter(p => p.apartmentPrefs?.apartmentPrefsComplete).length;
    const allPrefsComplete = prefsComplete === memberProfiles.length;

    const bedroomVotes = memberProfiles
      .map(p => p.apartmentPrefs?.desiredBedrooms)
      .filter((v): v is number => v != null && v > 0);
    const desiredBedrooms = bedroomVotes.length > 0
      ? Math.round(bedroomVotes.reduce((s, n) => s + n, 0) / bedroomVotes.length)
      : null;

    const prefsBonus = allPrefsComplete ? 0 : -15;
    const finalScore = Math.max(0, Math.min(100, avgScore + prefsBonus));

    let status: GroupHealthStatus;
    let statusLabel: string;
    let statusColor: string;

    if (conflictResult.conflicts.length >= 2 || finalScore < 40) {
      status = 'conflict';
      statusLabel = 'Conflict';
      statusColor = '#e74c3c';
    } else if (conflictResult.conflicts.length === 1 || finalScore < 65) {
      status = 'at_risk';
      statusLabel = 'Needs Work';
      statusColor = '#f39c12';
    } else if (finalScore < 80) {
      status = 'good';
      statusLabel = 'Good';
      statusColor = '#3498db';
    } else {
      status = 'strong';
      statusLabel = 'Strong';
      statusColor = '#2ecc71';
    }

    const topConflict = conflictResult.conflicts.length > 0
      ? conflictResult.conflicts[0]
      : !allPrefsComplete
        ? `${memberProfiles.length - prefsComplete} member(s) haven't set apartment preferences yet`
        : null;

    const readyToSearch =
      allPrefsComplete &&
      conflictResult.conflicts.length === 0 &&
      finalScore >= 60;

    return {
      score: finalScore,
      status,
      statusLabel,
      statusColor,
      topConflict,
      conflicts: conflictResult.conflicts,
      suggestions: conflictResult.suggestions,
      sharedNeighborhoods: conflictResult.sharedNeighborhoods,
      memberCount: memberProfiles.length,
      desiredBedrooms,
      readyToSearch,
    };
  } catch (err) {
    console.warn('[groupHealthScore] Error calculating health:', err);
    return null;
  }
}

export async function getGroupsHealth(
  groupIds: string[],
  currentUserId: string
): Promise<Record<string, GroupHealthResult>> {
  const results: Record<string, GroupHealthResult> = {};
  await Promise.all(
    groupIds.map(async (id) => {
      const result = await getGroupHealth(id, currentUserId);
      if (result) results[id] = result;
    })
  );
  return results;
}
