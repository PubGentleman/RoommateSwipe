export interface Neighborhood {
  id: string;
  label: string;
  borough?: string;
}

const NYC_NEIGHBORHOODS: Neighborhood[] = [
  { id: 'east_village', label: 'East Village', borough: 'Manhattan' },
  { id: 'west_village', label: 'West Village', borough: 'Manhattan' },
  { id: 'lower_east_side', label: 'Lower East Side', borough: 'Manhattan' },
  { id: 'chelsea', label: 'Chelsea', borough: 'Manhattan' },
  { id: 'hells_kitchen', label: "Hell's Kitchen", borough: 'Manhattan' },
  { id: 'upper_east_side', label: 'Upper East Side', borough: 'Manhattan' },
  { id: 'upper_west_side', label: 'Upper West Side', borough: 'Manhattan' },
  { id: 'harlem', label: 'Harlem', borough: 'Manhattan' },
  { id: 'washington_heights', label: 'Washington Heights', borough: 'Manhattan' },
  { id: 'midtown', label: 'Midtown', borough: 'Manhattan' },
  { id: 'soho', label: 'SoHo', borough: 'Manhattan' },
  { id: 'tribeca', label: 'Tribeca', borough: 'Manhattan' },
  { id: 'murray_hill', label: 'Murray Hill', borough: 'Manhattan' },
  { id: 'williamsburg', label: 'Williamsburg', borough: 'Brooklyn' },
  { id: 'bushwick', label: 'Bushwick', borough: 'Brooklyn' },
  { id: 'bed_stuy', label: 'Bed-Stuy', borough: 'Brooklyn' },
  { id: 'park_slope', label: 'Park Slope', borough: 'Brooklyn' },
  { id: 'crown_heights', label: 'Crown Heights', borough: 'Brooklyn' },
  { id: 'greenpoint', label: 'Greenpoint', borough: 'Brooklyn' },
  { id: 'downtown_brooklyn', label: 'Downtown Brooklyn', borough: 'Brooklyn' },
  { id: 'prospect_heights', label: 'Prospect Heights', borough: 'Brooklyn' },
  { id: 'flatbush', label: 'Flatbush', borough: 'Brooklyn' },
  { id: 'sunset_park', label: 'Sunset Park', borough: 'Brooklyn' },
  { id: 'astoria', label: 'Astoria', borough: 'Queens' },
  { id: 'long_island_city', label: 'Long Island City', borough: 'Queens' },
  { id: 'jackson_heights', label: 'Jackson Heights', borough: 'Queens' },
  { id: 'flushing', label: 'Flushing', borough: 'Queens' },
  { id: 'sunnyside', label: 'Sunnyside', borough: 'Queens' },
  { id: 'south_bronx', label: 'South Bronx', borough: 'Bronx' },
  { id: 'fordham', label: 'Fordham', borough: 'Bronx' },
  { id: 'jersey_city', label: 'Jersey City', borough: 'NJ' },
  { id: 'hoboken', label: 'Hoboken', borough: 'NJ' },
];

const CITY_NEIGHBORHOODS: Record<string, Neighborhood[]> = {
  'new york': NYC_NEIGHBORHOODS,
  'nyc': NYC_NEIGHBORHOODS,
  'new york city': NYC_NEIGHBORHOODS,
};

export function getNeighborhoodsForCity(city?: string): Neighborhood[] {
  if (!city) return [];
  const key = city.toLowerCase().trim();

  for (const [cityKey, neighborhoods] of Object.entries(CITY_NEIGHBORHOODS)) {
    if (key.includes(cityKey) || cityKey.includes(key)) {
      return neighborhoods;
    }
  }

  return [];
}

export function getNeighborhoodsByBorough(city?: string): Map<string, Neighborhood[]> {
  const neighborhoods = getNeighborhoodsForCity(city);
  const grouped = new Map<string, Neighborhood[]>();

  neighborhoods.forEach(n => {
    const borough = n.borough || 'Other';
    const list = grouped.get(borough) || [];
    list.push(n);
    grouped.set(borough, list);
  });

  return grouped;
}
