-- Instagram verification fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS instagram_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMPTZ;

-- Space photos — separate array for room/apartment photos
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS space_photos TEXT[] DEFAULT '{}';

-- Profile completeness view used by the swipe deck query
-- A profile is "live" only if it has >= 3 total photos
CREATE OR REPLACE VIEW live_profiles AS
SELECT *
FROM profiles
WHERE
  (array_length(photos, 1) >= 3)
  AND full_name IS NOT NULL
  AND budget_min IS NOT NULL;
