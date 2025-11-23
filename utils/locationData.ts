export interface Neighborhood {
  name: string;
  city: string;
  borough?: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  nearbyNeighborhoods?: string[];
}

export const NEIGHBORHOODS: Record<string, Neighborhood> = {
  'Williamsburg': {
    name: 'Williamsburg',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7081, lng: -73.9571 },
    nearbyNeighborhoods: ['Greenpoint', 'Bushwick', 'East Williamsburg'],
  },
  'Bushwick': {
    name: 'Bushwick',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6942, lng: -73.9196 },
    nearbyNeighborhoods: ['East Williamsburg', 'Williamsburg', 'Bedford-Stuyvesant'],
  },
  'Park Slope': {
    name: 'Park Slope',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6710, lng: -73.9778 },
    nearbyNeighborhoods: ['Gowanus', 'Prospect Heights', 'Carroll Gardens'],
  },
  'DUMBO': {
    name: 'DUMBO',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7033, lng: -73.9888 },
    nearbyNeighborhoods: ['Brooklyn Heights', 'Vinegar Hill', 'Downtown Brooklyn'],
  },
  'Brooklyn Heights': {
    name: 'Brooklyn Heights',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6958, lng: -73.9936 },
    nearbyNeighborhoods: ['DUMBO', 'Downtown Brooklyn', 'Cobble Hill'],
  },
  'Bedford-Stuyvesant': {
    name: 'Bedford-Stuyvesant',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6872, lng: -73.9418 },
    nearbyNeighborhoods: ['Bushwick', 'Crown Heights', 'Clinton Hill'],
  },
  'Crown Heights': {
    name: 'Crown Heights',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6683, lng: -73.9420 },
    nearbyNeighborhoods: ['Bedford-Stuyvesant', 'Prospect Heights', 'Flatbush'],
  },
  'Greenpoint': {
    name: 'Greenpoint',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7304, lng: -73.9515 },
    nearbyNeighborhoods: ['Williamsburg', 'Long Island City'],
  },
  'East Williamsburg': {
    name: 'East Williamsburg',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7135, lng: -73.9361 },
    nearbyNeighborhoods: ['Williamsburg', 'Bushwick', 'Greenpoint'],
  },
  'Upper East Side': {
    name: 'Upper East Side',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7736, lng: -73.9566 },
    nearbyNeighborhoods: ['Upper West Side', 'Midtown East', 'Yorkville'],
  },
  'Upper West Side': {
    name: 'Upper West Side',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7870, lng: -73.9754 },
    nearbyNeighborhoods: ['Upper East Side', 'Midtown West', 'Morningside Heights'],
  },
  'Chelsea': {
    name: 'Chelsea',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7465, lng: -74.0014 },
    nearbyNeighborhoods: ['Hell\'s Kitchen', 'Greenwich Village', 'Midtown West'],
  },
  'Greenwich Village': {
    name: 'Greenwich Village',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7336, lng: -74.0027 },
    nearbyNeighborhoods: ['Chelsea', 'SoHo', 'East Village', 'West Village'],
  },
  'East Village': {
    name: 'East Village',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7264, lng: -73.9818 },
    nearbyNeighborhoods: ['Greenwich Village', 'Lower East Side', 'Gramercy'],
  },
  'SoHo': {
    name: 'SoHo',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7233, lng: -74.0030 },
    nearbyNeighborhoods: ['Greenwich Village', 'TriBeCa', 'Little Italy', 'Nolita'],
  },
  'Tribeca': {
    name: 'Tribeca',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7163, lng: -74.0086 },
    nearbyNeighborhoods: ['SoHo', 'Financial District', 'Chinatown'],
  },
  'Financial District': {
    name: 'Financial District',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7074, lng: -74.0113 },
    nearbyNeighborhoods: ['Tribeca', 'Battery Park City'],
  },
  'Midtown': {
    name: 'Midtown',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7549, lng: -73.9840 },
    nearbyNeighborhoods: ['Hell\'s Kitchen', 'Chelsea', 'Murray Hill'],
  },
  'Hell\'s Kitchen': {
    name: 'Hell\'s Kitchen',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7638, lng: -73.9918 },
    nearbyNeighborhoods: ['Midtown', 'Chelsea', 'Upper West Side'],
  },
  'Long Island City': {
    name: 'Long Island City',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7447, lng: -73.9485 },
    nearbyNeighborhoods: ['Astoria', 'Greenpoint', 'Sunnyside'],
  },
  'Astoria': {
    name: 'Astoria',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7648, lng: -73.9232 },
    nearbyNeighborhoods: ['Long Island City', 'Woodside', 'Sunnyside'],
  },
  'Flushing': {
    name: 'Flushing',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7675, lng: -73.8330 },
    nearbyNeighborhoods: ['Murray Hill', 'Bayside', 'College Point'],
  },
  'Forest Hills': {
    name: 'Forest Hills',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7185, lng: -73.8448 },
    nearbyNeighborhoods: ['Rego Park', 'Kew Gardens', 'Jamaica'],
  },
  'Riverdale': {
    name: 'Riverdale',
    city: 'New York',
    borough: 'Bronx',
    state: 'NY',
    coordinates: { lat: 40.8908, lng: -73.9057 },
    nearbyNeighborhoods: ['Kingsbridge', 'Fieldston', 'Spuyten Duyvil'],
  },
  'Fordham': {
    name: 'Fordham',
    city: 'New York',
    borough: 'Bronx',
    state: 'NY',
    coordinates: { lat: 40.8622, lng: -73.8977 },
    nearbyNeighborhoods: ['Bedford Park', 'Belmont', 'University Heights'],
  },
  'White Plains': {
    name: 'White Plains',
    city: 'White Plains',
    borough: 'Westchester',
    state: 'NY',
    coordinates: { lat: 40.0310, lng: -73.7629 },
    nearbyNeighborhoods: ['Scarsdale', 'Harrison', 'Greenburgh'],
  },
  'Yonkers': {
    name: 'Yonkers',
    city: 'Yonkers',
    borough: 'Westchester',
    state: 'NY',
    coordinates: { lat: 40.9312, lng: -73.8987 },
    nearbyNeighborhoods: ['Riverdale', 'Mount Vernon', 'Hastings-on-Hudson'],
  },
};

export function getCityFromNeighborhood(neighborhood: string): string | null {
  const neighborhoodData = NEIGHBORHOODS[neighborhood];
  return neighborhoodData ? neighborhoodData.city : null;
}

export function getStateFromNeighborhood(neighborhood: string): string | null {
  const neighborhoodData = NEIGHBORHOODS[neighborhood];
  return neighborhoodData ? neighborhoodData.state : null;
}

export function getCoordinatesFromNeighborhood(neighborhood: string): { lat: number; lng: number } | null {
  const neighborhoodData = NEIGHBORHOODS[neighborhood];
  return neighborhoodData ? neighborhoodData.coordinates : null;
}

export function isNearbyNeighborhood(neighborhood1: string, neighborhood2: string): boolean {
  const n1Data = NEIGHBORHOODS[neighborhood1];
  const n2Data = NEIGHBORHOODS[neighborhood2];
  
  if (!n1Data || !n2Data) return false;
  
  return n1Data.nearbyNeighborhoods?.includes(neighborhood2) || false;
}

export function isSameCity(neighborhood1: string, neighborhood2: string): boolean {
  const city1 = getCityFromNeighborhood(neighborhood1);
  const city2 = getCityFromNeighborhood(neighborhood2);
  
  if (!city1 || !city2) return false;
  
  return city1 === city2;
}

export function getNeighborhoodsByCity(city: string): string[] {
  return Object.keys(NEIGHBORHOODS).filter(
    neighborhood => NEIGHBORHOODS[neighborhood].city === city
  );
}

export function getAllCities(): string[] {
  const cities = new Set<string>();
  Object.values(NEIGHBORHOODS).forEach(n => cities.add(n.city));
  return Array.from(cities).sort();
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}
