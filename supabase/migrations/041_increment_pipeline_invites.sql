CREATE OR REPLACE FUNCTION increment_pipeline_invites(p_listing_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO listing_fill_pipeline (listing_id, total_invites_sent, last_updated)
  VALUES (p_listing_id, 1, NOW())
  ON CONFLICT (listing_id)
  DO UPDATE SET
    total_invites_sent = listing_fill_pipeline.total_invites_sent + 1,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;
