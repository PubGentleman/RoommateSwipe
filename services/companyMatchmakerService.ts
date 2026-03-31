import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { StorageService } from '../utils/storage';

export interface CompanyShortlistedRenter {
  id: string;
  renterId: string;
  listingId?: string;
  fullName: string;
  age?: number;
  occupation?: string;
  bio?: string;
  budgetMax?: number;
  budgetPerPersonMax?: number;
  moveInDate?: string;
  sleepSchedule?: string;
  cleanliness?: number;
  smoking?: boolean;
  pets?: boolean;
  preferredTrains?: string[];
  lifestyleTags?: string[];
  avatarUrl?: string;
  shortlistedAt: string;
}

export interface FillPipelineItem {
  listingId: string;
  address: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  daysVacant: number;
  totalGroupsMatched: number;
  totalInvitesSent: number;
  bestMatchScore: number;
  projectedFillDate?: string;
  status: 'urgent' | 'active' | 'filled';
}

export async function shortlistRenter(
  companyHostId: string,
  renterId: string,
  listingId?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    const { data: renter } = await supabase
      .from('users')
      .select('accept_agent_offers')
      .eq('id', renterId)
      .maybeSingle();

    if (renter && renter.accept_agent_offers === false) {
      return { success: false, error: 'This renter is not accepting offers from companies' };
    }

    const { error } = await supabase
      .from('company_shortlisted_renters')
      .upsert({
        company_host_id: companyHostId,
        renter_id: renterId,
        listing_id: listingId || null,
        notes: notes || null,
      }, { onConflict: 'company_host_id,renter_id,listing_id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } else {
    const key = `company_shortlist_${companyHostId}`;
    const existing = JSON.parse(await StorageService.getItem(key) || '[]');
    const already = existing.find((r: any) => r.renterId === renterId && r.listingId === (listingId || null));
    if (!already) {
      existing.push({ id: `cs-${Date.now()}`, renterId, listingId: listingId || null, notes, shortlistedAt: new Date().toISOString() });
      await StorageService.setItem(key, JSON.stringify(existing));
    }
    return { success: true };
  }
}

export async function removeFromShortlist(
  companyHostId: string,
  renterId: string,
  listingId?: string
): Promise<void> {
  if (isSupabaseConfigured) {
    let query = supabase
      .from('company_shortlisted_renters')
      .delete()
      .eq('company_host_id', companyHostId)
      .eq('renter_id', renterId);
    if (listingId) query = query.eq('listing_id', listingId);
    const { error } = await query;
    if (error) throw error;
  } else {
    const key = `company_shortlist_${companyHostId}`;
    const existing = JSON.parse(await StorageService.getItem(key) || '[]');
    const filtered = existing.filter((r: any) => !(r.renterId === renterId && (!listingId || r.listingId === listingId)));
    await StorageService.setItem(key, JSON.stringify(filtered));
  }
}

export async function getShortlistedRenters(
  companyHostId: string,
  listingId?: string
): Promise<CompanyShortlistedRenter[]> {
  if (isSupabaseConfigured) {
    let query = supabase
      .from('company_shortlisted_renters')
      .select(`
        id, renter_id, listing_id, shortlisted_at,
        user:users!company_shortlisted_renters_renter_id_fkey (
          id, full_name, avatar_url, age,
          profile:profiles (
            occupation, bio, budget_max, budget_per_person_max, move_in_date,
            sleep_schedule, cleanliness, smoking, pets,
            preferred_trains, lifestyle_tags
          )
        )
      `)
      .eq('company_host_id', companyHostId)
      .order('shortlisted_at', { ascending: false });

    if (listingId) {
      query = query.or(`listing_id.eq.${listingId},listing_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((item: any) => {
      const u = item.user;
      const p = u?.profile;
      return {
        id: item.id,
        renterId: item.renter_id,
        listingId: item.listing_id,
        fullName: u?.full_name || 'Renter',
        age: u?.age,
        occupation: p?.occupation,
        bio: p?.bio,
        budgetMax: p?.budget_max,
        budgetPerPersonMax: p?.budget_per_person_max,
        moveInDate: p?.move_in_date,
        sleepSchedule: p?.sleep_schedule,
        cleanliness: p?.cleanliness,
        smoking: p?.smoking,
        pets: p?.pets,
        preferredTrains: p?.preferred_trains,
        lifestyleTags: p?.lifestyle_tags,
        avatarUrl: u?.avatar_url,
        shortlistedAt: item.shortlisted_at,
      };
    });
  } else {
    const key = `company_shortlist_${companyHostId}`;
    const existing = JSON.parse(await StorageService.getItem(key) || '[]');
    const profiles = await StorageService.getRoommateProfiles();

    let filtered = existing;
    if (listingId) {
      filtered = existing.filter((r: any) => r.listingId === listingId || !r.listingId);
    }

    return filtered.map((r: any) => {
      const p = profiles.find((pr: any) => pr.id === r.renterId);
      return {
        id: r.id,
        renterId: r.renterId,
        listingId: r.listingId,
        fullName: (p as any)?.name || 'Renter',
        age: (p as any)?.age,
        occupation: (p as any)?.lifestyle?.workSchedule,
        budgetMax: (p as any)?.budget?.max,
        budgetPerPersonMax: (p as any)?.budget?.max,
        moveInDate: (p as any)?.moveInDate,
        sleepSchedule: (p as any)?.lifestyle?.workSchedule,
        cleanliness: (p as any)?.lifestyle?.cleanliness,
        smoking: (p as any)?.lifestyle?.smoking,
        pets: (p as any)?.lifestyle?.hasPets,
        avatarUrl: (p as any)?.photos?.[0],
        shortlistedAt: r.shortlistedAt,
      };
    });
  }
}

export async function getFillPipeline(companyHostId: string): Promise<FillPipelineItem[]> {
  if (isSupabaseConfigured) {
    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        id, address, neighborhood, price, bedrooms, available_date, is_active,
        listing_fill_pipeline (
          days_vacant, total_groups_matched, total_invites_sent,
          best_match_score, projected_fill_date
        )
      `)
      .eq('host_id', companyHostId)
      .eq('is_active', true)
      .order('available_date', { ascending: true });

    if (error) throw error;

    return (listings || []).map((l: any) => {
      const pipeline = l.listing_fill_pipeline?.[0];
      const daysVacant = pipeline?.days_vacant || 0;
      return {
        listingId: l.id,
        address: l.address || '',
        neighborhood: l.neighborhood || '',
        price: l.price || 0,
        bedrooms: l.bedrooms || 0,
        daysVacant,
        totalGroupsMatched: pipeline?.total_groups_matched || 0,
        totalInvitesSent: pipeline?.total_invites_sent || 0,
        bestMatchScore: pipeline?.best_match_score || 0,
        projectedFillDate: pipeline?.projected_fill_date,
        status: daysVacant > 30 ? 'urgent' : daysVacant > 0 ? 'active' : 'filled',
      };
    });
  } else {
    const listings = await StorageService.getProperties();
    return listings
      .filter((l: any) => l.hostId === companyHostId)
      .map((l: any) => ({
        listingId: l.id,
        address: l.address || l.title || '',
        neighborhood: l.neighborhood || l.city || '',
        price: l.price || 0,
        bedrooms: l.bedrooms || 0,
        daysVacant: 0,
        totalGroupsMatched: 0,
        totalInvitesSent: 0,
        bestMatchScore: 0,
        status: 'active' as const,
      }));
  }
}

export async function sendAutoInvite(
  companyHostId: string,
  listingId: string,
  groupId: string,
  matchScore: number,
  aiReason?: string
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.functions.invoke('company-auto-invite', {
      body: { listingId, groupId, companyHostId, matchScore, aiReason },
    });
    if (error) throw error;
  }
}

export async function runAIPairing(
  companyHostId: string,
  listingId: string
): Promise<any> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.functions.invoke('company-pair-group', {
      body: { listingId, companyHostId },
    });
    if (error) throw error;
    return data;
  }
  return {
    recommendedGroup: [],
    confidence: 0,
    fillScore: 0,
    reasons: ['AI pairing requires Supabase connection'],
    concerns: [],
    recommendation: 'Connect to Supabase to use AI pairing.',
  };
}

export async function isRenterShortlisted(
  companyHostId: string,
  renterId: string
): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('company_shortlisted_renters')
      .select('id')
      .eq('company_host_id', companyHostId)
      .eq('renter_id', renterId)
      .maybeSingle();
    return !!data;
  } else {
    const key = `company_shortlist_${companyHostId}`;
    const existing = JSON.parse(await StorageService.getItem(key) || '[]');
    return existing.some((r: any) => r.renterId === renterId);
  }
}
