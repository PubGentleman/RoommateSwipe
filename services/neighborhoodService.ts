const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface NearbyAmenity {
  name: string;
  type: string;
  category: 'transit' | 'restaurant' | 'grocery' | 'laundry' | 'park';
  lat: number;
  lng: number;
  distanceKm: number;
  distanceMi: number;
}

export interface AreaInfo {
  transit: NearbyAmenity[];
  restaurants: NearbyAmenity[];
  grocery: NearbyAmenity[];
  laundry: NearbyAmenity[];
  parks: NearbyAmenity[];
  fetchedAt: string;
}

const areaInfoCache = new Map<string, AreaInfo>();

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

function categorizeElement(tags: Record<string, string>): NearbyAmenity['category'] | null {
  const amenity = tags.amenity || '';
  const shop = tags.shop || '';
  const leisure = tags.leisure || '';

  if (amenity === 'subway_entrance' || amenity === 'bus_stop') return 'transit';
  if (amenity === 'restaurant' || amenity === 'cafe') return 'restaurant';
  if (amenity === 'supermarket' || shop === 'supermarket') return 'grocery';
  if (amenity === 'laundry' || shop === 'laundry') return 'laundry';
  if (leisure === 'park') return 'park';
  return null;
}

function getTypeName(tags: Record<string, string>): string {
  if (tags.amenity === 'subway_entrance') return 'Subway';
  if (tags.amenity === 'bus_stop') return 'Bus Stop';
  if (tags.amenity === 'restaurant') return 'Restaurant';
  if (tags.amenity === 'cafe') return 'Cafe';
  if (tags.amenity === 'supermarket' || tags.shop === 'supermarket') return 'Supermarket';
  if (tags.amenity === 'laundry' || tags.shop === 'laundry') return 'Laundromat';
  if (tags.leisure === 'park') return 'Park';
  return 'Other';
}

export async function fetchAreaInfo(lat: number, lng: number): Promise<AreaInfo | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = areaInfoCache.get(cacheKey);
  if (cached) return cached;

  const query = `[out:json][timeout:10];
(
  node["amenity"="subway_entrance"](around:500,${lat},${lng});
  node["amenity"="bus_stop"](around:500,${lat},${lng});
  node["amenity"="restaurant"](around:500,${lat},${lng});
  node["amenity"="cafe"](around:500,${lat},${lng});
  node["amenity"="supermarket"](around:500,${lat},${lng});
  node["shop"="supermarket"](around:500,${lat},${lng});
  node["amenity"="laundry"](around:500,${lat},${lng});
  node["shop"="laundry"](around:500,${lat},${lng});
  node["leisure"="park"](around:500,${lat},${lng});
);
out body;`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const elements: any[] = data.elements || [];

    const result: AreaInfo = {
      transit: [],
      restaurants: [],
      grocery: [],
      laundry: [],
      parks: [],
      fetchedAt: new Date().toISOString(),
    };

    for (const el of elements) {
      if (!el.tags || !el.lat || !el.lon) continue;
      const category = categorizeElement(el.tags);
      if (!category) continue;

      const distKm = haversineDistance(lat, lng, el.lat, el.lon);
      const amenity: NearbyAmenity = {
        name: el.tags.name || getTypeName(el.tags),
        type: getTypeName(el.tags),
        category,
        lat: el.lat,
        lng: el.lon,
        distanceKm: distKm,
        distanceMi: parseFloat(kmToMiles(distKm).toFixed(2)),
      };

      switch (category) {
        case 'transit': result.transit.push(amenity); break;
        case 'restaurant': result.restaurants.push(amenity); break;
        case 'grocery': result.grocery.push(amenity); break;
        case 'laundry': result.laundry.push(amenity); break;
        case 'park': result.parks.push(amenity); break;
      }
    }

    result.transit.sort((a, b) => a.distanceKm - b.distanceKm);
    result.restaurants.sort((a, b) => a.distanceKm - b.distanceKm);
    result.grocery.sort((a, b) => a.distanceKm - b.distanceKm);
    result.laundry.sort((a, b) => a.distanceKm - b.distanceKm);
    result.parks.sort((a, b) => a.distanceKm - b.distanceKm);

    areaInfoCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export function formatNearestAmenity(amenities: NearbyAmenity[]): string {
  if (amenities.length === 0) return 'None found nearby';
  const nearest = amenities[0];
  return `${nearest.name} (${nearest.distanceMi} mi)`;
}
