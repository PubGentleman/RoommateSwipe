export interface TransitStop {
  name: string;
  type: 'subway' | 'bus' | 'train' | 'tram' | 'ferry' | 'other';
  distanceMiles: number;
}

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  const radius = 800;
  const stops: TransitStop[] = [];
  const seen = new Set<string>();

  try {
    const query = `
      [out:json][timeout:10];
      (
        node["railway"="station"](around:${radius},${lat},${lng});
        node["railway"="subway_entrance"](around:${radius},${lat},${lng});
        node["railway"="halt"](around:${radius},${lat},${lng});
        node["public_transport"="station"](around:${radius},${lat},${lng});
        node["public_transport"="stop_position"]["subway"="yes"](around:${radius},${lat},${lng});
        node["highway"="bus_stop"](around:${radius},${lat},${lng});
        node["amenity"="bus_station"](around:${radius},${lat},${lng});
        node["railway"="tram_stop"](around:${radius},${lat},${lng});
        node["amenity"="ferry_terminal"](around:${radius},${lat},${lng});
      );
      out body;
    `;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn('Overpass API error:', res.status);
      return [];
    }

    const data = await res.json();

    for (const element of data.elements || []) {
      const name = element.tags?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const type = mapOsmTagsToTransitType(element.tags);
      const distanceMiles = haversineDistance(lat, lng, element.lat, element.lon);

      stops.push({
        name,
        type,
        distanceMiles: Math.round(distanceMiles * 10) / 10,
      });
    }
  } catch (err) {
    console.warn('Transit fetch failed:', err);
  }

  return stops.sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, 5);
}

function mapOsmTagsToTransitType(tags: Record<string, string>): TransitStop['type'] {
  if (tags.railway === 'station' || tags.railway === 'subway_entrance' || tags.station === 'subway') return 'subway';
  if (tags.railway === 'tram_stop') return 'tram';
  if (tags.railway === 'halt' || tags.station === 'light_rail') return 'train';
  if (tags.amenity === 'ferry_terminal') return 'ferry';
  if (tags.highway === 'bus_stop' || tags.amenity === 'bus_station') return 'bus';
  if (tags.public_transport === 'station') {
    if (tags.subway === 'yes' || tags.station === 'subway') return 'subway';
    if (tags.train === 'yes') return 'train';
    return 'other';
  }
  return 'other';
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
