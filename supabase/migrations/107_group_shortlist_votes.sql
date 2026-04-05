CREATE TABLE IF NOT EXISTS public.group_shortlist_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_item_id UUID NOT NULL REFERENCES public.group_shortlist(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  voted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shortlist_item_id, user_id)
);

ALTER TABLE public.group_shortlist_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_shortlist_votes_select" ON public.group_shortlist_votes
  FOR SELECT USING (true);

CREATE POLICY "group_shortlist_votes_insert" ON public.group_shortlist_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group_shortlist_votes_update" ON public.group_shortlist_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "group_shortlist_votes_delete" ON public.group_shortlist_votes
  FOR DELETE USING (auth.uid() = user_id);
