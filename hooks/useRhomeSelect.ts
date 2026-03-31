import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface RhomeSelectResult {
  isRhomeSelect: boolean;
  loading: boolean;
}

export function useRhomeSelect(hostId: string | undefined): RhomeSelectResult {
  const [isRhomeSelect, setIsRhomeSelect] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hostId) {
      setIsRhomeSelect(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    checkRhomeSelect(hostId).then(result => {
      if (!cancelled) {
        setIsRhomeSelect(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [hostId]);

  return { isRhomeSelect, loading };
}

export async function checkRhomeSelect(hostId: string): Promise<boolean> {
  try {
    const { data: hostUser } = await supabase
      .from('users')
      .select('created_at, response_rate')
      .eq('id', hostId)
      .maybeSingle();

    if (!hostUser?.created_at) return false;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (new Date(hostUser.created_at) > threeMonthsAgo) return false;

    if (hostUser.response_rate !== null && hostUser.response_rate !== undefined && hostUser.response_rate < 90) {
      return false;
    }

    const { data: listings } = await supabase
      .from('listings')
      .select('average_rating, review_count')
      .eq('host_id', hostId);

    if (!listings || listings.length === 0) return false;

    const totalReviews = listings.reduce((sum, l) => sum + (l.review_count || 0), 0);
    const weightedRating = listings.reduce((sum, l) =>
      sum + (l.average_rating || 0) * (l.review_count || 0), 0
    ) / (totalReviews || 1);

    if (totalReviews < 10 || weightedRating < 4.8) return false;

    const { data: bookings } = await supabase
      .from('bookings')
      .select('status')
      .eq('host_id', hostId);

    if (!bookings || bookings.length === 0) return false;

    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    if (confirmedBookings.length === 0) return false;

    const cancelledByHost = bookings.filter(b => b.status === 'cancelled_by_host').length;
    const cancellationRate = cancelledByHost / bookings.length;
    if (cancellationRate >= 0.1) return false;

    return true;
  } catch {
    return false;
  }
}

export function RhomeSelectBadge() {
  return null;
}
