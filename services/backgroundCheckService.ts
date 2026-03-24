import { supabase } from '../lib/supabase'

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
  const { data, error } = await supabase.functions.invoke('create-background-check', {
    body: { checkType },
  })

  if (error) throw new Error(error.message || 'Failed to start background check')
  if (data?.error) throw new Error(data.error)
  return data
}

export const getMyBackgroundCheck = async (): Promise<BackgroundCheckBadge> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'none', identityVerified: false, criminalClear: false, checkType: 'standard' }

  const { data } = await supabase
    .from('background_checks')
    .select('*')
    .eq('user_id', user.id)
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

export const getUserBackgroundBadge = async (userId: string): Promise<BackgroundCheckBadge | null> => {
  const { data } = await supabase
    .from('public_background_badges')
    .select('*')
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
