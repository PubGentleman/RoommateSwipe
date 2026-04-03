import { supabase } from '../lib/supabase';

export interface ProfileData {
  budget_min?: number;
  budget_max?: number;
  move_in_date?: string;
  lease_duration?: string;
  room_type?: string;
  looking_for?: string;
  work_location?: string;
  cleanliness?: number;
  noise_tolerance?: number;
  sleep_schedule?: string;
  wake_time?: string;
  sleep_time?: string;
  pets?: string;
  smoking?: boolean;
  drinking?: string;
  guests?: string;
  interests?: string[];
  photos?: string[];
  private_bathroom?: boolean;
  bathrooms?: number;
  coordinates?: { lat: number; lng: number };
  profile_note?: string | null;
  profile_note_updated_at?: string | null;
  preferred_neighborhoods?: string[];
  zip_code?: string;
  ideal_roommate_text?: string;
  pi_parsed_preferences?: Record<string, any>;
  desired_roommate_count?: number;
  desired_bedroom_count?: number;
  household_gender_preference?: 'any' | 'male_only' | 'female_only' | 'same_gender';
  pi_auto_match_enabled?: boolean;
  listing_type_preference?: 'room' | 'entire_apartment' | 'any';
  apartment_search_type?: 'solo' | 'with_partner' | 'with_roommates' | 'have_group' | null;
}

export interface UserData {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  age?: number;
  birthday?: string;
  zodiac_sign?: string;
  gender?: string;
  occupation?: string;
  location?: string;
  neighborhood?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  onboarding_step?: string;
  role?: string;
}

export async function getMyProfile(userId: string) {
  if (!userId) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  return { user: userData, profile: profileData, subscription };
}

export async function getUserProfile(userId: string) {
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  return { user: userData, profile: profileData };
}

export async function updateUser(userId: string, updates: UserData) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: ProfileData) {
  if (!userId) throw new Error('Not authenticated');

  if (updates.photos && Array.isArray(updates.photos) && updates.photos.length < 3) {
    throw new Error('At least 3 photos are required to save your profile');
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ user_id: userId, ...updates })
      .select()
      .single();
    if (error) throw error;
    result = data;
  }

  if (
    updates.ideal_roommate_text &&
    updates.ideal_roommate_text.trim().length > 20
  ) {
    triggerPiParsing(updates.ideal_roommate_text).catch(() => {});
  }

  const matchingFieldsChanged = hasMatchingFieldChanges(updates);
  if (matchingFieldsChanged) {
    triggerPiCacheInvalidation(userId).catch(() => {});
  }

  return result;
}

const MATCHING_FIELDS: (keyof ProfileData)[] = [
  'budget_min', 'budget_max', 'cleanliness', 'noise_tolerance',
  'sleep_schedule', 'pets', 'smoking', 'drinking', 'guests',
  'interests', 'preferred_neighborhoods', 'zip_code',
  'coordinates', 'ideal_roommate_text',
  'desired_roommate_count', 'desired_bedroom_count',
  'household_gender_preference', 'pi_auto_match_enabled',
];

function hasMatchingFieldChanges(updates: ProfileData): boolean {
  return MATCHING_FIELDS.some((field) => updates[field] !== undefined);
}

async function triggerPiParsing(text: string): Promise<void> {
  try {
    const { parseIdealRoommateText } = await import('./piMatchingService');
    await parseIdealRoommateText(text);
  } catch {
  }
}

async function triggerPiCacheInvalidation(userId: string): Promise<void> {
  try {
    const { invalidateAllCachesForUser } = await import('./piMatchingService');
    await invalidateAllCachesForUser(userId);
  } catch {
  }
}

export async function uploadProfilePhoto(userId: string, uri: string, fileName: string) {
  if (!userId) throw new Error('Not authenticated');

  const response = await fetch(uri);
  const blob = await response.blob();
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(filePath, blob, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export async function deleteProfilePhoto(userId: string, photoUrl: string) {
  if (!userId) throw new Error('Not authenticated');

  const path = photoUrl.split('profile-photos/')[1];
  if (path) {
    await supabase.storage.from('profile-photos').remove([path]);
  }
}

export async function recordProfileView(userId: string, viewedUserId: string) {
  if (!userId || userId === viewedUserId) return;

  await supabase
    .from('profile_views')
    .insert({ viewer_id: userId, viewed_id: viewedUserId });
}

export async function getProfileViews(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('profile_views')
    .select('*, viewer:users!viewer_id(id, full_name, avatar_url)')
    .eq('viewed_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}
