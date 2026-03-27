CREATE OR REPLACE FUNCTION increment_listing_invites(p_listing_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE listing_fill_pipeline
  SET
    total_invites_sent = total_invites_sent + 1,
    last_updated = NOW()
  WHERE listing_id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
