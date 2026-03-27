ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE VIEW profile_recency_scores AS
SELECT
  id AS user_id,
  last_active_at,
  CASE
    WHEN last_active_at >= NOW() - INTERVAL '3 days'  THEN 1.0
    WHEN last_active_at >= NOW() - INTERVAL '7 days'  THEN 0.8
    WHEN last_active_at >= NOW() - INTERVAL '14 days' THEN 0.5
    WHEN last_active_at >= NOW() - INTERVAL '30 days' THEN 0.2
    ELSE 0.0
  END AS recency_score
FROM users;
