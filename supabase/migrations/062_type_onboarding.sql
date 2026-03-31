ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS type_onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_neighborhoods TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_bedrooms INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS amenity_preferences TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS nice_to_have_amenities TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS move_in_timeline TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_preferred_neighborhoods
  ON public.users USING GIN (preferred_neighborhoods)
  WHERE preferred_neighborhoods != '{}';
