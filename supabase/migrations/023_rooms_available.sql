-- Add host_lives_in (if not exists), existing_roommates_count, and computed rooms_available
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS host_lives_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS existing_roommates_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS rooms_available INTEGER GENERATED ALWAYS AS (
    bedrooms - CASE WHEN host_lives_in THEN 1 ELSE 0 END - existing_roommates_count
  ) STORED;

ALTER TABLE listings ADD CONSTRAINT rooms_available_positive CHECK (
  (bedrooms - CASE WHEN host_lives_in THEN 1 ELSE 0 END - existing_roommates_count) >= 1
);

CREATE INDEX IF NOT EXISTS idx_listings_rooms_available ON listings(rooms_available);
