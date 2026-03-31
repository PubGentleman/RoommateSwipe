ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE public.listings
SET published_at = created_at
WHERE is_active = true AND published_at IS NULL;
