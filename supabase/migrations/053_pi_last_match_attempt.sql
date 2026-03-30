ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pi_last_match_attempt TIMESTAMPTZ;
