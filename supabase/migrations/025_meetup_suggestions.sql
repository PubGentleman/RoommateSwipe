CREATE TABLE IF NOT EXISTS meetup_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('phone_detected', 'instagram_detected', 'ai_detected')),
  confidence_score INTEGER DEFAULT 0,
  suggested_venue_name TEXT,
  suggested_venue_address TEXT,
  suggested_venue_maps_url TEXT,
  midpoint_neighborhood TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted_both', 'accepted_one', 'dismissed')),
  user_1_response TEXT CHECK (user_1_response IN ('yes', 'no', 'maybe')),
  user_2_response TEXT CHECK (user_2_response IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id)
);

ALTER TABLE meetup_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own meetup suggestions" ON meetup_suggestions
  FOR SELECT USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users update their own meetup suggestions" ON meetup_suggestions
  FOR UPDATE USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE INDEX IF NOT EXISTS idx_meetup_conversation ON meetup_suggestions(conversation_id);
