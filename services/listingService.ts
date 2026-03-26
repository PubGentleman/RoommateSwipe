import { supabase } from '../lib/supabase';
import { Property } from '../types/models';

export interface ListingData {
  title: string;
  description?: string;
  rent: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  property_type?: string;
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
  is_featured?: boolean;
  rented_date?: string;
  coordinates?: { lat: number; lng: number };
  transit_info?: any;
  walk_score?: number;
  walk_score_label?: string;
  transit_score?: number;
  transit_score_label?: string;
  host_name?: string;
  host_profile_id?: string;
  existing_roommates?: any[];
  outreach_unlocked_at?: string;
  assigned_agent_id?: string;
}

export function mapListingToProperty(l: any, fallbackHostName?: string): Property {
  const coords = l.coordinates
    ? l.coordinates.lat !== undefined
      ? { lat: l.coordinates.lat, lng: l.coordinates.lng }
      : l.coordinates.latitude !== undefined
        ? { lat: l.coordinates.latitude, lng: l.coordinates.longitude }
        : undefined
    : undefined;

  return {
    id: l.id,
    title: l.title || '',
    description: l.description || '',
    price: l.rent || 0,
    bedrooms: l.bedrooms || 1,
    bathrooms: l.bathrooms || 1,
    sqft: l.sqft || 0,
    propertyType: l.property_type || 'lease',
    roomType: l.room_type || 'entire',
    city: l.city || '',
    state: l.state || '',
    neighborhood: l.neighborhood || '',
    address: l.address || '',
    availableDate: l.available_date ? new Date(l.available_date) : undefined,
    rentedDate: l.rented_date ? new Date(l.rented_date) : undefined,
    amenities: l.amenities || [],
    photos: l.photos || [],
    available: (l.is_active ?? true) && !(l.is_paused ?? false) && !(l.is_rented ?? false) && (!l.available_date || new Date(l.available_date).setHours(0,0,0,0) <= new Date().setHours(0,0,0,0)),
    hostId: l.host_id || '',
    hostName: l.host?.full_name || l.host_name || fallbackHostName || 'Host',
    hostProfileId: l.host_profile_id || l.host_id || '',
    featured: l.is_featured || l.featured || false,
    existingRoommates: l.existing_roommates || [],
    hostLivesIn: l.host_lives_in ?? false,
    existingRoommatesCount: l.existing_roommates_count ?? 0,
    rooms_available: l.rooms_available ?? undefined,
    coordinates: coords,
    createdAt: l.created_at || undefined,
    transitInfo: l.transit_info || undefined,
    walkScore: l.walk_score ?? undefined,
    walkScoreLabel: l.walk_score_label ?? undefined,
    transitScore: l.transit_score ?? undefined,
    transitScoreLabel: l.transit_score_label ?? undefined,
    average_rating: l.average_rating ?? null,
    review_count: l.review_count ?? 0,
    assigned_agent_id: l.assigned_agent_id ?? undefined,
  };
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

export async function getOutreachStatus(listingId: string): Promise<{
  unlocked: boolean;
  hoursRemaining: number;
}> {
  try {
    const { data } = await supabase
      .from('listings')
      .select('status, outreach_unlocked_at')
      .eq('id', listingId)
      .single();

    if (!data || data.status !== 'rented' || !data.outreach_unlocked_at) {
      return { unlocked: false, hoursRemaining: 48 };
    }

    const unlockTime = new Date(data.outreach_unlocked_at).getTime();
    const now = Date.now();
    if (now >= unlockTime) {
      return { unlocked: true, hoursRemaining: 0 };
    }
    const hoursRemaining = Math.ceil((unlockTime - now) / (1000 * 60 * 60));
    return { unlocked: false, hoursRemaining };
  } catch {
    return { unlocked: false, hoursRemaining: 48 };
  }
}

export async function recordListingView(listingId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('listing_views')
      .upsert(
        { listing_id: listingId, viewer_id: user.id, view_date: today },
        { onConflict: 'listing_id,viewer_id,view_date' }
      )
      .then(() => {});
  } catch {}
}

export interface ListingViewStats {
  listingId: string;
  totalViews: number;
  last30Days: number;
  last90Days: number;
}

export async function getListingViewStats(listingIds: string[]): Promise<ListingViewStats[]> {
  if (!listingIds.length) return [];
  try {
    const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('listing_views')
      .select('listing_id, view_date')
      .in('listing_id', listingIds)
      .gte('view_date', ninety);
    if (!data) return listingIds.map(id => ({ listingId: id, totalViews: 0, last30Days: 0, last90Days: 0 }));
    return listingIds.map(id => {
      const rows = data.filter((r: any) => r.listing_id === id);
      return {
        listingId: id,
        totalViews: rows.length,
        last30Days: rows.filter((r: any) => r.view_date >= thirty).length,
        last90Days: rows.length,
      };
    });
  } catch {
    return listingIds.map(id => ({ listingId: id, totalViews: 0, last30Days: 0, last90Days: 0 }));
  }
}

export async function getCompanyAgents(companyUserId: string): Promise<{ id: string; full_name: string; avatar_url?: string }[]> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('member_user_id, full_name, email')
      .eq('company_user_id', companyUserId)
      .eq('status', 'active');

    if (error || !data) return [];

    const agentIds = data.filter(d => d.member_user_id).map(d => d.member_user_id);
    if (agentIds.length === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .in('id', agentIds);

    return (users || []).map(u => ({
      id: u.id,
      full_name: u.full_name || 'Agent',
      avatar_url: u.avatar_url,
    }));
  } catch {
    return [];
  }
}

export async function reassignListingAgent(listingId: string, newAgentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('listings')
      .update({ assigned_agent_id: newAgentId })
      .eq('id', listingId);

    return !error;
  } catch {
    return false;
  }
}

export async function getCompanyListingsWithAgents(companyUserId: string): Promise<any[]> {
  try {
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('member_user_id')
      .eq('company_user_id', companyUserId)
      .eq('status', 'active');

    const agentIds = (teamMembers || []).filter(d => d.member_user_id).map(d => d.member_user_id);
    const allHostIds = [companyUserId, ...agentIds];

    const { data, error } = await supabase
      .from('listings')
      .select('*, host:users!host_id(id, full_name, avatar_url)')
      .in('host_id', allHostIds)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function getAgentStats(companyUserId: string): Promise<{
  agentId: string;
  agentName: string;
  activeListings: number;
  pendingBookings: number;
}[]> {
  try {
    const agents = await getCompanyAgents(companyUserId);
    if (agents.length === 0) return [];

    const agentIds = agents.map(a => a.id);

    const { data: listings } = await supabase
      .from('listings')
      .select('id, assigned_agent_id, is_active, is_rented, is_paused')
      .in('assigned_agent_id', agentIds);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, host_id, status')
      .in('host_id', agentIds)
      .eq('status', 'confirmed');

    return agents.map(agent => ({
      agentId: agent.id,
      agentName: agent.full_name,
      activeListings: (listings || []).filter(l =>
        l.assigned_agent_id === agent.id && l.is_active && !l.is_rented && !l.is_paused
      ).length,
      pendingBookings: (bookings || []).filter(b => b.host_id === agent.id).length,
    }));
  } catch {
    return [];
  }
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
