DELETE FROM listing_views a
USING listing_views b
WHERE a.id > b.id
  AND a.listing_id = b.listing_id
  AND a.viewer_id = b.viewer_id;

ALTER TABLE listing_views DROP CONSTRAINT IF EXISTS listing_views_listing_id_viewer_id_view_date_key;

ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 1;

UPDATE listing_views SET last_viewed_at = COALESCE(view_date::timestamptz, now()), view_count = 1
WHERE last_viewed_at IS NULL;

ALTER TABLE listing_views
  ADD CONSTRAINT unique_listing_viewer UNIQUE(listing_id, viewer_id);

CREATE INDEX IF NOT EXISTS idx_listing_views_first_viewed
  ON listing_views(listing_id, view_date);

DROP POLICY IF EXISTS "hosts_read_own_listing_views" ON listing_views;
CREATE POLICY "hosts_read_own_listing_views" ON listing_views
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM listings WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "renters_read_own_views" ON listing_views
  FOR SELECT USING (viewer_id = auth.uid());

CREATE OR REPLACE FUNCTION record_listing_view(
  p_listing_id uuid,
  p_viewer_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  is_new boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM listings WHERE id = p_listing_id AND created_by = p_viewer_id
  ) INTO is_owner;

  IF is_owner THEN
    RETURN false;
  END IF;

  INSERT INTO listing_views (listing_id, viewer_id, view_date, last_viewed_at, view_count)
  VALUES (p_listing_id, p_viewer_id, CURRENT_DATE, now(), 1)
  ON CONFLICT (listing_id, viewer_id)
  DO UPDATE SET
    last_viewed_at = now(),
    view_count = listing_views.view_count + 1;

  GET DIAGNOSTICS is_new = ROW_COUNT;
  RETURN is_new;
END;
$$;

CREATE OR REPLACE VIEW listing_view_stats AS
SELECT
  listing_id,
  COUNT(DISTINCT viewer_id) AS unique_viewers,
  SUM(view_count) AS total_impressions,
  MIN(view_date) AS first_view_date,
  MAX(last_viewed_at) AS last_view_at,
  COUNT(DISTINCT viewer_id) FILTER (
    WHERE view_date >= CURRENT_DATE - interval '30 days'
  ) AS viewers_last_30,
  COUNT(DISTINCT viewer_id) FILTER (
    WHERE view_date >= CURRENT_DATE - interval '7 days'
  ) AS viewers_last_7
FROM listing_views
GROUP BY listing_id;
