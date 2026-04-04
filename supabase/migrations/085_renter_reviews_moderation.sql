CREATE TABLE IF NOT EXISTS renter_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  renter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID,
  match_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged', 'removed')),
  renter_reply TEXT,
  renter_replied_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_renter_reviews_unique
  ON renter_reviews(reviewer_id, renter_id, COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_renter_reviews_renter ON renter_reviews(renter_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_renter_reviews_reviewer ON renter_reviews(reviewer_id);

ALTER TABLE renter_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published renter reviews"
  ON renter_reviews FOR SELECT
  USING (status = 'published');

CREATE POLICY "Hosts can create renter reviews"
  ON renter_reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewers can update own review within 24h"
  ON renter_reviews FOR UPDATE
  USING (
    (reviewer_id = auth.uid() AND created_at > now() - interval '24 hours')
    OR (renter_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS review_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('property', 'host', 'renter')),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'fake', 'harassment', 'inappropriate', 'spam', 'conflict_of_interest', 'other'
  )),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'upheld', 'dismissed')),
  moderator_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, reporter_id)
);

ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report reviews"
  ON review_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view own reports"
  ON review_reports FOR SELECT
  USING (reporter_id = auth.uid());

ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_avg_rating NUMERIC(2,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_review_count INTEGER DEFAULT 0;

ALTER TABLE property_reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
  CHECK (status IN ('published', 'hidden', 'flagged', 'removed'));

ALTER TABLE host_reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
  CHECK (status IN ('published', 'hidden', 'flagged', 'removed'));
