INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('license-documents', 'license-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own license documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'license-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own license documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'license-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own license documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'license-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own license documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'license-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
