-- Add zip_code to users, listings, and profiles
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Zip code reference table for coordinate lookups
CREATE TABLE IF NOT EXISTS public.zip_code_data (
  zip_code TEXT PRIMARY KEY,
  city TEXT,
  state TEXT,
  latitude NUMERIC,
  longitude NUMERIC
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zip_code_data_coords
  ON public.zip_code_data(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_profiles_preferred_neighborhoods
  ON public.profiles USING GIN (preferred_neighborhoods);
