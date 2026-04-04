ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence_paths TEXT[] DEFAULT '{}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'low'
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS moderator_id UUID REFERENCES auth.users(id);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS auto_hidden BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS auto_hidden_reason TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_restricted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_severity_status ON reports(severity, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id, reported_type);

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-evidence', 'report-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload report evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'report-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view report evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-evidence');

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reported_id_fkey;

DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update reports" ON reports;
CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
