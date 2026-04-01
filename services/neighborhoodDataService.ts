import { supabase } from '../lib/supabase';

export interface NeighborhoodData {
  id: string;
  neighborhood: string;
  borough: string;
  safety_score: number | null;
  total_incidents_yearly: number | null;
  violent_crime_count: number | null;
  property_crime_count: number | null;
  crime_trend: string | null;
  crime_trend_percent: number | null;
  safety_summary: string | null;
  safety_tips: string | null;
  comparison_to_borough_avg: number | null;
  nearby_subway_lines: string[] | null;
  subway_stations: string[] | null;
  avg_commute_midtown_min: number | null;
  avg_commute_downtown_min: number | null;
  bus_lines: string[] | null;
  transit_score: number | null;
  transit_summary: string | null;
  grocery_stores: string[] | null;
  parks: string[] | null;
  gyms: string[] | null;
  nightlife_rating: number | null;
  restaurant_density: string | null;
  coffee_shops: number | null;
  laundromats: number | null;
  amenity_summary: string | null;
  vibe_tags: string[] | null;
  avg_age_range: string | null;
  median_rent_1br: number | null;
  median_rent_2br: number | null;
  median_rent_3br: number | null;
  walkability_score: number | null;
  noise_level: string | null;
  vibe_summary: string | null;
}

export interface NeighborhoodScores {
  safety: number | null;
  transit: number | null;
  walkability: number | null;
  nightlife: number | null;
}

const cache = new Map<string, NeighborhoodData>();

export async function getNeighborhoodData(neighborhoodName: string): Promise<NeighborhoodData | null> {
  const cacheKey = neighborhoodName.toLowerCase().trim();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const { data, error } = await supabase
      .from('neighborhood_data')
      .select('*')
      .ilike('neighborhood', neighborhoodName.trim())
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    cache.set(cacheKey, data as NeighborhoodData);
    return data as NeighborhoodData;
  } catch {
    return null;
  }
}

export async function getNeighborhoodScores(neighborhoodName: string): Promise<NeighborhoodScores | null> {
  const data = await getNeighborhoodData(neighborhoodName);
  if (!data) return null;

  return {
    safety: data.safety_score,
    transit: data.transit_score,
    walkability: data.walkability_score,
    nightlife: data.nightlife_rating ? data.nightlife_rating * 20 : null,
  };
}

export async function getNeighborhoodsByBorough(borough: string): Promise<NeighborhoodData[]> {
  try {
    const { data, error } = await supabase
      .from('neighborhood_data')
      .select('*')
      .ilike('borough', borough.trim())
      .order('neighborhood');

    if (error || !data) return [];
    return data as NeighborhoodData[];
  } catch {
    return [];
  }
}

export async function getNeighborhoodComparison(names: string[]): Promise<NeighborhoodData[]> {
  const results: NeighborhoodData[] = [];
  for (const name of names.slice(0, 4)) {
    const data = await getNeighborhoodData(name);
    if (data) results.push(data);
  }
  return results;
}

export function getScoreColor(score: number | null): string {
  if (score === null) return '#666';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

export function getScoreLabel(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Below Average';
}

export function clearNeighborhoodCache() {
  cache.clear();
}
