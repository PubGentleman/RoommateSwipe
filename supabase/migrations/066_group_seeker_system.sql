-- Migration 066: Apartment Seeker Group System
-- Adds email/phone invites, shared listing likes, tour events, and RSVPs
-- All new tables use preformed_groups as the group reference (apartment seeker groups)

-- 1. Extend group_invites with email/phone/code fields
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS invite_email text;
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS invite_phone text;
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS is_couple boolean DEFAULT false;
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'in_app';
ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';

-- 2. Group listing likes — tracks which group members liked which listings
CREATE TABLE IF NOT EXISTS group_listing_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES preformed_groups(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_listing_likes_group ON group_listing_likes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_listing_likes_listing ON group_listing_likes(listing_id);

-- 3. Group tour events
CREATE TABLE IF NOT EXISTS group_tour_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES preformed_groups(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id),
  created_by uuid REFERENCES auth.users(id),
  tour_date date NOT NULL,
  tour_time time NOT NULL,
  duration_minutes integer DEFAULT 30,
  location text,
  notes text,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_tour_events_group ON group_tour_events(group_id);

-- 4. Group tour RSVPs
CREATE TABLE IF NOT EXISTS group_tour_rsvps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id uuid REFERENCES group_tour_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  responded_at timestamptz,
  UNIQUE(tour_id, user_id)
);

-- 5. Enable RLS on new tables
ALTER TABLE group_listing_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tour_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tour_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_listing_likes
CREATE POLICY "Group members can view likes" ON group_listing_likes
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT group_id FROM preformed_group_members WHERE user_id = auth.uid() AND status = 'joined')
  );

CREATE POLICY "Authenticated users can insert likes" ON group_listing_likes
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    group_id IN (SELECT group_id FROM preformed_group_members WHERE user_id = auth.uid() AND status = 'joined')
  );

CREATE POLICY "Users can delete own likes" ON group_listing_likes
  FOR DELETE USING (user_id = auth.uid());

-- RLS policies for group_tour_events
CREATE POLICY "Group members can view tours" ON group_tour_events
  FOR SELECT USING (
    created_by = auth.uid() OR
    group_id IN (SELECT group_id FROM preformed_group_members WHERE user_id = auth.uid() AND status = 'joined')
  );

CREATE POLICY "Group members can create tours" ON group_tour_events
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    group_id IN (SELECT group_id FROM preformed_group_members WHERE user_id = auth.uid() AND status = 'joined')
  );

CREATE POLICY "Tour creator can update" ON group_tour_events
  FOR UPDATE USING (created_by = auth.uid());

-- RLS policies for group_tour_rsvps
CREATE POLICY "Group members can view RSVPs" ON group_tour_rsvps
  FOR SELECT USING (
    user_id = auth.uid() OR
    tour_id IN (
      SELECT te.id FROM group_tour_events te
      JOIN preformed_group_members pgm ON pgm.group_id = te.group_id
      WHERE pgm.user_id = auth.uid() AND pgm.status = 'joined'
    )
  );

CREATE POLICY "Users can manage own RSVPs" ON group_tour_rsvps
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own RSVPs" ON group_tour_rsvps
  FOR UPDATE USING (user_id = auth.uid());

-- 6. Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE group_listing_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE group_tour_rsvps;
