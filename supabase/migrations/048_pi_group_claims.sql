-- Pi Group Claims: host claims on ready groups (Task #9)
-- Separate migration to avoid schema drift if 047 was already applied

-- Pi Group Claims table
CREATE TABLE IF NOT EXISTS public.pi_group_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.pi_auto_groups(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT,
  is_free_claim BOOLEAN NOT NULL DEFAULT false,
  claim_price_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','withdrawn')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_pi_group_claims_group ON public.pi_group_claims(group_id);
CREATE INDEX IF NOT EXISTS idx_pi_group_claims_host ON public.pi_group_claims(host_id);
CREATE INDEX IF NOT EXISTS idx_pi_group_claims_status ON public.pi_group_claims(status);

-- Exclusive claim constraint: only one active claim per group at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_group_claims_exclusive_active
  ON public.pi_group_claims(group_id)
  WHERE status IN ('pending', 'accepted');

-- RLS policies for pi_group_claims
ALTER TABLE public.pi_group_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view their own claims" ON public.pi_group_claims
  FOR SELECT USING (host_id = auth.uid());

CREATE POLICY "Hosts can insert claims" ON public.pi_group_claims
  FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can update their own claims" ON public.pi_group_claims
  FOR UPDATE USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Extend pi_auto_groups SELECT policy to allow hosts to browse marketplace
-- Drop existing policy first, then recreate with host marketplace access
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.pi_auto_groups;

CREATE POLICY "Users can view groups they belong to or hosts browse marketplace" ON public.pi_auto_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pi_auto_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid()
    )
    OR (
      status IN ('ready', 'claimed')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('host', 'agent', 'company')
      )
    )
  );

-- Extend pi_auto_group_members SELECT policy to allow hosts with active claims
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.pi_auto_group_members;

CREATE POLICY "Users can view members of their groups or claimed hosts" ON public.pi_auto_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pi_auto_group_members m
      WHERE m.group_id = pi_auto_group_members.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pi_group_claims c
      WHERE c.group_id = pi_auto_group_members.group_id
        AND c.host_id = auth.uid()
        AND c.status IN ('pending', 'accepted')
    )
  );

-- Atomic claim function: only succeeds if group is still 'ready' and no active claim exists
-- SECURITY DEFINER to bypass RLS for UPDATE on pi_auto_groups
-- Always uses auth.uid() — ignores client-supplied host ID
CREATE OR REPLACE FUNCTION public.claim_pi_group(
  p_group_id UUID,
  p_host_id UUID DEFAULT NULL,
  p_listing_id TEXT DEFAULT NULL,
  p_confirm_paid BOOLEAN DEFAULT false,
  p_unused INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_claim_id UUID;
  v_group_status TEXT;
  v_host_id UUID;
  v_role TEXT;
  v_host_plan TEXT;
  v_host_type TEXT;
  v_agent_plan TEXT;
  v_free_per_month INTEGER;
  v_extra_price_cents INTEGER;
  v_free_used INTEGER;
  v_is_free BOOLEAN;
  v_price_cents INTEGER;
  v_month_start TIMESTAMPTZ;
BEGIN
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE user_id = v_host_id;

  IF v_role IS NULL OR v_role NOT IN ('host', 'agent', 'company') THEN
    RAISE EXCEPTION 'Only hosts, agents, and companies can claim groups';
  END IF;

  SELECT host_plan, host_type, agent_plan
  INTO v_host_plan, v_host_type, v_agent_plan
  FROM public.users
  WHERE id = v_host_id;

  IF v_host_type = 'agent' THEN
    CASE COALESCE(v_agent_plan, 'pay_per_use')
      WHEN 'pay_per_use' THEN v_free_per_month := 0; v_extra_price_cents := 2500;
      WHEN 'starter'     THEN v_free_per_month := 3; v_extra_price_cents := 2000;
      WHEN 'pro'         THEN v_free_per_month := 10; v_extra_price_cents := 1500;
      WHEN 'elite'       THEN v_free_per_month := 25; v_extra_price_cents := 1000;
      ELSE v_free_per_month := 0; v_extra_price_cents := 2500;
    END CASE;
  ELSIF v_host_type = 'company' THEN
    CASE COALESCE(REPLACE(v_host_plan, 'company_', ''), 'starter')
      WHEN 'starter'    THEN v_free_per_month := 10; v_extra_price_cents := 2000;
      WHEN 'pro'        THEN v_free_per_month := 30; v_extra_price_cents := 1000;
      WHEN 'enterprise' THEN v_free_per_month := -1; v_extra_price_cents := 0;
      ELSE v_free_per_month := 10; v_extra_price_cents := 2000;
    END CASE;
  ELSE
    IF COALESCE(v_host_plan, 'free') IN ('free', 'none') THEN
      RAISE EXCEPTION 'Plan does not support group claims. Please upgrade.';
    END IF;
    v_free_per_month := 0;
    v_extra_price_cents := 0;
  END IF;

  v_month_start := date_trunc('month', now());
  SELECT COUNT(*) INTO v_free_used
  FROM public.pi_group_claims
  WHERE host_id = v_host_id
    AND is_free_claim = true
    AND created_at >= v_month_start;

  IF v_free_per_month = -1 THEN
    v_is_free := true;
    v_price_cents := 0;
  ELSIF v_free_per_month > 0 AND v_free_used < v_free_per_month THEN
    v_is_free := true;
    v_price_cents := 0;
  ELSIF v_extra_price_cents > 0 THEN
    IF NOT p_confirm_paid THEN
      RAISE EXCEPTION 'PAID_CLAIM_REQUIRED:%;%', v_extra_price_cents,
        GREATEST(0, v_free_per_month - v_free_used);
    END IF;
    v_is_free := false;
    v_price_cents := v_extra_price_cents;
  ELSE
    RAISE EXCEPTION 'No claims remaining on your current plan.';
  END IF;

  SELECT status INTO v_group_status
  FROM public.pi_auto_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF v_group_status IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group_status != 'ready' THEN
    RAISE EXCEPTION 'Group is no longer available (status: %)', v_group_status;
  END IF;

  INSERT INTO public.pi_group_claims (group_id, host_id, listing_id, is_free_claim, claim_price_cents)
  VALUES (p_group_id, v_host_id, p_listing_id, v_is_free, v_price_cents)
  RETURNING id INTO v_claim_id;

  UPDATE public.pi_auto_groups
  SET status = 'claimed'
  WHERE id = p_group_id;

  RETURN v_claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.claim_pi_group FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pi_group TO authenticated;

-- Atomic release function: returns group to 'ready' and withdraws claim
-- SECURITY DEFINER to bypass RLS for UPDATE on pi_auto_groups
CREATE OR REPLACE FUNCTION public.release_pi_group(
  p_group_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_host_id UUID;
  v_rows INTEGER;
  v_role TEXT;
BEGIN
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE user_id = v_host_id;

  IF v_role IS NULL OR v_role NOT IN ('host', 'agent', 'company') THEN
    RAISE EXCEPTION 'Only hosts, agents, and companies can release groups';
  END IF;

  UPDATE public.pi_group_claims
  SET status = 'withdrawn', responded_at = now()
  WHERE group_id = p_group_id
    AND host_id = v_host_id
    AND status IN ('pending', 'accepted');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.pi_auto_groups
  SET status = 'ready'
  WHERE id = p_group_id
    AND status = 'claimed';

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.release_pi_group FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_pi_group TO authenticated;

-- Backfill columns for environments that already applied 047
ALTER TABLE public.pi_auto_groups
  ADD COLUMN IF NOT EXISTS amenity_preferences TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_preferences TEXT[] DEFAULT '{}';
