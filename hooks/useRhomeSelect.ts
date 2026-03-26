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

    const check = async () => {
      try {
        const { data: hostUser } = await supabase
          .from('users')
          .select('created_at')
          .eq('id', hostId)
          .single();

        if (!hostUser?.created_at) { setIsRhomeSelect(false); setLoading(false); return; }

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        if (new Date(hostUser.created_at) > threeMonthsAgo) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        const { data: listings } = await supabase
          .from('listings')
          .select('average_rating, review_count')
          .eq('host_id', hostId);

        if (!listings || listings.length === 0) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        const totalReviews = listings.reduce((sum, l) => sum + (l.review_count || 0), 0);
        const weightedRating = listings.reduce((sum, l) =>
          sum + (l.average_rating || 0) * (l.review_count || 0), 0
        ) / (totalReviews || 1);

        if (totalReviews < 10 || weightedRating < 4.8) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        const { data: bookings } = await supabase
          .from('bookings')
          .select('status')
          .eq('host_id', hostId);

        if (!bookings || bookings.length === 0) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
        if (confirmedBookings.length === 0) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        const cancelledByHost = bookings.filter(b => b.status === 'cancelled_by_host').length;
        const cancellationRate = cancelledByHost / bookings.length;
        if (cancellationRate >= 0.1) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('response_rate')
          .eq('id', hostId)
          .single();

        if (userData?.response_rate !== null && userData?.response_rate !== undefined && userData.response_rate < 90) {
          setIsRhomeSelect(false); setLoading(false); return;
        }

        if (!cancelled) {
          setIsRhomeSelect(true);
        }
      } catch {
        if (!cancelled) setIsRhomeSelect(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();

    return () => { cancelled = true; };
  }, [hostId]);

  return { isRhomeSelect, loading };
}

export function RhomeSelectBadge() {
  return null;
}
