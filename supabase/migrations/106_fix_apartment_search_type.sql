-- Fix 1: Add apartment_search_type column to users table if it doesn't exist
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS apartment_search_type TEXT DEFAULT NULL;

-- Fix 2: Drop any existing constraint and add the correct one on users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_apartment_search_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_apartment_search_type_check
  CHECK (apartment_search_type IN ('solo', 'with_partner', 'with_roommates', 'have_group', 'entire_apartment'));

-- Fix 3: Add listing_type_preference column to users table if it doesn't exist
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS listing_type_preference TEXT DEFAULT 'any';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_listing_type_preference_check;
ALTER TABLE public.users ADD CONSTRAINT users_listing_type_preference_check
  CHECK (listing_type_preference IN ('room', 'entire_apartment', 'any'));

-- Fix 4: Update profiles table constraint to also allow 'entire_apartment'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_apartment_search_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_apartment_search_type_check
  CHECK (apartment_search_type IN ('solo', 'with_partner', 'with_roommates', 'have_group', 'entire_apartment'));
