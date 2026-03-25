ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS license_state TEXT,
  ADD COLUMN IF NOT EXISTS license_document_url TEXT,
  ADD COLUMN IF NOT EXISTS license_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS license_verification_status TEXT DEFAULT 'unverified'
    CHECK (license_verification_status IN ('unverified', 'pending', 'verified', 'failed', 'manual_review'));
