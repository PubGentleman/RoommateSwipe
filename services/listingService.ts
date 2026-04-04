import { supabase } from '../lib/supabase';
import { Property } from '../types/models';
import { StorageService } from '../utils/storage';

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
  zip_code?: string;
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
    listing_type: l.listing_type || (l.room_type === 'room' ? 'room' : 'entire_apartment'),
    city: l.city || '',
    state: l.state || '',
    neighborhood: l.neighborhood || '',
    zip_code: l.zip_code || '',
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
    hostType: l.host?.host_type || l.host_type || undefined,
    host_badge: l.host_badge ?? null,
    preferred_tenant_gender: l.preferred_tenant_gender || 'any',
    isArchived: l.is_archived ?? false,
    archivedAt: l.archived_at ?? undefined,
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
    .select('*')
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
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getMyListings(userId: string) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('host_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createListing(userId: string, listing: ListingData) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('listings')
    .insert({ host_id: userId, ...listing })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateListing(id: string, updates: Partial<ListingData>, userId?: string) {
  let query = supabase
    .from('listings')
    .update(updates)
    .eq('id', id);

  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query.select().single();

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

export async function recordListingView(userId: string, listingId: string): Promise<void> {
  try {
    if (!userId) return;
    await supabase.rpc('record_listing_view', {
      p_listing_id: listingId,
      p_viewer_id: userId,
    });
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
  const empty = () => listingIds.map(id => ({ listingId: id, totalViews: 0, last30Days: 0, last90Days: 0 }));
  try {
    const { data } = await supabase
      .from('listing_view_stats')
      .select('listing_id, unique_viewers, viewers_last_30')
      .in('listing_id', listingIds);
    if (!data) return empty();
    return listingIds.map(id => {
      const row = data.find((r: any) => r.listing_id === id);
      return {
        listingId: id,
        totalViews: row?.unique_viewers ?? 0,
        last30Days: row?.viewers_last_30 ?? 0,
        last90Days: row?.unique_viewers ?? 0,
      };
    });
  } catch {
    return empty();
  }
}

export async function getCompanyAgents(companyUserId: string): Promise<{ id: string; full_name: string; avatar_url?: string }[]> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('member_user_id, full_name, email')
      .eq('company_user_id', companyUserId)
      .eq('status', 'active')
      .eq('role', 'agent');

    if (error || !data || data.length === 0) {
      const allUsers = await StorageService.getUsers();
      return allUsers
        .filter(u => u.hostType === 'agent' && ((u as any).company_id === companyUserId))
        .map(u => ({ id: u.id, full_name: u.full_name || u.name || 'Agent', avatar_url: u.profilePicture }));
    }

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
    const allUsers = await StorageService.getUsers();
    return allUsers
      .filter(u => u.hostType === 'agent' && ((u as any).company_id === companyUserId))
      .map(u => ({ id: u.id, full_name: u.full_name || u.name || 'Agent', avatar_url: u.profilePicture }));
  }
}

export async function reassignListingAgent(listingId: string, newAgentId: string, callerId?: string): Promise<boolean> {
  try {
    const { data: listing } = await supabase
      .from('listings')
      .select('created_by')
      .eq('id', listingId)
      .single();

    if (!listing) return false;

    if (callerId && listing.created_by !== callerId) {
      const { data: callerTeam } = await supabase
        .from('company_team_members')
        .select('company_id, role')
        .eq('user_id', callerId)
        .in('role', ['owner', 'manager'])
        .limit(1)
        .single();

      if (!callerTeam) {
        console.error('[listingService] Unauthorized reassignment attempt');
        return false;
      }

      const { data: ownerTeam } = await supabase
        .from('company_team_members')
        .select('company_id')
        .eq('user_id', listing.created_by)
        .eq('company_id', callerTeam.company_id)
        .limit(1)
        .single();

      if (!ownerTeam) {
        console.error('[listingService] Cross-company reassignment blocked');
        return false;
      }
    }

    const { error } = await supabase
      .from('listings')
      .update({ assigned_agent_id: newAgentId || null })
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
      .select('*')
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
  confirmedBookings: number;
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
      .in('status', ['pending', 'confirmed']);

    return agents.map(agent => ({
      agentId: agent.id,
      agentName: agent.full_name,
      activeListings: (listings || []).filter(l =>
        l.assigned_agent_id === agent.id && l.is_active && !l.is_rented && !l.is_paused
      ).length,
      pendingBookings: (bookings || []).filter(b => b.host_id === agent.id && b.status === 'pending').length,
      confirmedBookings: (bookings || []).filter(b => b.host_id === agent.id && b.status === 'confirmed').length,
    }));
  } catch {
    return [];
  }
}

export interface AgentConversationSummary {
  id: string;
  renterName: string;
  listingTitle: string;
  listingId: string;
  status: string;
  lastActivity: string;
}

export interface AgentBookingSummary {
  id: string;
  renterName: string;
  listingTitle: string;
  listingId: string;
  status: string;
  moveInDate: string;
  monthlyRent: number;
  createdAt: string;
}

export async function getAgentDetailData(agentId: string, callerId?: string): Promise<{
  conversations: AgentConversationSummary[];
  bookings: AgentBookingSummary[];
}> {
  if (callerId && agentId !== callerId) {
    const { data: callerTeam } = await supabase
      .from('company_team_members')
      .select('company_id, role')
      .eq('user_id', callerId)
      .in('role', ['owner', 'manager'])
      .limit(1)
      .single();

    if (!callerTeam) {
      console.warn('[listingService] Unauthorized agent detail access');
      return { conversations: [], bookings: [] };
    }

    const { data: agentTeam } = await supabase
      .from('company_team_members')
      .select('company_id')
      .eq('user_id', agentId)
      .eq('company_id', callerTeam.company_id)
      .limit(1)
      .single();

    if (!agentTeam) {
      console.warn('[listingService] Cross-company agent detail access blocked');
      return { conversations: [], bookings: [] };
    }
  }
  try {
    const { data: groups } = await supabase
      .from('groups')
      .select(`
        id, inquiry_status, created_at,
        listing:listings(id, title),
        members:group_members(user_id, is_host)
      `)
      .eq('host_id', agentId)
      .eq('type', 'listing_inquiry')
      .order('created_at', { ascending: false })
      .limit(10);

    const conversations: AgentConversationSummary[] = [];
    if (groups) {
      const renterIds = groups
        .flatMap((g: any) => (g.members || []).filter((m: any) => !m.is_host).map((m: any) => m.user_id))
        .filter(Boolean);

      const uniqueRenterIds = [...new Set(renterIds)];
      let renterNames: Map<string, string> = new Map();
      if (uniqueRenterIds.length > 0) {
        const { data: renters } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', uniqueRenterIds);
        if (renters) {
          renters.forEach((r: any) => renterNames.set(r.id, r.full_name || 'Renter'));
        }
      }

      for (const g of groups as any[]) {
        const renterMember = (g.members || []).find((m: any) => !m.is_host);
        conversations.push({
          id: g.id,
          renterName: renterMember ? (renterNames.get(renterMember.user_id) || 'Renter') : 'Renter',
          listingTitle: g.listing?.title || 'Listing',
          listingId: g.listing?.id || '',
          status: g.inquiry_status || 'pending',
          lastActivity: g.created_at,
        });
      }
    }

    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        id, status, move_in_date, monthly_rent, created_at, listing_id, renter_id,
        listing:listings(id, title),
        renter:users!renter_id(id, full_name)
      `)
      .eq('host_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const bookings: AgentBookingSummary[] = (bookingData || []).map((b: any) => ({
      id: b.id,
      renterName: b.renter?.full_name || 'Renter',
      listingTitle: b.listing?.title || 'Listing',
      listingId: b.listing?.id || b.listing_id || '',
      status: b.status,
      moveInDate: b.move_in_date,
      monthlyRent: b.monthly_rent,
      createdAt: b.created_at,
    }));

    return { conversations, bookings };
  } catch {
    const { StorageService } = await import('../utils/storage');
    const interestCards = await StorageService.getInterestCards();
    const agentCards = interestCards.filter((c: any) => c.hostId === agentId);
    const conversations: AgentConversationSummary[] = agentCards.slice(0, 10).map((c: any) => ({
      id: c.id,
      renterName: c.renterName || 'Renter',
      listingTitle: c.propertyTitle || 'Listing',
      listingId: c.propertyId || '',
      status: c.status || 'pending',
      lastActivity: c.createdAt || new Date().toISOString(),
    }));
    return { conversations, bookings: [] };
  }
}

export async function reassignConversation(
  groupId: string,
  listingId: string,
  newAgentId: string,
  callerId?: string
): Promise<boolean> {
  try {
    const { data: group } = await supabase
      .from('groups')
      .select('host_id')
      .eq('id', groupId)
      .single();

    if (!group) return false;

    if (callerId && group.host_id !== callerId) {
      const { data: callerTeam } = await supabase
        .from('company_team_members')
        .select('company_id, role')
        .eq('user_id', callerId)
        .in('role', ['owner', 'manager'])
        .limit(1)
        .single();

      if (!callerTeam) {
        console.error('[listingService] Unauthorized conversation reassignment');
        return false;
      }

      const { data: hostTeam } = await supabase
        .from('company_team_members')
        .select('company_id')
        .eq('user_id', group.host_id)
        .eq('company_id', callerTeam.company_id)
        .limit(1)
        .single();

      if (!hostTeam) {
        console.error('[listingService] Cross-company conversation reassignment blocked');
        return false;
      }
    }

    const { error: groupErr } = await supabase
      .from('groups')
      .update({ host_id: newAgentId })
      .eq('id', groupId);
    if (groupErr) throw groupErr;

    const { data: oldMembers, error: fetchErr } = await supabase
      .from('group_members')
      .select('id, user_id, is_host')
      .eq('group_id', groupId)
      .eq('is_host', true);
    if (fetchErr) throw fetchErr;

    if (oldMembers && oldMembers.length > 0) {
      const oldHostMemberIds = oldMembers.map(m => m.id);
      const { error: delErr } = await supabase.from('group_members').delete().in('id', oldHostMemberIds);
      if (delErr) throw delErr;
    }

    const { error: insertErr } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: newAgentId,
      role: 'member',
      is_host: true,
      status: 'active',
    });
    if (insertErr) throw insertErr;

    if (listingId) {
      const { error: listingErr } = await supabase
        .from('listings')
        .update({ assigned_agent_id: newAgentId })
        .eq('id', listingId);
      if (listingErr) throw listingErr;
    }

    return true;
  } catch (err) {
    console.warn('[listingService] reassignConversation failed:', err);
    return false;
  }
}

export async function uploadListingPhoto(userId: string, uri: string, fileName: string) {
  if (!userId) throw new Error('Not authenticated');

  const response = await fetch(uri);
  const blob = await response.blob();
  const filePath = `${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from('listing-photos')
    .upload(filePath, blob, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('listing-photos')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
