CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pi_auto_group_id UUID REFERENCES public.pi_auto_groups(id) ON DELETE CASCADE,
  preformed_group_id UUID REFERENCES public.preformed_groups(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'expired', 'withdrawn')),
  compatibility_score NUMERIC,
  pi_take TEXT,
  approved_by JSONB DEFAULT '[]',
  declined_by JSONB DEFAULT '[]',
  decided_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  requester_message TEXT,
  CHECK (
    (pi_auto_group_id IS NOT NULL AND preformed_group_id IS NULL)
    OR (pi_auto_group_id IS NULL AND preformed_group_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_pi_unique
  ON public.group_join_requests(pi_auto_group_id, requester_id)
  WHERE status IN ('pending');

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_preformed_unique
  ON public.group_join_requests(preformed_group_id, requester_id)
  WHERE status IN ('pending');

CREATE INDEX IF NOT EXISTS idx_join_requests_requester ON public.group_join_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_pi_group ON public.group_join_requests(pi_auto_group_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_preformed ON public.group_join_requests(preformed_group_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.group_join_requests(status);

ALTER TABLE public.pi_auto_groups
  ADD COLUMN IF NOT EXISTS open_to_requests BOOLEAN DEFAULT true;

ALTER TABLE public.preformed_groups
  ADD COLUMN IF NOT EXISTS open_to_requests BOOLEAN DEFAULT false;
