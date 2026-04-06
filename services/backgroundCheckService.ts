import { supabase } from '../lib/supabase'
import { withTimeout } from '../utils/asyncHelpers';

export interface BackgroundCheckBadge {
  status: 'approved' | 'pending' | 'processing' | 'declined' | 'none'
  identityVerified: boolean
  criminalClear: boolean
  creditScoreRange?: string
  checkType: 'standard' | 'premium'
  expiresAt?: string
}

export const startBackgroundCheck = async (
  checkType: 'standard' | 'premium' = 'standard'
): Promise<{ sessionToken: string; inquiryId: string; checkId: string }> => {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('create-background-check', {
    body: { checkType },
  }),
    30000,
    'create-background-check'
  )

  if (error) throw new Error(error.message || 'Failed to start background check')
  if (data?.error) throw new Error(data.error)
  return data
}

export const getMyBackgroundCheck = async (userId: string): Promise<BackgroundCheckBadge> => {
  if (!userId) return { status: 'none', identityVerified: false, criminalClear: false, checkType: 'standard' }

  const { data } = await supabase
    .from('background_checks')
    .select('id, user_id, status, provider, identity_verified, criminal_clear, created_at, completed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return { status: 'none', identityVerified: false, criminalClear: false, checkType: 'standard' }

  return {
    status: data.status,
    identityVerified: data.identity_verified,
    criminalClear: data.criminal_clear,
    creditScoreRange: data.credit_score_range,
    checkType: data.check_type,
    expiresAt: data.expires_at,
  }
}

export async function submitSelfieVerification(
  userId: string,
  selfieUri: string
): Promise<{ success: boolean; match: boolean; confidence: number; error?: string }> {
  const filename = `${userId}/selfie-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('verification-selfies')
    .upload(filename, {
      uri: selfieUri,
      type: 'image/jpeg',
      name: 'selfie.jpg',
    } as any);

  if (uploadError) return { success: false, match: false, confidence: 0, error: uploadError.message };

  const { data, error } = await withTimeout(
    supabase.functions.invoke('verify-selfie', {
    body: { userId, selfieStoragePath: filename },
  }),
    30000,
    'verify-selfie'
  );

  if (error) return { success: false, match: false, confidence: 0, error: error.message };
  if (!data || typeof data.match !== 'boolean') {
    return { success: false, match: false, confidence: 0, error: 'Invalid response from verification service' };
  }

  if (data.match && data.confidence >= 0.85) {
    await supabase
      .from('users')
      .update({
        selfie_verified: true,
        selfie_verified_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  return {
    success: true,
    match: data.match,
    confidence: data.confidence,
  };
}

export const getUserBackgroundBadge = async (userId: string): Promise<BackgroundCheckBadge | null> => {
  const { data } = await supabase
    .from('public_background_badges')
    .select('id, user_id, status, identity_verified, criminal_clear, created_at')
    .eq('user_id', userId)
    .single()

  if (!data) return null

  return {
    status: data.status,
    identityVerified: data.identity_verified,
    criminalClear: data.criminal_clear,
    creditScoreRange: data.credit_score_range,
    checkType: data.check_type,
    expiresAt: data.expires_at,
  }
}
