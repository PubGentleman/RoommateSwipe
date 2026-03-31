ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_neighborhoods TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealbreakers TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ideal_roommate_text TEXT;
