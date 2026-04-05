CREATE TABLE match_weight_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  weight_location INTEGER DEFAULT 5 CHECK (weight_location BETWEEN 0 AND 10),
  weight_budget INTEGER DEFAULT 5 CHECK (weight_budget BETWEEN 0 AND 10),
  weight_sleep INTEGER DEFAULT 5 CHECK (weight_sleep BETWEEN 0 AND 10),
  weight_cleanliness INTEGER DEFAULT 5 CHECK (weight_cleanliness BETWEEN 0 AND 10),
  weight_smoking INTEGER DEFAULT 5 CHECK (weight_smoking BETWEEN 0 AND 10),
  weight_pets INTEGER DEFAULT 5 CHECK (weight_pets BETWEEN 0 AND 10),
  weight_lifestyle INTEGER DEFAULT 5 CHECK (weight_lifestyle BETWEEN 0 AND 10),
  weight_social INTEGER DEFAULT 5 CHECK (weight_social BETWEEN 0 AND 10),
  learned_weights JSONB DEFAULT '{}',
  total_swipes_analyzed INTEGER DEFAULT 0,
  last_recalculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE match_weight_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own weights" ON match_weight_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE swipe_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass', 'super_like')),
  total_score INTEGER,
  score_breakdown JSONB,
  resulted_in_match BOOLEAN DEFAULT false,
  resulted_in_conversation BOOLEAN DEFAULT false,
  conversation_message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_swipe_analytics_user ON swipe_analytics(user_id, created_at DESC);
CREATE INDEX idx_swipe_analytics_action ON swipe_analytics(user_id, action);

ALTER TABLE swipe_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own swipe analytics" ON swipe_analytics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own swipe analytics" ON swipe_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
