-- 1. Expand role check to include 'agent'
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'agent'));

-- 2. Add agent-specific fields to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS agent_license_number TEXT,
  ADD COLUMN IF NOT EXISTS agent_specialties TEXT[];

-- 3. Add parent_company_id to users table so agent accounts link back to company
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_parent_company ON public.users(parent_company_id);
