CREATE TABLE IF NOT EXISTS group_shortlist_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shortlist_item_id UUID NOT NULL REFERENCES group_shortlist(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL DEFAULT 1,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shortlist_item_id, user_id)
);

ALTER TABLE group_shortlist_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see group votes"
ON group_shortlist_votes FOR SELECT
USING (
  shortlist_item_id IN (
    SELECT gs.id FROM group_shortlist gs
    JOIN group_members gm ON gm.group_id = gs.preformed_group_id
    WHERE gm.user_id = auth.uid() AND gm.status = 'active'
  )
);

CREATE POLICY "Members can vote"
ON group_shortlist_votes FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can change vote"
ON group_shortlist_votes FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can remove vote"
ON group_shortlist_votes FOR DELETE
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION increment_vote_count(item_id UUID, delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE group_shortlist
  SET vote_count = COALESCE(vote_count, 0) + delta
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
