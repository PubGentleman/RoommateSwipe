CREATE TABLE IF NOT EXISTS public.company_shortlisted_renters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  notes TEXT,
  shortlisted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_host_id, renter_id, listing_id)
);

ALTER TABLE public.company_shortlisted_renters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company hosts manage their shortlist" ON public.company_shortlisted_renters
  FOR ALL USING (auth.uid() = company_host_id);

CREATE TABLE IF NOT EXISTS public.company_group_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  ai_reason TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(listing_id, group_id)
);

ALTER TABLE public.company_group_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company host manages invites" ON public.company_group_invites
  FOR ALL USING (auth.uid() = company_host_id);
CREATE POLICY "Group members view their invites" ON public.company_group_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = company_group_invites.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.listing_fill_pipeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE UNIQUE,
  days_vacant INTEGER DEFAULT 0,
  total_groups_matched INTEGER DEFAULT 0,
  total_invites_sent INTEGER DEFAULT 0,
  best_match_score INTEGER DEFAULT 0,
  projected_fill_date DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.listing_fill_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host views their pipeline" ON public.listing_fill_pipeline
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.listings WHERE listings.id = listing_fill_pipeline.listing_id
        AND listings.host_id = auth.uid()
    )
  );
