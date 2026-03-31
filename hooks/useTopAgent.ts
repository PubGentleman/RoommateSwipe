import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TopAgentResult {
  isTopAgent: boolean;
  loading: boolean;
}

const MIN_ACCOUNT_AGE_MONTHS = 2;
const MIN_PLACEMENTS = 3;
const MIN_REVIEWS = 5;
const MIN_RATING = 4.7;
const MIN_RESPONSE_RATE = 85;
const MAX_CANCELLATION_RATE = 0.15;

export function useTopAgent(agentId: string | undefined): TopAgentResult {
  const [isTopAgent, setIsTopAgent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    checkTopAgent(agentId).then(result => {
      if (!cancelled) {
        setIsTopAgent(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [agentId]);

  return { isTopAgent, loading };
}

export async function checkTopAgent(agentId: string): Promise<boolean> {
  try {
    const { data: agent } = await supabase
      .from('users')
      .select('created_at, host_type, response_rate, license_verification_status, agent_plan')
      .eq('id', agentId)
      .maybeSingle();

    if (!agent || agent.host_type !== 'agent') return false;

    if (agent.license_verification_status !== 'verified') return false;

    if (agent.agent_plan === 'pay_per_use' || !agent.agent_plan) return false;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - MIN_ACCOUNT_AGE_MONTHS);
    if (new Date(agent.created_at) > cutoff) return false;

    if ((agent.response_rate || 0) < MIN_RESPONSE_RATE) return false;

    const { count: placementCount } = await supabase
      .from('agent_placements')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('billing_status', 'charged');

    if ((placementCount || 0) < MIN_PLACEMENTS) return false;

    const { data: listings } = await supabase
      .from('listings')
      .select('id, average_rating, review_count')
      .eq('host_id', agentId);

    if (!listings || listings.length === 0) return false;

    const totalReviews = listings.reduce((sum, l) => sum + (l.review_count || 0), 0);
    if (totalReviews < MIN_REVIEWS) return false;

    const weightedSum = listings.reduce(
      (sum, l) => sum + (l.average_rating || 0) * (l.review_count || 0), 0
    );
    const weightedRating = totalReviews > 0 ? weightedSum / totalReviews : 0;
    if (weightedRating < MIN_RATING) return false;

    const { data: bookings } = await supabase
      .from('bookings')
      .select('status')
      .in('listing_id', listings.map(l => l.id));

    if (bookings && bookings.length > 0) {
      const cancelledByHost = bookings.filter(b => b.status === 'cancelled_by_host').length;
      if (cancelledByHost / bookings.length >= MAX_CANCELLATION_RATE) return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking Top Agent:', error);
    return false;
  }
}
