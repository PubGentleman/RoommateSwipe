CREATE TABLE IF NOT EXISTS public.ai_group_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  suggested_member_ids UUID[] NOT NULL,
  suggested_member_names TEXT[],
  avg_compatibility INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '48 hours'),
  notified_at TIMESTAMPTZ
);

ALTER TABLE public.ai_group_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own suggestions"
  ON public.ai_group_suggestions FOR ALL
  USING (auth.uid() = suggested_to_user_id);
