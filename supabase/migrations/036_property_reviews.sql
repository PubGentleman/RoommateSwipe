CREATE TABLE IF NOT EXISTS public.property_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  tags TEXT[] DEFAULT '{}',
  host_reply TEXT,
  host_replied_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, reviewer_id)
);

ALTER TABLE public.property_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON public.property_reviews FOR SELECT USING (true);

CREATE POLICY "Reviewer can insert own review"
  ON public.property_reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewer can update own review text and tags within 24 hours"
  ON public.property_reviews FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours'
    AND host_reply IS NOT DISTINCT FROM (SELECT host_reply FROM public.property_reviews pr WHERE pr.id = property_reviews.id)
  );

CREATE POLICY "Host can update reply on their listing reviews"
  ON public.property_reviews FOR UPDATE
  USING (
    listing_id IN (
      SELECT id FROM public.listings WHERE host_id = auth.uid()
    )
    AND rating = (SELECT rating FROM public.property_reviews pr WHERE pr.id = property_reviews.id)
    AND review_text IS NOT DISTINCT FROM (SELECT review_text FROM public.property_reviews pr WHERE pr.id = property_reviews.id)
    AND tags = (SELECT tags FROM public.property_reviews pr WHERE pr.id = property_reviews.id)
  );

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(2,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_helpful_count(review_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.property_reviews
  SET helpful_count = helpful_count + 1
  WHERE id = review_id;
END;
$$;
