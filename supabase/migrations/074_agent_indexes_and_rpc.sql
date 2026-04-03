CREATE INDEX IF NOT EXISTS idx_agent_shortlists_agent_renter
  ON agent_shortlists (agent_id, renter_id);

CREATE INDEX IF NOT EXISTS idx_groups_created_by_agent
  ON groups (created_by_agent) WHERE created_by_agent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_groups_agent_assembled
  ON groups (agent_assembled) WHERE agent_assembled = true;

CREATE INDEX IF NOT EXISTS idx_agent_group_invites_renter
  ON agent_group_invites (renter_id);

CREATE INDEX IF NOT EXISTS idx_agent_group_invites_group_status
  ON agent_group_invites (group_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_placements_agent
  ON agent_placements (agent_id, placed_at DESC);

ALTER TABLE agent_shortlists
  ADD CONSTRAINT agent_shortlists_agent_renter_unique
  UNIQUE (agent_id, renter_id);

CREATE OR REPLACE FUNCTION respond_to_invite(
  p_invite_id UUID,
  p_status TEXT,
  p_renter_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_group_id UUID;
  v_renter_id UUID;
  v_pending_count INT;
BEGIN
  UPDATE agent_group_invites
  SET status = p_status, responded_at = NOW()
  WHERE id = p_invite_id AND status = 'pending'
  RETURNING group_id, renter_id INTO v_group_id, v_renter_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already responded');
  END IF;

  IF p_status = 'accepted' THEN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (v_group_id, v_renter_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM agent_group_invites
  WHERE group_id = v_group_id AND status = 'pending';

  IF v_pending_count = 0 THEN
    UPDATE groups SET group_status = 'active' WHERE id = v_group_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'groupId', v_group_id);
END;
$$ LANGUAGE plpgsql;
