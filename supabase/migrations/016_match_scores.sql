CREATE TABLE IF NOT EXISTS public.match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_match_scores_user ON public.match_scores(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_match_scores_target ON public.match_scores(target_id);

ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own match scores"
  ON public.match_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage match scores"
  ON public.match_scores FOR ALL
  USING (auth.role() = 'service_role');
