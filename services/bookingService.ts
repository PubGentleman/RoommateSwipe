import { supabase } from '../lib/supabase';

export interface Booking {
  id: string;
  listing_id: string;
  host_id: string;
  renter_id: string;
  move_in_date: string;
  lease_length: string;
  monthly_rent: number;
  security_deposit: number | null;
  status: 'confirmed' | 'cancelled_by_host' | 'cancelled_by_renter';
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  group_id: string | null;
}

export async function createBooking(params: {
  listingId: string;
  hostId: string;
  renterId: string;
  moveInDate: string;
  leaseLength: string;
  monthlyRent: number;
  securityDeposit: number | null;
  groupId?: string | null;
}): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  try {
    const insertData: any = {
      listing_id: params.listingId,
      host_id: params.hostId,
      renter_id: params.renterId,
      move_in_date: params.moveInDate,
      lease_length: params.leaseLength,
      monthly_rent: params.monthlyRent,
      security_deposit: params.securityDeposit,
      status: 'confirmed',
    };
    if (params.groupId) insertData.group_id = params.groupId;

    const { data, error } = await supabase
      .from('bookings')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return { success: true, booking: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create booking' };
  }
}

export async function cancelBooking(
  bookingId: string,
  cancelledBy: 'host' | 'renter',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        status: cancelledBy === 'host' ? 'cancelled_by_host' : 'cancelled_by_renter',
        cancellation_reason: reason || null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel booking' };
  }
}

export async function getBookingsForListing(listingId: string): Promise<Booking[]> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getHostBookings(hostId: string): Promise<Booking[]> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getHostCancellationRate(hostId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('bookings')
      .select('status')
      .eq('host_id', hostId);

    if (!data || data.length === 0) return 0;
    const cancelled = data.filter(b => b.status === 'cancelled_by_host').length;
    return cancelled / data.length;
  } catch {
    return 0;
  }
}
