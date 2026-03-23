ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agent_plan TEXT DEFAULT 'pay_per_use'
    CHECK (agent_plan IN ('pay_per_use', 'starter', 'pro', 'business'));

ALTER TABLE public.match_scores
  ADD COLUMN IF NOT EXISTS breakdown JSONB DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'match_scores_user_pair_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.match_scores
        ADD CONSTRAINT match_scores_user_pair_unique UNIQUE (user_id, target_id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
