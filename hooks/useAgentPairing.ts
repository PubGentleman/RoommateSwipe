import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/asyncHelpers';

export interface PairingResult {
  recommendedGroup: string[];
  groupNames: string[];
  confidence: number;
  headline: string;
  reasons: string[];
  concerns: string[];
  alternativeGroup?: string[];
  alternativeReason?: string;
  excludedRenters: Array<{ id: string; name: string; reason: string }>;
}

export function useAgentPairing() {
  const [loading, setLoading] = useState(false);
  const [result, setPairingResult] = useState<PairingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getPairing = async (renterIds: string[], listingId: string) => {
    setLoading(true);
    setError(null);
    setPairingResult(null);

    try {
      const { data, error: fnError } = await withTimeout(
    supabase.functions.invoke(
        'agent-pair-group',
        { body: { renterIds, listingId } }
      ),
    30000,
    'agent-pair-group'
  );

      if (fnError) {
        setError(fnError.message ?? 'Pairing failed');
        return null;
      }

      if (data?.error) {
        setError(data.error);
        return null;
      }

      setPairingResult(data);
      return data as PairingResult;
    } catch (e: any) {
      setError(e.message ?? 'Unexpected error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPairingResult(null);
    setError(null);
  };

  return { getPairing, loading, result, error, reset };
}
