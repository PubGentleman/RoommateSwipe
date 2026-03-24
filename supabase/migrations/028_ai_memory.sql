CREATE TABLE IF NOT EXISTS user_ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  budget_stated INTEGER,
  move_in_timeline TEXT,
  dealbreakers TEXT[],
  must_haves TEXT[],
  preferred_neighborhoods TEXT[],
  preferred_trains TEXT[],
  work_schedule TEXT,
  social_preference TEXT,
  cleanliness_stated INTEGER,
  swipe_right_count INTEGER DEFAULT 0,
  swipe_left_count INTEGER DEFAULT 0,
  avg_compatibility_right NUMERIC(4,1),
  common_occupation_interest TEXT,
  memory_notes TEXT[],
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own memory" ON user_ai_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages memory" ON user_ai_memory
  FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS match_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_profile_id UUID NOT NULL,
  explanation TEXT NOT NULL,
  compatibility_score INTEGER,
  top_reasons TEXT[],
  concerns TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE match_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own explanations" ON match_explanations
  FOR SELECT USING (auth.uid() = requester_id);

CREATE INDEX IF NOT EXISTS idx_match_explanations_requester ON match_explanations(requester_id, target_profile_id);
