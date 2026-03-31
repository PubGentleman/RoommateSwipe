ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS accept_agent_offers BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_accept_agent_offers
  ON public.users(accept_agent_offers)
  WHERE accept_agent_offers = false;
