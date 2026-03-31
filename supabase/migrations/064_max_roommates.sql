ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_roommates integer DEFAULT NULL CHECK (max_roommates BETWEEN 1 AND 4);
