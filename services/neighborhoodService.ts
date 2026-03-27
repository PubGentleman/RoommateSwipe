const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface NearbyAmenity {
  name: string;
  type: string;
  category: 'transit' | 'restaurant' | 'grocery' | 'laundry' | 'park';
  lat: number;
  lng: number;
  distanceKm: number;
  distanceMi: number;
  photoUrl?: string;
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
  const railway = tags.railway || '';
  const highway = tags.highway || '';
  const publicTransport = tags.public_transport || '';

  if (
    amenity === 'subway_entrance' ||
    amenity === 'bus_stop' ||
    railway === 'subway_entrance' ||
    railway === 'station' ||
    railway === 'halt' ||
    highway === 'bus_stop' ||
    (publicTransport === 'stop_position' && railway)
  ) return 'transit';

  if (amenity === 'restaurant' || amenity === 'cafe') return 'restaurant';
  if (amenity === 'supermarket' || shop === 'supermarket') return 'grocery';
  if (amenity === 'laundry' || shop === 'laundry') return 'laundry';
  if (leisure === 'park') return 'park';
  return null;
}

function getTypeName(tags: Record<string, string>): string {
  if (tags.amenity === 'subway_entrance' || tags.railway === 'subway_entrance') return 'Subway';
  if (tags.railway === 'station' || tags.railway === 'halt') return 'Train Station';
  if (tags.amenity === 'bus_stop' || tags.highway === 'bus_stop') return 'Bus Stop';
  if (tags.amenity === 'restaurant') return 'Restaurant';
  if (tags.amenity === 'cafe') return 'Cafe';
  if (tags.amenity === 'supermarket' || tags.shop === 'supermarket') return 'Supermarket';
  if (tags.amenity === 'laundry' || tags.shop === 'laundry') return 'Laundromat';
  if (tags.leisure === 'park') return 'Park';
  return 'Other';
}

export async function fetchAreaInfo(lat: number, lng: number): Promise<AreaInfo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = areaInfoCache.get(cacheKey);
  if (cached) return cached;

  const latStr = lat.toFixed(6);
  const lngStr = lng.toFixed(6);

  const query = `[out:json][timeout:15];(
  node["amenity"="subway_entrance"](around:600,${latStr},${lngStr});
  node["railway"="subway_entrance"](around:600,${latStr},${lngStr});
  node["railway"="station"](around:600,${latStr},${lngStr});
  node["railway"="halt"](around:600,${latStr},${lngStr});
  node["public_transport"="stop_position"]["railway"](around:600,${latStr},${lngStr});
  node["amenity"="bus_stop"](around:600,${latStr},${lngStr});
  node["highway"="bus_stop"](around:600,${latStr},${lngStr});
  node["amenity"="restaurant"](around:500,${latStr},${lngStr});
  node["amenity"="cafe"](around:500,${latStr},${lngStr});
  node["amenity"="supermarket"](around:500,${latStr},${lngStr});
  node["shop"="supermarket"](around:500,${latStr},${lngStr});
  node["amenity"="laundry"](around:500,${latStr},${lngStr});
  node["shop"="laundry"](around:500,${latStr},${lngStr});
  node["leisure"="park"](around:500,${latStr},${lngStr});
);out body;`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    let data: any;
    try {
      const text = await response.text();
      data = JSON.parse(text);
    } catch {
      return null;
    }

    const elements: any[] = data?.elements || [];

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

    const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (GOOGLE_KEY && result.restaurants.length > 0) {
      try {
        const enriched = await Promise.all(
          result.restaurants.slice(0, 10).map(async (place) => {
            try {
              const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${place.lat},${place.lng}&radius=50&keyword=${encodeURIComponent(place.name)}&key=${GOOGLE_KEY}`;
              const res = await fetch(searchUrl);
              const data = await res.json();
              const photoRef = data?.results?.[0]?.photos?.[0]?.photo_reference;
              if (photoRef) {
                return {
                  ...place,
                  photoUrl: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=100&photoreference=${photoRef}&key=${GOOGLE_KEY}`,
                };
              }
            } catch {}
            return place;
          })
        );
        result.restaurants = enriched;
      } catch {}
    }

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
