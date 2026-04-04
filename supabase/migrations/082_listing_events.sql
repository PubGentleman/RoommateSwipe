CREATE TABLE listing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'save', 'unsave', 'inquiry', 'share', 'boost_impression')),
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listing_events_listing ON listing_events(listing_id, event_type, created_at);
CREATE INDEX idx_listing_events_created ON listing_events(created_at);

ALTER TABLE listing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view own listing events"
  ON listing_events FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM properties WHERE host_id = auth.uid()
        OR assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert own events"
  ON listing_events FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (viewer_id IS NULL OR viewer_id = auth.uid())
  );
