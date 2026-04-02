CREATE TABLE IF NOT EXISTS public.host_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  tags TEXT[] DEFAULT '{}',
  host_reply TEXT,
  host_replied_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(host_id, reviewer_id)
);

ALTER TABLE public.host_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read host reviews"
  ON public.host_reviews FOR SELECT USING (true);

CREATE POLICY "Reviewer can insert own host review"
  ON public.host_reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewer can update own host review within 24 hours"
  ON public.host_reviews FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
    AND host_reply IS NOT DISTINCT FROM (SELECT host_reply FROM public.host_reviews hr WHERE hr.id = host_reviews.id)
  );

CREATE POLICY "Host can reply to their own reviews"
  ON public.host_reviews FOR UPDATE
  USING (
    host_id = auth.uid()
    AND rating = (SELECT rating FROM public.host_reviews hr WHERE hr.id = host_reviews.id)
    AND review_text IS NOT DISTINCT FROM (SELECT review_text FROM public.host_reviews hr WHERE hr.id = host_reviews.id)
    AND tags = (SELECT tags FROM public.host_reviews hr WHERE hr.id = host_reviews.id)
  );

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS host_avg_rating NUMERIC(2,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS host_review_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_host_review_helpful(review_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.host_reviews
  SET helpful_count = helpful_count + 1
  WHERE id = review_id;
END;
$$;
