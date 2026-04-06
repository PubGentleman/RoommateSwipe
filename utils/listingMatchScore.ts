import { User } from '../types/models';
import { normalizeLegacyAmenity } from '../constants/amenities';

export interface ListingMatchInput {
  price: number;
  bedrooms: number;
  neighborhood?: string;
  city?: string;
  amenities: string[];
  roomType?: string;
  availableFrom?: string;
  averageRating?: number;
  reviewCount?: number;
  hostBadge?: string | null;
  hostResponseRate?: number;
  daysListed?: number;
  photoCount?: number;
}

interface MatchScoreBreakdown {
  budget: number;
  location: number;
  amenities: number;
  quality: number;
  freshness: number;
  total: number;
}

export function calculateListingMatchScore(
  user: User,
  listing: ListingMatchInput,
  roommateCompatibility?: number
): number {
  const breakdown = getMatchBreakdown(user, listing);

  if (roommateCompatibility !== undefined && isRoommateSeekerUser(user)) {
    const blended = (breakdown.total * 0.6) + (roommateCompatibility * 0.4);
    return Math.round(blended);
  }

  return breakdown.total;
}

function isRoommateSeekerUser(user: User): boolean {
  const searchType =
    (user as any).profileData?.apartment_search_type ||
    (user as any).apartmentSearchType ||
    (user as any).apartment_search_type;
  return searchType === 'with_roommates' || searchType === 'have_group';
}

function getMatchBreakdown(user: User, listing: ListingMatchInput): MatchScoreBreakdown {
  const breakdown: MatchScoreBreakdown = {
    budget: 0,
    location: 0,
    amenities: 0,
    quality: 0,
    freshness: 0,
    total: 0,
  };

  const userBudget = (user as any).profileData?.budget || (user as any).budget;
  if (userBudget && listing.price) {
    const ratio = listing.price / userBudget;
    if (ratio <= 0.7) breakdown.budget = 30;
    else if (ratio <= 0.85) breakdown.budget = 28;
    else if (ratio <= 1.0) breakdown.budget = 25;
    else if (ratio <= 1.1) breakdown.budget = 15;
    else if (ratio <= 1.25) breakdown.budget = 8;
    else breakdown.budget = 2;
  } else {
    breakdown.budget = 15;
  }

  const preferredNeighborhoods =
    (user as any).preferred_neighborhoods ||
    [];
  const userCity = (user as any).profileData?.city || (user as any).city;
  const userNeighborhood = (user as any).profileData?.neighborhood || (user as any).neighborhood;

  if (preferredNeighborhoods.length > 0 && listing.neighborhood) {
    const listingArea = listing.neighborhood.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const listingAreaRaw = listing.neighborhood.toLowerCase();
    const isPreferred = preferredNeighborhoods.some(
      (n: string) => {
        const normN = n.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return listingArea.includes(normN) || normN.includes(listingArea)
          || listingAreaRaw.includes(n.toLowerCase()) || n.toLowerCase().includes(listingAreaRaw);
      }
    );
    if (isPreferred) {
      breakdown.location = 25;
    } else if (listing.city && userCity && listing.city.toLowerCase() === userCity.toLowerCase()) {
      breakdown.location = 12;
    } else {
      breakdown.location = 4;
    }
  } else if (userNeighborhood && listing.neighborhood) {
    const match = listing.neighborhood.toLowerCase().includes(userNeighborhood.toLowerCase());
    breakdown.location = match ? 25 : 10;
  } else if (userCity && listing.city) {
    breakdown.location = listing.city.toLowerCase() === userCity.toLowerCase() ? 15 : 5;
  } else {
    breakdown.location = 12;
  }

  const userAmenities =
    (user as any).amenityPreferences ||
    (user as any).amenity_preferences ||
    (user as any).profileData?.preferences?.amenities ||
    [];
  const userNiceToHaves =
    (user as any).niceToHaveAmenities ||
    (user as any).nice_to_have_amenities ||
    [];
  if (userAmenities.length > 0 && listing.amenities.length > 0) {
    const listingAmenityIds = listing.amenities.map((a: string) => normalizeLegacyAmenity(a));
    const matchCount = userAmenities.filter((pref: string) => {
      const prefId = normalizeLegacyAmenity(pref);
      return listingAmenityIds.includes(prefId);
    }).length;
    const matchPercent = matchCount / userAmenities.length;
    breakdown.amenities = Math.round(matchPercent * 20);

    if (userNiceToHaves.length > 0) {
      const niceMatchCount = userNiceToHaves.filter((pref: string) => {
        const prefId = normalizeLegacyAmenity(pref);
        return listingAmenityIds.includes(prefId);
      }).length;
      const niceBonus = Math.round((niceMatchCount / userNiceToHaves.length) * 5);
      breakdown.amenities = Math.min(20, breakdown.amenities + niceBonus);
    }
  } else {
    breakdown.amenities = 10;
  }

  if (listing.averageRating && listing.reviewCount && listing.reviewCount >= 3) {
    if (listing.averageRating >= 4.8) breakdown.quality += 6;
    else if (listing.averageRating >= 4.5) breakdown.quality += 5;
    else if (listing.averageRating >= 4.0) breakdown.quality += 3;
    else breakdown.quality += 1;
  } else {
    breakdown.quality += 2;
  }

  if (listing.hostBadge) breakdown.quality += 4;

  if (listing.hostResponseRate) {
    if (listing.hostResponseRate >= 90) breakdown.quality += 3;
    else if (listing.hostResponseRate >= 75) breakdown.quality += 2;
    else breakdown.quality += 1;
  }

  if (listing.photoCount) {
    if (listing.photoCount >= 5) breakdown.quality += 2;
    else if (listing.photoCount >= 3) breakdown.quality += 1;
  }

  if (listing.daysListed !== undefined) {
    if (listing.daysListed <= 3) breakdown.freshness = 10;
    else if (listing.daysListed <= 7) breakdown.freshness = 8;
    else if (listing.daysListed <= 14) breakdown.freshness = 6;
    else if (listing.daysListed <= 30) breakdown.freshness = 4;
    else if (listing.daysListed <= 60) breakdown.freshness = 2;
    else breakdown.freshness = 1;
  } else {
    breakdown.freshness = 5;
  }

  breakdown.total = Math.min(100,
    breakdown.budget +
    breakdown.location +
    breakdown.amenities +
    breakdown.quality +
    breakdown.freshness
  );

  return breakdown;
}
