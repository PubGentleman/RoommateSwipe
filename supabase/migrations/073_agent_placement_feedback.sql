CREATE TABLE IF NOT EXISTS agent_placement_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  still_together BOOLEAN DEFAULT true,
  months_elapsed INTEGER DEFAULT 0,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_placement_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own feedback"
  ON agent_placement_feedback FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own feedback"
  ON agent_placement_feedback FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own feedback"
  ON agent_placement_feedback FOR UPDATE
  USING (agent_id = auth.uid());

CREATE UNIQUE INDEX idx_apf_placement ON agent_placement_feedback(placement_id);
CREATE INDEX idx_apf_agent ON agent_placement_feedback(agent_id);
