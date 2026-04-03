import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lnjupgvvsbdooomvdjho.supabase.co';
const INSTAGRAM_CLIENT_ID = process.env.EXPO_PUBLIC_INSTAGRAM_CLIENT_ID || '';

export const connectInstagram = async (): Promise<{ success: boolean; handle?: string; error?: string }> => {
  try {
    const redirectUri = Linking.createURL('instagram-callback');

    const authUrl =
      `https://api.instagram.com/oauth/authorize` +
      `?client_id=${INSTAGRAM_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=user_profile` +
      `&response_type=code`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success' || !result.url) {
      return { success: false, error: 'Instagram authorization cancelled' };
    }

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    if (!code) {
      return { success: false, error: 'No authorization code received' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/instagram-oauth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ code }),
      }
    );

    const data = await response.json();
    if (data.error) return { success: false, error: data.error };

    return { success: true, handle: data.handle };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const disconnectInstagram = async (userId: string): Promise<void> => {
  if (!userId) return;

  await supabase
    .from('profiles')
    .update({
      instagram_handle: null,
      instagram_verified: false,
      instagram_connected_at: null,
    })
    .eq('id', userId);
};
