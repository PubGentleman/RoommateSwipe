import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { checkRhomeSelect } from './useRhomeSelect';
import { checkTopAgent } from './useTopAgent';
import { checkTopCompany } from './useTopCompany';

export type HostBadgeType = 'rhome_select' | 'top_agent' | 'top_company' | null;

interface HostBadgeResult {
  badge: HostBadgeType;
  loading: boolean;
}

export const BADGE_CONFIG = {
  rhome_select: {
    label: 'Rhome Select',
    detailLabel: 'Rhome Select Host',
    subtitle: 'Top-rated, trusted host on Rhome',
    color: '#D4AF37',
    bgOpacity: 0.12,
    borderOpacity: 0.3,
    icon: 'award' as const,
  },
  top_agent: {
    label: 'Top Agent',
    detailLabel: 'Top Agent on Rhome',
    subtitle: 'Verified, high-performing licensed agent',
    color: '#F59E0B',
    bgOpacity: 0.12,
    borderOpacity: 0.3,
    icon: 'star' as const,
  },
  top_company: {
    label: 'Top Company',
    detailLabel: 'Top Company on Rhome',
    subtitle: 'Trusted property management company',
    color: '#22C55E',
    bgOpacity: 0.12,
    borderOpacity: 0.3,
    icon: 'shield' as const,
  },
} as const;

export function useHostBadge(hostId: string | undefined): HostBadgeResult {
  const [badge, setBadge] = useState<HostBadgeType>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hostId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    determineHostBadge(hostId).then(result => {
      if (!cancelled) {
        setBadge(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [hostId]);

  return { badge, loading };
}

async function determineHostBadge(hostId: string): Promise<HostBadgeType> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('host_type, host_badge')
      .eq('id', hostId)
      .maybeSingle();

    if (!user) return null;

    if (user.host_badge) {
      return user.host_badge as HostBadgeType;
    }

    switch (user.host_type) {
      case 'individual':
        return (await checkRhomeSelect(hostId)) ? 'rhome_select' : null;
      case 'agent':
        return (await checkTopAgent(hostId)) ? 'top_agent' : null;
      case 'company':
        return (await checkTopCompany(hostId)) ? 'top_company' : null;
      default:
        return null;
    }
  } catch (error) {
    console.error('Error determining host badge:', error);
    return null;
  }
}
