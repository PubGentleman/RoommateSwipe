-- Safety Mode setting on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS safety_mode_enabled BOOLEAN DEFAULT FALSE;

-- Background checks table
CREATE TABLE IF NOT EXISTS background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'persona',
  provider_inquiry_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  check_type TEXT NOT NULL DEFAULT 'standard',
  identity_verified BOOLEAN DEFAULT FALSE,
  criminal_clear BOOLEAN DEFAULT FALSE,
  credit_score_range TEXT,
  report_url TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '12 months'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_checks_user_id ON background_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_background_checks_status ON background_checks(status);

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS requires_background_check BOOLEAN DEFAULT FALSE;

ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own checks" ON background_checks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own checks" ON background_checks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role updates" ON background_checks
  FOR UPDATE USING (true);

CREATE OR REPLACE VIEW public_background_badges AS
SELECT
  user_id,
  status,
  identity_verified,
  criminal_clear,
  credit_score_range,
  check_type,
  expires_at,
  completed_at
FROM background_checks
WHERE status = 'approved'
  AND expires_at > NOW();
