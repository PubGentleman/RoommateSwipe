-- Migration 031: Shareable profile notes ("In Their Own Words")

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_note TEXT,
ADD COLUMN IF NOT EXISTS profile_note_updated_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD CONSTRAINT profile_note_max_length CHECK (char_length(profile_note) <= 500);

CREATE INDEX IF NOT EXISTS idx_profiles_profile_note
  ON profiles USING gin(to_tsvector('english', COALESCE(profile_note, '')));

COMMENT ON COLUMN profiles.profile_note IS
  'User-written free text shown to potential matches and readable by AI when answering questions about this user. User controls content entirely.';
