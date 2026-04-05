export type SearchType = 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | 'entire_apartment' | null | undefined;

export function shouldShowRoommateFeatures(searchType: SearchType): boolean {
  return !searchType || searchType === 'with_roommates';
}

export function isPreformedGroup(searchType: SearchType): boolean {
  return searchType === 'have_group';
}

export function isPlaceSeeker(searchType: SearchType): boolean {
  return searchType === 'solo' || searchType === 'with_partner' || searchType === 'have_group' || searchType === 'entire_apartment';
}

export function isFastLane(searchType: SearchType): boolean {
  return searchType === 'solo' || searchType === 'with_partner' || searchType === 'have_group' || searchType === 'entire_apartment';
}

export function needsRoommates(searchType: SearchType): boolean {
  return !searchType || searchType === 'with_roommates';
}

export function getIntentLabel(searchType: SearchType): string {
  switch (searchType) {
    case 'solo': return 'Finding a place for yourself';
    case 'with_partner': return 'Finding a place with partner';
    case 'have_group': return 'Finding a place with your group';
    case 'entire_apartment': return 'Finding an entire apartment';
    case 'with_roommates': return 'Finding roommates';
    default: return 'Set your search preference';
  }
}
