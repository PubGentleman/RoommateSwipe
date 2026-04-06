import { RoommateProfile } from '../types/models';
import { StorageService } from './storage';
import { detectGroupConflicts, calculateGroupCompatibilityScore } from './transitMatching';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
    let group: any = null;
    let memberProfiles: RoommateProfile[] = [];

    if (isSupabaseConfigured) {
      const { data: groupData } = await supabase
        .from('groups')
        .select(`
          id, name, max_members,
          members:group_members(user_id, is_couple, is_host, status)
        `)
        .eq('id', groupId)
        .single();

      if (groupData) {
        group = groupData;
        const activeMembers = (groupData.members || [])
          .filter((m: any) => m.status === 'active' || !m.status);
        const memberIds = activeMembers.map((m: any) => m.user_id).filter(Boolean);

        if (memberIds.length >= 2) {
          const [profilesResult, usersResult] = await Promise.all([
            supabase.from('profiles').select('*').in('user_id', memberIds),
            supabase.from('users').select('id, full_name, age, birthday, gender, zodiac_sign, city').in('id', memberIds),
          ]);

          const profiles = profilesResult.data || [];
          const users = usersResult.data || [];

          memberProfiles = memberIds.map((id: string) => {
            const profile = profiles.find((p: any) => p.user_id === id);
            const user = users.find((u: any) => u.id === id);
            return {
              id,
              name: user?.full_name || 'Unknown',
              age: user?.age,
              budget: profile?.budget_max,
              lifestyle: {
                sleepSchedule: profile?.sleep_schedule,
                cleanliness: profile?.cleanliness,
                smoking: profile?.smoking,
                pets: profile?.pets,
                workSchedule: profile?.work_schedule,
                socialLevel: profile?.social_level,
              },
              preferred_neighborhoods: profile?.preferred_neighborhoods || [],
              profileData: profile,
              apartmentPrefs: {
                budgetPerPersonMin: profile?.budget_min || 0,
                budgetPerPersonMax: profile?.budget_max || 0,
                desiredBedrooms: profile?.desired_bedrooms,
                moveInDate: profile?.move_in_date,
                preferredTrains: profile?.preferred_trains || [],
                preferredNeighborhoods: profile?.preferred_neighborhoods || [],
                amenityMustHaves: profile?.amenity_must_haves || [],
                locationFlexible: profile?.location_flexible || false,
                wfh: profile?.work_schedule === 'wfh_fulltime',
                apartmentPrefsComplete: !!profile?.apartment_prefs_complete,
              },
            } as RoommateProfile;
          }).filter(p => p != null);
        }
      }
    }

    if (!group || memberProfiles.length < 2) {
      const groups = await StorageService.getGroups();
      group = groups.find((g: any) => g.id === groupId);
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
          topConflict: 'Your group needs at least 2 members.',
          conflicts: [],
          suggestions: ['Invite a roommate to join your group'],
          sharedNeighborhoods: [],
          memberCount: memberIds.length,
          desiredBedrooms: null,
          readyToSearch: false,
        };
      }

      const allProfiles = await StorageService.getRoommateProfiles();
      memberProfiles = memberIds
        .map(id => allProfiles.find((p: any) => p.id === id))
        .filter((p): p is RoommateProfile => p != null);
    }

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
