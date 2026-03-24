CREATE TABLE IF NOT EXISTS existing_roommates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  first_name TEXT,
  age INTEGER,
  occupation TEXT,
  sleep_schedule TEXT CHECK (sleep_schedule IN ('early_bird','night_owl','flexible')),
  cleanliness INTEGER CHECK (cleanliness BETWEEN 1 AND 5),
  smoking BOOLEAN DEFAULT FALSE,
  pets BOOLEAN DEFAULT FALSE,
  lifestyle_tags TEXT[] DEFAULT '{}',
  guests_frequency TEXT CHECK (guests_frequency IN ('rarely','sometimes','often')),
  noise_level TEXT CHECK (noise_level IN ('quiet','moderate','lively')),
  profile_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE existing_roommates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host manages their existing roommates" ON existing_roommates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = existing_roommates.listing_id
        AND listings.host_id = auth.uid()
    )
  );


CREATE INDEX IF NOT EXISTS idx_existing_roommates_token ON existing_roommates(invite_token);
CREATE INDEX IF NOT EXISTS idx_existing_roommates_listing ON existing_roommates(listing_id);
