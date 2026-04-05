ALTER TABLE boost_impressions
  ADD COLUMN IF NOT EXISTS boost_type TEXT CHECK (boost_type IN ('quick', 'standard', 'extended')),
  ADD COLUMN IF NOT EXISTS section TEXT CHECK (section IN ('main_feed', 'top_picks', 'boosted_carousel', 'search'));

ALTER TABLE boost_impressions
  DROP CONSTRAINT IF EXISTS boost_impressions_impression_type_check;

ALTER TABLE boost_impressions
  ADD CONSTRAINT boost_impressions_impression_type_check
  CHECK (impression_type IN ('card_view', 'detail_view', 'search_result', 'carousel_view'));

CREATE INDEX IF NOT EXISTS idx_boost_impressions_type ON boost_impressions(listing_id, impression_type);

DROP POLICY IF EXISTS "Authenticated users can insert impressions" ON boost_impressions;
DROP POLICY IF EXISTS "Users can insert impressions" ON boost_impressions;
CREATE POLICY "Users can insert impressions"
  ON boost_impressions FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Hosts can view impressions for their own listings" ON boost_impressions;
DROP POLICY IF EXISTS "Hosts can read own listing impressions" ON boost_impressions;
CREATE POLICY "Hosts can read own listing impressions"
  ON boost_impressions FOR SELECT
  USING (listing_id IN (
    SELECT id FROM listings WHERE host_id = auth.uid()
  ));
