-- Activity feed events table
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON public.activity_feed(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON public.activity_feed(user_id, read) WHERE read = FALSE;

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feed"
  ON public.activity_feed FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed events"
  ON public.activity_feed FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert any feed events"
  ON public.activity_feed FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Users can update own feed items"
  ON public.activity_feed FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger: auto-create feed event on new match
CREATE OR REPLACE FUNCTION create_match_feed_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_feed (user_id, event_type, title, body, metadata, action_url)
  VALUES (
    NEW.user_id_1,
    'new_match',
    'New Match!',
    'You matched with someone new',
    jsonb_build_object(
      'matchId', NEW.id,
      'otherUserId', NEW.user_id_2,
      'matchType', NEW.match_type,
      'compatibilityScore', NEW.compatibility_score
    ),
    '/match/' || NEW.id
  );

  INSERT INTO public.activity_feed (user_id, event_type, title, body, metadata, action_url)
  VALUES (
    NEW.user_id_2,
    'new_match',
    'New Match!',
    'You matched with someone new',
    jsonb_build_object(
      'matchId', NEW.id,
      'otherUserId', NEW.user_id_1,
      'matchType', NEW.match_type,
      'compatibilityScore', NEW.compatibility_score
    ),
    '/match/' || NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_match_feed_event
  AFTER INSERT ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'matched')
  EXECUTE FUNCTION create_match_feed_event();

-- Trigger: feed event when group gets a new member
CREATE OR REPLACE FUNCTION create_group_member_feed_event()
RETURNS TRIGGER AS $$
DECLARE
  grp_name TEXT;
  member_name TEXT;
  member_row RECORD;
BEGIN
  SELECT name INTO grp_name FROM public.groups WHERE id = NEW.group_id;
  SELECT full_name INTO member_name FROM public.users WHERE id = NEW.user_id;

  FOR member_row IN
    SELECT user_id FROM public.group_members
    WHERE group_id = NEW.group_id AND user_id != NEW.user_id AND status = 'active'
  LOOP
    INSERT INTO public.activity_feed (user_id, event_type, title, body, metadata, action_url)
    VALUES (
      member_row.user_id,
      'group_member_added',
      COALESCE(member_name, 'Someone') || ' joined ' || COALESCE(grp_name, 'your group'),
      'Your group has a new member!',
      jsonb_build_object(
        'groupId', NEW.group_id,
        'groupName', grp_name,
        'memberUserId', NEW.user_id,
        'memberName', member_name
      ),
      '/group/' || NEW.group_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_member_feed
  AFTER INSERT ON public.group_members
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION create_group_member_feed_event();
