import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lnjupgvvsbdooomvdjho.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuanVwZ3Z2c2Jkb29vbXZkamhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTEwODAsImV4cCI6MjA4ODY2NzA4MH0.XAGtYsRhSRRPe9yc3jqrO9viqgIZzvFGx_cd1D1y9BU';

export const isSupabaseConfigured = true;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabase };
