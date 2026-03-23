import { RoommateProfile, ApartmentPreferences, Property } from '../types/models';
import { calculateCompatibility } from './matchingAlgorithm';
import {
  findCompatibleNeighborhoods,
  hasReasonableTransfer,
  NEIGHBORHOOD_TRAINS,
} from '../constants/transitData';

export interface GroupCompatibilityResult {
  total: number;
  breakdown: {
    lifestyle: number;
    budget: number;
    transit: number;
    moveIn: number;
    amenities: number;
  };
  conflicts: string[];
  sharedNeighborhoods: string[];
}

export function calculateGroupCompatibilityScore(
  userA: RoommateProfile,
  userB: RoommateProfile
): GroupCompatibilityResult {
  const conflicts: string[] = [];
  const prefsA = userA.apartmentPrefs;
  const prefsB = userB.apartmentPrefs;

  const lifestyleScore = calculateCompatibility(
    { id: userA.id, name: userA.name } as any,
    userA
  );

  let budgetScore = 50;
  let transitScore = 50;
  let moveInScore = 100;
  let sharedNeighborhoods: string[] = [];

  if (prefsA && prefsB) {
    const budgetOverlapMin = Math.max(prefsA.budgetPerPersonMin, prefsB.budgetPerPersonMin);
    const budgetOverlapMax = Math.min(prefsA.budgetPerPersonMax, prefsB.budgetPerPersonMax);
    const budgetOverlaps = budgetOverlapMax >= budgetOverlapMin;

    if (budgetOverlaps) {
      const overlapRange = budgetOverlapMax - budgetOverlapMin;
      const totalRange = Math.max(prefsA.budgetPerPersonMax, prefsB.budgetPerPersonMax) -
                         Math.min(prefsA.budgetPerPersonMin, prefsB.budgetPerPersonMin);
      budgetScore = totalRange > 0
        ? Math.min(100, (overlapRange / totalRange) * 100 + 50)
        : 100;
    } else {
      budgetScore = 0;
      conflicts.push(
        `Budget mismatch: $${prefsA.budgetPerPersonMin}-$${prefsA.budgetPerPersonMax} vs $${prefsB.budgetPerPersonMin}-$${prefsB.budgetPerPersonMax}`
      );
    }

    if (prefsA.locationFlexible || prefsB.locationFlexible || prefsA.wfh || prefsB.wfh) {
      transitScore = 90;
    } else if (prefsA.preferredTrains.length > 0 && prefsB.preferredTrains.length > 0) {
      const allTrains = [...new Set([...prefsA.preferredTrains, ...prefsB.preferredTrains])];
      sharedNeighborhoods = findCompatibleNeighborhoods(allTrains);

      if (sharedNeighborhoods.length >= 3) transitScore = 100;
      else if (sharedNeighborhoods.length === 2) transitScore = 80;
      else if (sharedNeighborhoods.length === 1) transitScore = 60;
      else {
        transitScore = 0;
        conflicts.push(
          `No neighborhood works for both commutes: ${prefsA.preferredTrains.join('/')} vs ${prefsB.preferredTrains.join('/')}`
        );
      }
    }

    if (prefsA.moveInDate && prefsB.moveInDate) {
      const dateA = new Date(prefsA.moveInDate);
      const dateB = new Date(prefsB.moveInDate);
      const diffDays = Math.abs((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 14) moveInScore = 100;
      else if (diffDays <= 30) moveInScore = 80;
      else if (diffDays <= 60) moveInScore = 50;
      else {
        moveInScore = 0;
        conflicts.push(`Move-in dates are ${Math.round(diffDays)} days apart`);
      }
    }
  }

  const sharedAmenities = (prefsA?.amenityMustHaves ?? []).filter(a =>
    (prefsB?.amenityMustHaves ?? []).includes(a)
  );
  const amenityScore = sharedAmenities.length > 0
    ? Math.min(100, sharedAmenities.length * 25)
    : 50;

  const total = Math.round(
    lifestyleScore * 0.35 +
    budgetScore    * 0.30 +
    transitScore   * 0.25 +
    moveInScore    * 0.10
  );

  return {
    total,
    breakdown: {
      lifestyle: Math.round(lifestyleScore),
      budget:    Math.round(budgetScore),
      transit:   Math.round(transitScore),
      moveIn:    Math.round(moveInScore),
      amenities: Math.round(amenityScore),
    },
    conflicts,
    sharedNeighborhoods,
  };
}

function getPairs<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

export interface GroupConflictResult {
  hasConflicts: boolean;
  conflicts: string[];
  suggestions: string[];
  sharedNeighborhoods: string[];
}

export function detectGroupConflicts(
  members: RoommateProfile[]
): GroupConflictResult {
  const conflicts: string[] = [];
  const suggestions: string[] = [];
  const pairs = getPairs(members);
  let allSharedNeighborhoods: string[] = [];

  for (const [a, b] of pairs) {
    const result = calculateGroupCompatibilityScore(a, b);
    conflicts.push(...result.conflicts);

    if (allSharedNeighborhoods.length === 0) {
      allSharedNeighborhoods = result.sharedNeighborhoods;
    } else {
      allSharedNeighborhoods = allSharedNeighborhoods.filter(n =>
        result.sharedNeighborhoods.includes(n)
      );
    }
  }

  const desiredBedrooms = members[0]?.apartmentPrefs?.desiredBedrooms ?? 2;
  if (members.length > desiredBedrooms) {
    conflicts.push(
      `Group has ${members.length} people but you're looking for a ${desiredBedrooms}BR`
    );
    suggestions.push(
      `Remove ${members.length - desiredBedrooms} member(s) or switch to a ${members.length}BR search`
    );
  }

  const budgetConflicts = conflicts.filter(c => c.includes('Budget'));
  if (budgetConflicts.length > 0) {
    const budgets = members.map(m =>
      `${m.name}: $${m.apartmentPrefs?.budgetPerPersonMin ?? 0}-$${m.apartmentPrefs?.budgetPerPersonMax ?? 0}`
    ).join(', ');
    suggestions.push(`Budgets don't fully overlap: ${budgets}. Consider finding someone in the same range.`);
  }

  if (allSharedNeighborhoods.length === 0) {
    for (const member of members) {
      const otherTrains = [...new Set(
        members
          .filter(m => m.id !== member.id)
          .flatMap(m => m.apartmentPrefs?.preferredTrains ?? [])
      )];
      const compromise = findCompatibleNeighborhoods(otherTrains);
      if (compromise.length > 0) {
        suggestions.push(
          `If ${member.name.split(' ')[0]} is flexible on their commute, ${compromise.slice(0, 3).join(', ')} could work for everyone else`
        );
        break;
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts: [...new Set(conflicts)],
    suggestions,
    sharedNeighborhoods: allSharedNeighborhoods,
  };
}

export interface ListingSuggestion {
  listing: Property;
  totalScore: number;
  perPersonRent: number;
  trainsNearby: string[];
  breakdown: {
    trainScore: number;
    amenityScore: number;
    budgetScore: number;
  };
  aiReason: string;
}

export function scoreListing(
  listing: Property,
  members: RoommateProfile[]
): ListingSuggestion | null {
  const allTrains = [...new Set(members.flatMap(m => m.apartmentPrefs?.preferredTrains ?? []))];
  const sharedAmenities = members.length > 0
    ? (members[0].apartmentPrefs?.amenityMustHaves ?? []).filter(a =>
        members.every(m => (m.apartmentPrefs?.amenityMustHaves ?? []).includes(a))
      )
    : [];

  const combinedBudgetMin = members.reduce(
    (sum, m) => sum + (m.apartmentPrefs?.budgetPerPersonMin ?? 0), 0
  );
  const combinedBudgetMax = members.reduce(
    (sum, m) => sum + (m.apartmentPrefs?.budgetPerPersonMax ?? 0), 0
  );

  const trainScore = scoreListingTransit(listing, allTrains);
  const amenityScore = scoreListingAmenities(listing, sharedAmenities);
  const budgetScore = scoreListingBudget(listing, combinedBudgetMin, combinedBudgetMax);

  const totalScore = Math.round(
    trainScore  * 0.40 +
    budgetScore * 0.35 +
    amenityScore * 0.25
  );

  const perPersonRent = members.length > 0
    ? Math.round((listing.price ?? 0) / members.length)
    : listing.price ?? 0;
  const trainsNearby = NEIGHBORHOOD_TRAINS[listing.neighborhood ?? ''] ?? [];
  const memberNames = members.map(m => m.name.split(' ')[0]).join(' and ');

  let aiReason: string;
  if (trainScore >= 90 && budgetScore >= 90) {
    aiReason = `Perfect commute and budget fit for ${memberNames}. ${trainsNearby.join('/')} trains right in the neighborhood.`;
  } else if (trainScore >= 90) {
    aiReason = `Great transit access with ${trainsNearby.join('/')} trains nearby. Budget is tight but workable at $${perPersonRent}/person.`;
  } else if (budgetScore >= 90) {
    aiReason = `Strong value at $${perPersonRent}/person. ${trainsNearby[0] ?? ''} train is nearby; check the commute time.`;
  } else {
    aiReason = `Solid option in ${listing.neighborhood ?? listing.location?.city ?? 'this area'}. Check if the commute works for everyone.`;
  }

  return {
    listing,
    totalScore,
    perPersonRent,
    trainsNearby,
    breakdown: { trainScore, amenityScore, budgetScore },
    aiReason,
  };
}

function scoreListingTransit(listing: Property, requiredTrains: string[]): number {
  if (requiredTrains.length === 0) return 70;
  const nearbyTrains = NEIGHBORHOOD_TRAINS[listing.neighborhood ?? ''] ?? [];
  const directMatches = requiredTrains.filter(t => nearbyTrains.includes(t));
  return Math.min(100, (directMatches.length / requiredTrains.length) * 100);
}

function scoreListingBudget(
  listing: Property,
  combinedMin: number,
  combinedMax: number
): number {
  const price = listing.price ?? 0;
  if (combinedMax === 0) return 50;
  if (price < combinedMin) return 60;
  if (price > combinedMax) return 0;
  const range = combinedMax - combinedMin;
  if (range === 0) return 80;
  const position = (combinedMax - price) / range;
  return Math.round(60 + position * 40);
}

function scoreListingAmenities(listing: Property, mustHaves: string[]): number {
  if (mustHaves.length === 0) return 70;
  const listingAmenities = listing.amenities ?? [];
  const matched = mustHaves.filter(a =>
    listingAmenities.some(la => la.toLowerCase().includes(a.toLowerCase()))
  );
  return Math.round((matched.length / mustHaves.length) * 100);
}

export interface TransitFilterSummary {
  total: number;
  afterTransit: number;
  afterBudget: number;
  afterBedrooms: number;
  afterDate: number;
}

export function filterRentersForListing(
  allRenters: RoommateProfile[],
  listing: Property
): { filtered: RoommateProfile[]; summary: TransitFilterSummary } {
  const listingNeighborhood = listing.neighborhood ?? '';
  const listingTrains = NEIGHBORHOOD_TRAINS[listingNeighborhood] ?? [];
  const bedrooms = listing.bedrooms ?? 1;
  const rent = listing.price ?? 0;
  const sharePerPerson = bedrooms > 0 ? rent / bedrooms : rent;

  const transitCompatible = allRenters.filter(renter => {
    const prefs = renter.apartmentPrefs;
    if (!prefs || !prefs.apartmentPrefsComplete) return true;
    if (prefs.locationFlexible || prefs.wfh) return true;
    return (prefs.preferredTrains ?? []).some(
      (train: string) =>
        listingTrains.includes(train) || hasReasonableTransfer(train, listingTrains)
    );
  });

  const budgetCompatible = transitCompatible.filter(renter => {
    if (!renter.apartmentPrefs?.apartmentPrefsComplete) return true;
    const maxBudget = renter.apartmentPrefs?.budgetPerPersonMax ?? 0;
    return maxBudget >= sharePerPerson;
  });

  const bedroomCompatible = budgetCompatible.filter(renter => {
    const desired = renter.apartmentPrefs?.desiredBedrooms;
    if (!desired) return true;
    return desired === bedrooms;
  });

  const dateCompatible = bedroomCompatible.filter(renter => {
    const moveIn = renter.apartmentPrefs?.moveInDate;
    const available = listing.availableDate;
    if (!moveIn || !available) return true;
    const moveInDate = new Date(moveIn);
    const availableDate = new Date(available);
    const diffDays = Math.abs(
      (moveInDate.getTime() - availableDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays <= 30;
  });

  return {
    filtered: dateCompatible,
    summary: {
      total: allRenters.length,
      afterTransit: transitCompatible.length,
      afterBudget: budgetCompatible.length,
      afterBedrooms: bedroomCompatible.length,
      afterDate: dateCompatible.length,
    },
  };
}
