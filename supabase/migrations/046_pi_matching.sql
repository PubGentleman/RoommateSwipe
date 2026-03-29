-- Pi AI Matchmaker Foundation Tables
-- Supports: match insights, deck re-ranking, host matchmaker, usage tracking

-- Add Pi-specific columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ideal_roommate_text TEXT,
  ADD COLUMN IF NOT EXISTS pi_parsed_preferences JSONB;

-- Pi Match Insights: cached AI-generated compatibility narratives
CREATE TABLE IF NOT EXISTS public.pi_match_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_score INTEGER,
  summary TEXT NOT NULL,
  highlights JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  confidence TEXT CHECK (confidence IN ('strong', 'good', 'moderate', 'low')),
  model_used TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_match_insights_user
  ON public.pi_match_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_match_insights_target
  ON public.pi_match_insights(target_user_id);
CREATE INDEX IF NOT EXISTS idx_pi_match_insights_expires
  ON public.pi_match_insights(expires_at);

-- Pi Deck Rankings: cached AI re-ranked swipe deck orderings
CREATE TABLE IF NOT EXISTS public.pi_deck_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranked_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  adjustments JSONB DEFAULT '[]'::jsonb,
  model_used TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  swiped_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pi_deck_rankings_user
  ON public.pi_deck_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_deck_rankings_expires
  ON public.pi_deck_rankings(expires_at);

-- Pi Host Recommendations: AI-generated renter/group recommendations for listings
CREATE TABLE IF NOT EXISTS public.pi_host_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  market_insight TEXT,
  model_used TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (host_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_host_recs_host
  ON public.pi_host_recommendations(host_id);
CREATE INDEX IF NOT EXISTS idx_pi_host_recs_listing
  ON public.pi_host_recommendations(listing_id);
CREATE INDEX IF NOT EXISTS idx_pi_host_recs_expires
  ON public.pi_host_recommendations(expires_at);

-- Pi Usage Log: tracks all AI calls for quota enforcement
CREATE TABLE IF NOT EXISTS public.pi_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('match_insight', 'deck_rerank', 'parse_preferences', 'host_matchmaker')),
  tokens_used INTEGER DEFAULT 0,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pi_usage_log_user
  ON public.pi_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_usage_log_user_date
  ON public.pi_usage_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pi_usage_log_feature
  ON public.pi_usage_log(feature);

-- Row Level Security
ALTER TABLE public.pi_match_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pi_deck_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pi_host_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pi_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own match insights"
  ON public.pi_match_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage match insights"
  ON public.pi_match_insights FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own deck rankings"
  ON public.pi_deck_rankings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage deck rankings"
  ON public.pi_deck_rankings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can update their own deck ranking swiped count"
  ON public.pi_deck_rankings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts can view their own recommendations"
  ON public.pi_host_recommendations FOR SELECT
  USING (auth.uid() = host_id);

CREATE POLICY "Service role can manage host recommendations"
  ON public.pi_host_recommendations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own usage log"
  ON public.pi_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage log"
  ON public.pi_usage_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage log"
  ON public.pi_usage_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can delete their own match insights"
  ON public.pi_match_insights FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "Users can delete their own deck rankings"
  ON public.pi_deck_rankings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts can delete their own recommendations"
  ON public.pi_host_recommendations FOR DELETE
  USING (auth.uid() = host_id);
