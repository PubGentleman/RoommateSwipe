CREATE TABLE IF NOT EXISTS public.agent_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, renter_id)
);

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS created_by_agent UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_assembled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_status TEXT DEFAULT 'assembling'
    CHECK (group_status IN ('assembling', 'invited', 'active', 'placed', 'dissolved'));

CREATE TABLE IF NOT EXISTS public.agent_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(renter_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.agent_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  placement_fee_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  placed_at TIMESTAMPTZ DEFAULT now(),
  billing_status TEXT DEFAULT 'pending'
    CHECK (billing_status IN ('pending', 'charged', 'failed', 'waived'))
);

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_onboarding_step_check
    CHECK (onboarding_step IN ('profile', 'hostType', 'plan', 'complete'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS host_type TEXT
    CHECK (host_type IN ('individual', 'agent', 'company'));

ALTER TABLE public.agent_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their shortlists"
  ON public.agent_shortlists FOR ALL
  USING (auth.uid() = agent_id);

CREATE POLICY "Renters see their own invites"
  ON public.agent_group_invites FOR SELECT
  USING (auth.uid() = renter_id);

CREATE POLICY "Agents manage invites they sent"
  ON public.agent_group_invites FOR ALL
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents see their placements"
  ON public.agent_placements FOR SELECT
  USING (auth.uid() = agent_id);
