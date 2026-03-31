export interface GroupMemberUnit {
  is_couple?: boolean;
  isCouple?: boolean;
  is_host?: boolean;
  isHost?: boolean;
}

export function getGroupUnitCount(members: GroupMemberUnit[]): number {
  return members.filter(m => !m.is_host && !m.isHost).length;
}

export function getGroupRoomsNeeded(members: GroupMemberUnit[]): number {
  return getGroupUnitCount(members);
}

export function getGroupCompositionLabel(members: GroupMemberUnit[]): string {
  const nonHost = members.filter(m => !m.is_host && !m.isHost);
  const couples = nonHost.filter(m => m.is_couple || m.isCouple).length;
  const singles = nonHost.length - couples;
  const roomsNeeded = nonHost.length;

  const parts: string[] = [];
  if (couples > 0) parts.push(`${couples} couple${couples > 1 ? 's' : ''}`);
  if (singles > 0) parts.push(`${singles} single${singles > 1 ? 's' : ''}`);

  return `${parts.join(' + ')} · ${roomsNeeded} room${roomsNeeded !== 1 ? 's' : ''} needed`;
}

export function canGroupFitListing(
  members: GroupMemberUnit[],
  roomsAvailable: number | null | undefined
): 'fits' | 'too_big' | 'unknown' {
  if (roomsAvailable == null || roomsAvailable <= 0) return 'unknown';
  const needed = getGroupRoomsNeeded(members);
  return needed <= roomsAvailable ? 'fits' : 'too_big';
}

export interface GroupMemberWithGender extends GroupMemberUnit {
  gender?: string;
}

export function isGroupGenderCompatible(
  members: GroupMemberWithGender[],
  preferredTenantGender?: string | null
): { compatible: boolean; reason?: string } {
  if (!preferredTenantGender || preferredTenantGender === 'any') {
    return { compatible: true };
  }

  const nonHost = members.filter(m => !m.is_host && !m.isHost);

  for (const member of nonHost) {
    const g = (member.gender || '').toLowerCase();
    if (preferredTenantGender === 'female_only' && g !== 'female') {
      return {
        compatible: false,
        reason: 'This listing is for women only. Your group includes non-female members.',
      };
    }
    if (preferredTenantGender === 'male_only' && g !== 'male') {
      return {
        compatible: false,
        reason: 'This listing is for men only. Your group includes non-male members.',
      };
    }
  }

  return { compatible: true };
}
