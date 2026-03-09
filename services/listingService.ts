import { supabase } from '../lib/supabase';

export interface ListingData {
  title: string;
  description?: string;
  rent: number;
  bedrooms?: number;
  bathrooms?: number;
  address?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  room_type?: string;
  amenities?: string[];
  photos?: string[];
  available_date?: string;
  is_active?: boolean;
  is_paused?: boolean;
  is_rented?: boolean;
  coordinates?: { latitude: number; longitude: number };
}

export async function getListings(filters?: {
  city?: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  roomType?: string;
}) {
  let query = supabase
    .from('listings')
    .select('*, host:users!host_id(id, full_name, avatar_url)')
    .eq('is_active', true)
    .eq('is_rented', false)
    .eq('is_paused', false)
    .order('created_at', { ascending: false });

  if (filters?.city) query = query.eq('city', filters.city);
  if (filters?.minRent) query = query.gte('rent', filters.minRent);
  if (filters?.maxRent) query = query.lte('rent', filters.maxRent);
  if (filters?.bedrooms) query = query.eq('bedrooms', filters.bedrooms);
  if (filters?.roomType) query = query.eq('room_type', filters.roomType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getListing(id: string) {
  const { data, error } = await supabase
    .from('listings')
    .select('*, host:users!host_id(id, full_name, avatar_url, bio)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getMyListings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createListing(listing: ListingData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('listings')
    .insert({ host_id: user.id, ...listing })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateListing(id: string, updates: Partial<ListingData>) {
  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteListing(id: string) {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function uploadListingPhoto(uri: string, fileName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch(uri);
  const blob = await response.blob();
  const filePath = `${user.id}/${fileName}`;

  const { error } = await supabase.storage
    .from('listing-photos')
    .upload(filePath, blob, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('listing-photos')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
