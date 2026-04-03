CREATE TABLE IF NOT EXISTS boost_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  boost_id UUID,
  viewer_id UUID,
  impression_type TEXT NOT NULL DEFAULT 'card_view' CHECK (impression_type IN ('card_view', 'detail_view', 'search_result')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_boost_impressions_listing ON boost_impressions(listing_id);
CREATE INDEX idx_boost_impressions_boost ON boost_impressions(boost_id);
CREATE INDEX idx_boost_impressions_created ON boost_impressions(created_at);

ALTER TABLE boost_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view impressions for their own listings"
  ON boost_impressions FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert impressions"
  ON boost_impressions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
