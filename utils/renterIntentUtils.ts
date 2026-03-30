export type SearchType = 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | null | undefined;

export function shouldShowRoommateFeatures(searchType: SearchType): boolean {
  return !searchType || searchType === 'with_roommates' || searchType === 'have_group';
}

export function getIntentLabel(searchType: SearchType): string {
  switch (searchType) {
    case 'solo': return 'Finding a place for yourself';
    case 'with_partner': return 'Finding a place with partner';
    case 'have_group': return 'Finding a place with your group';
    case 'with_roommates': return 'Finding roommates';
    default: return 'Set your search preference';
  }
}
