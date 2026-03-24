CREATE TABLE IF NOT EXISTS daily_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_category text NOT NULL DEFAULT 'lifestyle',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_value text,
  answered_at timestamptz,
  used_in_matching boolean DEFAULT false,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX idx_daily_questions_user_id ON daily_questions(user_id);
CREATE INDEX idx_daily_questions_expires_at ON daily_questions(expires_at);
CREATE INDEX idx_daily_questions_user_active ON daily_questions(user_id, expires_at DESC);

ALTER TABLE daily_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily questions"
  ON daily_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily questions"
  ON daily_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily questions"
  ON daily_questions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access daily questions"
  ON daily_questions FOR ALL
  USING (auth.role() = 'service_role');
