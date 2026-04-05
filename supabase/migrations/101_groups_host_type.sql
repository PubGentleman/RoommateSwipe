ALTER TABLE groups ADD COLUMN IF NOT EXISTS host_type TEXT
  CHECK (host_type IN ('individual', 'company', 'agent'))
  DEFAULT 'individual';
