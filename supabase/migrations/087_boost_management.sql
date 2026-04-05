CREATE TABLE IF NOT EXISTS boost_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  listing_title TEXT,
  boost_type TEXT NOT NULL CHECK (boost_type IN ('quick', 'standard', 'extended')),
  duration TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_free_boost BOOLEAN DEFAULT false,
  used_credit BOOLEAN DEFAULT false,
  price_paid_cents INTEGER DEFAULT 0,
  views_during INTEGER DEFAULT 0,
  inquiries_during INTEGER DEFAULT 0,
  saves_during INTEGER DEFAULT 0,
  views_before_7d INTEGER DEFAULT 0,
  inquiries_before_7d INTEGER DEFAULT 0,
  lift_percentage NUMERIC(5,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_boost_history_host ON boost_history(host_id, created_at DESC);
CREATE INDEX idx_boost_history_listing ON boost_history(listing_id, created_at DESC);

ALTER TABLE boost_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view own boost history"
  ON boost_history FOR SELECT
  USING (host_id = auth.uid());

CREATE POLICY "Hosts can insert own boost history"
  ON boost_history FOR INSERT
  WITH CHECK (host_id = auth.uid());

CREATE TABLE IF NOT EXISTS auto_boost_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  listing_title TEXT,
  boost_type TEXT NOT NULL CHECK (boost_type IN ('quick', 'standard', 'extended')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'every_3_days', 'weekly')),
  preferred_time TEXT DEFAULT '09:00',
  is_active BOOLEAN DEFAULT true,
  next_boost_at TIMESTAMPTZ,
  last_boosted_at TIMESTAMPTZ,
  credits_remaining INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE auto_boost_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can manage own schedules"
  ON auto_boost_schedules FOR ALL
  USING (host_id = auth.uid());
