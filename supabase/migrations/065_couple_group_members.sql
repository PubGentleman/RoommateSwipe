-- Migration 065: Add couple support to group_members
-- A couple is stored as a single member entry with is_couple = true
-- They share one bedroom, so they count as 1 unit for room matching

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_couple boolean DEFAULT false;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS partner_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
