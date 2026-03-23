ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS desired_bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS budget_per_person_min INTEGER,
  ADD COLUMN IF NOT EXISTS budget_per_person_max INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_trains TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_neighborhoods TEXT[],
  ADD COLUMN IF NOT EXISTS amenity_must_haves TEXT[],
  ADD COLUMN IF NOT EXISTS location_flexible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wfh BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS apartment_prefs_complete BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.group_apartment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, listing_id, user_id)
);

ALTER TABLE public.group_apartment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can vote"
  ON public.group_apartment_votes FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() IN (
      SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id = group_apartment_votes.group_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IN (
      SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id = group_apartment_votes.group_id
    )
  );

CREATE POLICY "Group members can see all votes in their group"
  ON public.group_apartment_votes FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.group_members WHERE group_id = group_apartment_votes.group_id
    )
  );
