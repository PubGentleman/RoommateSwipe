ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE public.listings
SET published_at = created_at
WHERE status = 'active' AND published_at IS NULL;

UPDATE public.listings
SET status = 'active'
WHERE is_active = true AND (status IS NULL OR status = '');
