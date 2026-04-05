CREATE TABLE saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  notify_enabled BOOLEAN DEFAULT true,
  notify_frequency TEXT DEFAULT 'daily' CHECK (notify_frequency IN ('instant', 'daily', 'weekly')),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  new_match_count INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_notify ON saved_searches(notify_enabled, notify_frequency);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved searches" ON saved_searches
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE saved_search_seen_listings (
  saved_search_id UUID REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (saved_search_id, listing_id)
);

ALTER TABLE saved_search_seen_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own seen listings" ON saved_search_seen_listings
  FOR ALL USING (
    saved_search_id IN (
      SELECT id FROM saved_searches WHERE user_id = auth.uid()
    )
  );
