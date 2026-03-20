CREATE TABLE IF NOT EXISTS listing_views (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (listing_id, viewer_id, view_date)
);

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hosts_read_own_listing_views" ON listing_views
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM listings WHERE host_id = auth.uid()
    )
  );

CREATE POLICY "renters_insert_own_views" ON listing_views
  FOR INSERT WITH CHECK (viewer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_views_view_date ON listing_views(view_date);
