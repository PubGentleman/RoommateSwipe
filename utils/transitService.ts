import Constants from 'expo-constants';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface TransitStop {
  name: string;
  type: 'subway' | 'bus' | 'train' | 'tram' | 'ferry' | 'other';
  distanceMiles: number;
}

export async function geocodeAddress(
  address: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_API_KEY) return null;

  const fullAddress = encodeURIComponent(`${address}, ${city}, ${state}`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${fullAddress}&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

export async function fetchNearbyTransit(
  lat: number,
  lng: number
): Promise<TransitStop[]> {
  if (!GOOGLE_API_KEY) return [];

  const radius = 800;
  const types = ['subway_station', 'bus_station', 'train_station', 'transit_station'];
  const stops: TransitStop[] = [];
  const seen = new Set<string>();

  for (const type of types) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK') {
        for (const place of data.results.slice(0, 3)) {
          if (seen.has(place.place_id)) continue;
          seen.add(place.place_id);

          const placeLat = place.geometry.location.lat;
          const placeLng = place.geometry.location.lng;
          const distanceMiles = haversineDistance(lat, lng, placeLat, placeLng);

          stops.push({
            name: place.name,
            type: mapPlaceTypeToTransitType(type),
            distanceMiles: Math.round(distanceMiles * 10) / 10,
          });
        }
      }
    } catch {
    }
  }

  return stops.sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, 5);
}

function mapPlaceTypeToTransitType(type: string): TransitStop['type'] {
  switch (type) {
    case 'subway_station':
      return 'subway';
    case 'bus_station':
      return 'bus';
    case 'train_station':
      return 'train';
    case 'transit_station':
      return 'other';
    default:
      return 'other';
  }
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
