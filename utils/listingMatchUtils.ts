import { getNeighborhoodDistance, getZipCodeDistance } from './locationData';

export function calculateListingLocationScore(
  renterNeighborhoods: string[],
  renterZipCode: string | undefined,
  listingNeighborhood: string,
  listingZipCode: string | undefined,
): { score: number; reason: string } {
  if (renterNeighborhoods.includes(listingNeighborhood)) {
    return { score: 100, reason: `Wants ${listingNeighborhood}` };
  }

  const distances = renterNeighborhoods
    .map(n => ({
      neighborhood: n,
      distance: getNeighborhoodDistance(n, listingNeighborhood),
    }))
    .filter(d => d.distance !== null)
    .sort((a, b) => a.distance! - b.distance!);

  if (distances.length > 0) {
    const closest = distances[0];
    if (closest.distance! <= 1) return { score: 90, reason: `Near ${closest.neighborhood}` };
    if (closest.distance! <= 3) return { score: 75, reason: `${closest.distance!.toFixed(1)}mi from ${closest.neighborhood}` };
    if (closest.distance! <= 5) return { score: 50, reason: `${closest.distance!.toFixed(0)}mi from preferred area` };
    if (closest.distance! <= 10) return { score: 25, reason: `${closest.distance!.toFixed(0)}mi from preferred area` };
  }

  if (renterZipCode && listingZipCode) {
    const zipDist = getZipCodeDistance(renterZipCode, listingZipCode);
    if (zipDist !== null) {
      if (zipDist <= 3) return { score: 70, reason: `Close by zip code` };
      if (zipDist <= 5) return { score: 50, reason: `Within 5 miles` };
      if (zipDist <= 10) return { score: 25, reason: `Within 10 miles` };
    }
  }

  return { score: 0, reason: `Outside preferred area` };
}
