-- Add active_mode column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS active_mode TEXT NOT NULL DEFAULT 'renter'
  CHECK (active_mode IN ('renter', 'host'));

-- Track whether user has completed host onboarding
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS has_completed_host_onboarding BOOLEAN DEFAULT false;

-- Subscription tier tracking (derived from entitlements)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS host_tier TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS renter_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_source TEXT DEFAULT 'none';

-- Agents and companies are always in host mode
-- Individual users default to renter mode unless they have an active host subscription
