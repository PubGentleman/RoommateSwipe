import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { calculateGroupCompatibilityScore } from './transitMatching';
import { RoommateProfile } from '../types/models';

export async function getSuggestedGroupMembers(
  groupId: string,
  currentUserId: string,
  limit = 3
): Promise<Array<{ profile: any; groupScore: number; reason: string }>> {
  if (!isSupabaseConfigured) return [];

  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members(user_id)')
    .eq('id', groupId)
    .single();

  if (!group) return [];
  const memberIds: string[] = group.group_members.map((m: any) => m.user_id);
  const maxMembers = group.max_members ?? 4;

  if (memberIds.length >= maxMembers) return [];

  const { data: memberUsers } = await supabase
    .from('users')
    .select('*, profile:profiles(*)')
    .in('id', memberIds);

  const { data: invited } = await supabase
    .from('group_invites')
    .select('invited_user_id')
    .eq('group_id', groupId);
  const invitedIds = (invited ?? []).map((i: any) => i.invited_user_id);
  const excludeIds = [...memberIds, ...invitedIds, currentUserId];

  const { data: candidates } = await supabase
    .from('users')
    .select('*, profile:profiles(*)')
    .eq('role', 'renter')
    .eq('onboarding_step', 'complete')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .limit(30);

  if (!candidates || candidates.length === 0) return [];

  const scored = candidates.map(candidate => {
    const candidateProfile = mapToRoommateProfile(candidate);
    let totalScore = 0;

    for (const member of (memberUsers ?? [])) {
      const memberProfile = mapToRoommateProfile(member);
      const result = calculateGroupCompatibilityScore(memberProfile, candidateProfile);
      totalScore += result.total;
    }

    const avgScore = memberUsers && memberUsers.length > 0
      ? Math.round(totalScore / memberUsers.length)
      : 50;

    let reason = '';
    if (avgScore >= 85) reason = 'Strong lifestyle and budget match with your whole group';
    else if (avgScore >= 70) reason = 'Good fit — similar schedule and budget range';
    else if (avgScore >= 55) reason = 'Compatible on most factors, check move-in date';
    else reason = 'Some differences — worth a conversation';

    return { profile: candidate, groupScore: avgScore, reason };
  });

  return scored
    .filter(s => s.groupScore >= 55)
    .sort((a, b) => b.groupScore - a.groupScore)
    .slice(0, limit);
}

function mapToRoommateProfile(user: any): RoommateProfile {
  const p = Array.isArray(user.profile) ? user.profile[0] : (user.profile ?? {});
  return {
    id: user.id,
    name: user.full_name,
    age: user.age,
    gender: user.gender,
    occupation: user.occupation,
    bio: p.bio || user.bio || '',
    budget: p.budget_max || 0,
    photos: p.photos || [],
    lookingFor: p.room_type || '',
    preferences: { location: user.city || '', moveInDate: p.move_in_date },
    lifestyle: {
      cleanliness: p.cleanliness,
      workSchedule: p.sleep_schedule,
      smoking: p.smoking,
      pets: p.pets,
      socialLevel: p.social_level,
    },
    apartmentPrefs: p.apartment_prefs_complete ? {
      desiredBedrooms: p.desired_bedrooms,
      budgetPerPersonMin: p.budget_per_person_min,
      budgetPerPersonMax: p.budget_per_person_max,
      preferredTrains: p.preferred_trains ?? [],
      preferredNeighborhoods: p.preferred_neighborhoods ?? [],
      amenityMustHaves: p.amenity_must_haves ?? [],
      moveInDate: p.move_in_date,
      locationFlexible: p.location_flexible,
      wfh: p.wfh,
      apartmentPrefsComplete: true,
    } : undefined,
  } as RoommateProfile;
}
