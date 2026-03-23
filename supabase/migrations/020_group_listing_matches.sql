CREATE TABLE IF NOT EXISTS public.group_listing_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL,
  score_breakdown JSONB,
  host_notified_at TIMESTAMPTZ,
  host_viewed_at TIMESTAMPTZ,
  unlock_status TEXT DEFAULT 'locked'
    CHECK (unlock_status IN ('locked', 'unlocked', 'expired')),
  unlock_paid_at TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  unlock_fee_cents INTEGER DEFAULT 2900,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, listing_id)
);

ALTER TABLE public.group_listing_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts see matches for their listings"
  ON public.group_listing_matches FOR SELECT
  USING (
    auth.uid() IN (
      SELECT host_id FROM public.listings
      WHERE id = group_listing_matches.listing_id
    )
  );

CREATE POLICY "Group members see their group matches"
  ON public.group_listing_matches FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.group_members
      WHERE group_id = group_listing_matches.group_id
    )
  );
