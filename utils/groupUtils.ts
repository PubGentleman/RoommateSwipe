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
