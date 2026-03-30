ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_group_lead BOOLEAN DEFAULT false;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'room'
    CHECK (listing_type IN ('room', 'entire_apartment'));

UPDATE public.listings
SET listing_type = CASE
  WHEN room_type = 'entire' THEN 'entire_apartment'
  ELSE 'room'
END
WHERE listing_type IS NULL OR listing_type = 'room';

CREATE TABLE IF NOT EXISTS public.preformed_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  group_lead_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_size INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming', 'ready', 'searching', 'applied', 'placed')),
  invite_code TEXT UNIQUE NOT NULL,
  city TEXT,
  preferred_neighborhoods JSONB,
  combined_budget_min NUMERIC,
  combined_budget_max NUMERIC,
  desired_bedroom_count INTEGER,
  move_in_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_group_id UUID
);

CREATE INDEX IF NOT EXISTS idx_preformed_groups_lead ON public.preformed_groups(group_lead_id);
CREATE INDEX IF NOT EXISTS idx_preformed_groups_code ON public.preformed_groups(invite_code);

CREATE TABLE IF NOT EXISTS public.preformed_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preformed_group_id UUID REFERENCES public.preformed_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'joined', 'declined')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  invite_link TEXT,
  UNIQUE(preformed_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_preformed_members_group ON public.preformed_group_members(preformed_group_id);
CREATE INDEX IF NOT EXISTS idx_preformed_members_user ON public.preformed_group_members(user_id);

CREATE TABLE IF NOT EXISTS public.group_shortlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preformed_group_id UUID REFERENCES public.preformed_groups(id) ON DELETE CASCADE,
  listing_id UUID,
  added_by UUID REFERENCES auth.users(id),
  notes TEXT,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(preformed_group_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_group ON public.group_shortlist(preformed_group_id);

ALTER TABLE public.preformed_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preformed_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_shortlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY preformed_groups_select ON public.preformed_groups
  FOR SELECT USING (true);

CREATE POLICY preformed_groups_insert ON public.preformed_groups
  FOR INSERT WITH CHECK (auth.uid() = group_lead_id);

CREATE POLICY preformed_groups_update ON public.preformed_groups
  FOR UPDATE USING (auth.uid() = group_lead_id);

CREATE POLICY preformed_groups_delete ON public.preformed_groups
  FOR DELETE USING (auth.uid() = group_lead_id);

CREATE POLICY preformed_members_select ON public.preformed_group_members
  FOR SELECT USING (true);

CREATE POLICY preformed_members_insert ON public.preformed_group_members
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT group_lead_id FROM public.preformed_groups WHERE id = preformed_group_id
    )
    OR auth.uid() = user_id
  );

CREATE POLICY preformed_members_update ON public.preformed_group_members
  FOR UPDATE USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT group_lead_id FROM public.preformed_groups WHERE id = preformed_group_id
    )
  );

CREATE POLICY preformed_members_delete ON public.preformed_group_members
  FOR DELETE USING (
    auth.uid() IN (
      SELECT group_lead_id FROM public.preformed_groups WHERE id = preformed_group_id
    )
  );

CREATE POLICY shortlist_select ON public.group_shortlist
  FOR SELECT USING (true);

CREATE POLICY shortlist_insert ON public.group_shortlist
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT pgm.user_id FROM public.preformed_group_members pgm
      WHERE pgm.preformed_group_id = group_shortlist.preformed_group_id AND pgm.status = 'joined'
    )
    OR auth.uid() IN (
      SELECT group_lead_id FROM public.preformed_groups WHERE id = preformed_group_id
    )
  );

CREATE POLICY shortlist_delete ON public.group_shortlist
  FOR DELETE USING (
    auth.uid() = added_by
    OR auth.uid() IN (
      SELECT group_lead_id FROM public.preformed_groups WHERE id = preformed_group_id
    )
  );

UPDATE public.profiles
SET listing_type_preference = 'room'
WHERE listing_type_preference IS NULL
  AND (SELECT role FROM auth.users WHERE id = profiles.user_id) = 'renter';
