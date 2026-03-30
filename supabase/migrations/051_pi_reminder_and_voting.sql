ALTER TABLE public.pi_auto_group_members
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

ALTER TABLE public.pi_auto_group_members
  ADD COLUMN IF NOT EXISTS is_replacement BOOLEAN DEFAULT false;

ALTER TABLE public.pi_auto_group_members
  ADD COLUMN IF NOT EXISTS replacement_approved_by JSONB DEFAULT '[]';

ALTER TABLE public.pi_auto_group_members
  ADD COLUMN IF NOT EXISTS replacement_passed_by JSONB DEFAULT '[]';

ALTER TABLE public.pi_auto_group_members
  ADD COLUMN IF NOT EXISTS compatibility_with_group NUMERIC;

ALTER TABLE public.pi_auto_group_members
  ADD COLUMN IF NOT EXISTS pi_member_insight TEXT;
