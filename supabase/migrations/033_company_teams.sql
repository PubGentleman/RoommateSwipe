ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS full_name_owner TEXT;

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_company ON team_members(company_user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_see_team" ON public.team_members
  FOR SELECT USING (company_user_id = auth.uid());

CREATE POLICY "member_see_own" ON public.team_members
  FOR SELECT USING (member_user_id = auth.uid());

CREATE POLICY "owner_invite" ON public.team_members
  FOR INSERT WITH CHECK (company_user_id = auth.uid());

CREATE POLICY "owner_update" ON public.team_members
  FOR UPDATE USING (company_user_id = auth.uid());
