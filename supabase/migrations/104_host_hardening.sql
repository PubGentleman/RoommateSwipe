-- Migration 104: Host-side hardening — team seat limits + performance indexes

-- Team seat limit enforcement trigger
CREATE OR REPLACE FUNCTION check_team_seat_limit()
RETURNS TRIGGER AS $$
DECLARE
  seat_limit INTEGER;
  current_count INTEGER;
  company_plan TEXT;
BEGIN
  SELECT host_plan INTO company_plan
  FROM users WHERE id = NEW.company_user_id;

  seat_limit := CASE company_plan
    WHEN 'company_starter' THEN 5
    WHEN 'company_pro' THEN 15
    WHEN 'company_enterprise' THEN 999
    ELSE 0
  END;

  SELECT COUNT(*) INTO current_count
  FROM team_members
  WHERE company_user_id = NEW.company_user_id
    AND status IN ('active', 'pending');

  IF current_count >= seat_limit THEN
    RAISE EXCEPTION 'Team seat limit reached for plan %', company_plan;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_team_seat_limit'
  ) THEN
    CREATE TRIGGER enforce_team_seat_limit
      BEFORE INSERT ON team_members
      FOR EACH ROW
      EXECUTE FUNCTION check_team_seat_limit();
  END IF;
END $$;

-- Performance indexes for host queries
CREATE INDEX IF NOT EXISTS idx_listings_host_active
  ON listings (host_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_group_listing_matches_score
  ON group_listing_matches (listing_id, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_pi_group_claims_monthly
  ON pi_group_claims (host_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_host_outreach_daily
  ON host_outreach_log (host_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_placements_billing
  ON agent_placements (agent_id, billing_status);
