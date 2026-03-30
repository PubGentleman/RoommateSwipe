-- Pi Auto-Match Tables and Columns
-- Task #6/#7/#8: Auto-match groups, members, and conversion linkage

-- Pi Auto Groups: assembled by Pi matchmaker
CREATE TABLE IF NOT EXISTS public.pi_auto_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming','pending_acceptance','partial','ready','invited','claimed','placed','expired','dissolved')),
  anchor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  match_score INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 2,
  desired_bedrooms INTEGER DEFAULT 0,
  budget_min NUMERIC DEFAULT 0,
  budget_max NUMERIC DEFAULT 0,
  city TEXT,
  state TEXT,
  neighborhoods TEXT[] DEFAULT '{}',
  gender_composition TEXT,
  move_in_window_start DATE,
  move_in_window_end DATE,
  pi_rationale TEXT,
  model_used TEXT,
  acceptance_deadline TIMESTAMPTZ,
  deadline_extended BOOLEAN DEFAULT NULL,
  claim_price_cents INTEGER,
  listing_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  dissolved_at TIMESTAMPTZ,
  amenity_preferences TEXT[] DEFAULT '{}',
  location_preferences TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pi_auto_groups_status ON public.pi_auto_groups(status);
CREATE INDEX IF NOT EXISTS idx_pi_auto_groups_anchor ON public.pi_auto_groups(anchor_user_id);

-- Pi Auto Group Members
CREATE TABLE IF NOT EXISTS public.pi_auto_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.pi_auto_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'anchor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','left')),
  compatibility_score INTEGER,
  pi_reason TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_auto_group_members_group ON public.pi_auto_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pi_auto_group_members_user ON public.pi_auto_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_auto_group_members_status ON public.pi_auto_group_members(user_id, status);

-- Add pi_auto_group_id to groups for conversion linkage
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS pi_auto_group_id UUID REFERENCES public.pi_auto_groups(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_pi_auto_group_id
  ON public.groups(pi_auto_group_id)
  WHERE pi_auto_group_id IS NOT NULL;

-- Add auto-match preference columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS desired_roommate_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desired_bedroom_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS household_gender_preference TEXT DEFAULT 'any'
    CHECK (household_gender_preference IN ('any', 'same_gender', 'male_only', 'female_only')),
  ADD COLUMN IF NOT EXISTS pi_auto_match_enabled BOOLEAN DEFAULT true;

-- RLS policies for pi_auto_groups
ALTER TABLE public.pi_auto_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groups they belong to" ON public.pi_auto_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pi_auto_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid()
    )
  );

-- RLS policies for pi_auto_group_members
ALTER TABLE public.pi_auto_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their groups" ON public.pi_auto_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pi_auto_group_members m
      WHERE m.group_id = pi_auto_group_members.group_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own membership" ON public.pi_auto_group_members
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
