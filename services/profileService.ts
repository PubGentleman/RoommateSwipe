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
  city?: string;
  state?: string;
  onboarding_step?: string;
  role?: string;
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
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

export async function updateUser(updates: UserData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(updates: ProfileData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ user_id: user.id, ...updates })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function uploadProfilePhoto(uri: string, fileName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch(uri);
  const blob = await response.blob();
  const filePath = `${user.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(filePath, blob, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export async function deleteProfilePhoto(photoUrl: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const path = photoUrl.split('profile-photos/')[1];
  if (path) {
    await supabase.storage.from('profile-photos').remove([path]);
  }
}

export async function recordProfileView(viewedUserId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === viewedUserId) return;

  await supabase
    .from('profile_views')
    .insert({ viewer_id: user.id, viewed_id: viewedUserId });
}

export async function getProfileViews() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('profile_views')
    .select('*, viewer:users!viewer_id(id, full_name, avatar_url)')
    .eq('viewed_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}
