CREATE TABLE listing_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'view', 'view_long', 'save', 'unsave', 'inquiry', 'share',
    'phone_call', 'apply', 'hide', 'report'
  )),
  source TEXT,
  view_duration_seconds INTEGER,
  listing_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_interactions_user ON listing_interactions(user_id, created_at DESC);
CREATE INDEX idx_listing_interactions_type ON listing_interactions(user_id, interaction_type);
CREATE INDEX idx_listing_interactions_listing ON listing_interactions(listing_id);

ALTER TABLE listing_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own interactions" ON listing_interactions
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE user_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  score FLOAT NOT NULL,
  reasons JSONB DEFAULT '[]',
  source TEXT NOT NULL CHECK (source IN ('behavioral', 'collaborative', 'content', 'trending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_user_recommendations ON user_recommendations(user_id, score DESC);

ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own recommendations" ON user_recommendations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recommendations" ON user_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own recommendations" ON user_recommendations
  FOR DELETE USING (auth.uid() = user_id);
