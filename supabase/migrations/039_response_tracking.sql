-- Migration 039: Agent Response Tracking & Company Alerts
-- Adds response tracking columns to matches (conversation threads) and users

-- Add response tracking columns to matches table (conversations are derived from matches)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_renter_message_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_agent_response_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS response_status TEXT DEFAULT 'active' CHECK (response_status IN ('active', 'delayed', 'unresponsive', 'critical'));

-- Add response_rate to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS response_rate NUMERIC(5,2) DEFAULT 100.00;

-- Index for efficient response status queries
CREATE INDEX IF NOT EXISTS idx_matches_response_status ON matches(response_status) WHERE response_status != 'active';
CREATE INDEX IF NOT EXISTS idx_users_response_rate ON users(response_rate);
