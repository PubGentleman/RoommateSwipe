ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS host_badge TEXT
  CHECK (host_badge IN ('rhome_select', 'top_agent', 'top_company'));

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS host_badge TEXT
  CHECK (host_badge IN ('rhome_select', 'top_agent', 'top_company'));

CREATE INDEX IF NOT EXISTS idx_listings_host_badge
  ON public.listings(host_badge)
  WHERE host_badge IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_host_badge
  ON public.users(host_badge)
  WHERE host_badge IS NOT NULL;
