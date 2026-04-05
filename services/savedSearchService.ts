import { supabase } from '../lib/supabase';

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: SavedSearchFilters;
  notify_enabled: boolean;
  notify_frequency: 'instant' | 'daily' | 'weekly';
  last_checked_at: string;
  new_match_count: number;
  total_matches: number;
  created_at: string;
  updated_at: string;
}

export interface SavedSearchFilters {
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  amenities?: string[];
  availableFrom?: string;
  listingTypes?: string[];
  transitLines?: string[];
  maxWalkToTransit?: number;
  hostType?: string;
  verifiedOnly?: boolean;
  genderPreference?: string;
  hostLivesIn?: boolean;
  sortBy?: string;
  neighborhood?: string;
  subArea?: string;
  petFriendly?: boolean;
  noFee?: boolean;
  availableNow?: boolean;
}

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSavedSearch(
  userId: string,
  name: string,
  filters: SavedSearchFilters,
  notifyFrequency: 'instant' | 'daily' | 'weekly' = 'daily',
  notifyEnabled: boolean = true
): Promise<SavedSearch> {
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: userId,
      name,
      filters,
      notify_enabled: notifyEnabled,
      notify_frequency: notifyFrequency,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSavedSearch(
  searchId: string,
  updates: Partial<Pick<SavedSearch, 'name' | 'filters' | 'notify_enabled' | 'notify_frequency'>>
): Promise<SavedSearch> {
  const { data, error } = await supabase
    .from('saved_searches')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', searchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSavedSearch(searchId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', searchId);

  if (error) throw error;
}

export async function checkForNewMatches(
  searchId: string,
  filters: SavedSearchFilters
): Promise<{ newCount: number; newListingIds: string[] }> {
  let query = supabase
    .from('listings')
    .select('id, created_at')
    .eq('status', 'active');

  if (filters.city) query = query.eq('city', filters.city);
  if (filters.minPrice) query = query.gte('rent', filters.minPrice);
  if (filters.maxPrice) query = query.lte('rent', filters.maxPrice);
  if (filters.minBedrooms) query = query.gte('bedrooms', filters.minBedrooms);
  if (filters.minBathrooms) query = query.gte('bathrooms', filters.minBathrooms);
  if (filters.listingTypes && filters.listingTypes.length > 0) {
    query = query.in('listing_type', filters.listingTypes);
  }
  if (filters.neighborhood) query = query.eq('neighborhood', filters.neighborhood);
  if (filters.verifiedOnly) query = query.eq('is_verified', true);
  if (filters.petFriendly) query = query.contains('amenities', ['Pet Friendly']);
  if (filters.noFee) query = query.eq('no_fee', true);
  if (filters.amenities && filters.amenities.length > 0) {
    query = query.contains('amenities', filters.amenities);
  }

  const { data: allMatches, error: matchError } = await query;
  if (matchError) throw matchError;

  const allMatchIds = (allMatches || []).map((l: any) => l.id);

  const { data: seenData, error: seenError } = await supabase
    .from('saved_search_seen_listings')
    .select('listing_id')
    .eq('saved_search_id', searchId);

  if (seenError) console.error('Failed to load seen listings:', seenError);

  const seenIds = new Set((seenData || []).map((s: any) => s.listing_id));
  const newListingIds = allMatchIds.filter((id: string) => !seenIds.has(id));

  const { error: updateError } = await supabase
    .from('saved_searches')
    .update({
      new_match_count: newListingIds.length,
      total_matches: allMatchIds.length,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', searchId);

  if (updateError) console.error('Failed to update match counts:', updateError);

  return { newCount: newListingIds.length, newListingIds };
}

export async function markMatchesSeen(searchId: string, listingIds: string[]): Promise<void> {
  if (listingIds.length > 0) {
    const rows = listingIds.map(lid => ({
      saved_search_id: searchId,
      listing_id: lid,
    }));

    const { error: upsertError } = await supabase
      .from('saved_search_seen_listings')
      .upsert(rows, { onConflict: 'saved_search_id,listing_id' });

    if (upsertError) console.error('Failed to upsert seen listings:', upsertError);
  }

  const { error: updateError } = await supabase
    .from('saved_searches')
    .update({ new_match_count: 0 })
    .eq('id', searchId);

  if (updateError) console.error('Failed to reset new_match_count:', updateError);
}

export function generateSearchName(filters: SavedSearchFilters): string {
  const parts: string[] = [];

  if (filters.neighborhood) {
    parts.push(filters.neighborhood);
  } else if (filters.city) {
    parts.push(filters.city);
  }

  if (filters.minBedrooms) {
    parts.push(`${filters.minBedrooms}+ BR`);
  }

  if (filters.minPrice || filters.maxPrice) {
    if (filters.minPrice && filters.maxPrice) {
      parts.push(`$${filters.minPrice}-$${filters.maxPrice}`);
    } else if (filters.maxPrice) {
      parts.push(`Under $${filters.maxPrice}`);
    } else {
      parts.push(`$${filters.minPrice}+`);
    }
  }

  if (filters.listingTypes && filters.listingTypes.length === 1) {
    parts.push(filters.listingTypes[0]);
  }

  if (filters.petFriendly) parts.push('Pet OK');
  if (filters.noFee) parts.push('No Fee');

  return parts.length > 0 ? parts.join(' \u00B7 ') : 'My Search';
}

export function getSavedSearchLimit(plan: string): number {
  switch (plan) {
    case 'free': return 1;
    case 'plus': return 5;
    case 'elite': return 20;
    default: return 1;
  }
}

export function getNotifyFrequencyOptions(plan: string): string[] {
  switch (plan) {
    case 'free': return ['daily'];
    case 'plus': return ['daily', 'weekly'];
    case 'elite': return ['instant', 'daily', 'weekly'];
    default: return ['daily'];
  }
}
