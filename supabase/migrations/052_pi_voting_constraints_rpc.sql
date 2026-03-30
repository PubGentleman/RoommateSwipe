ALTER TABLE public.pi_auto_group_members
  DROP CONSTRAINT IF EXISTS pi_auto_group_members_status_check;

ALTER TABLE public.pi_auto_group_members
  ADD CONSTRAINT pi_auto_group_members_status_check
  CHECK (status IN ('pending','accepted','declined','expired','left','removed'));

ALTER TABLE public.pi_auto_groups
  DROP CONSTRAINT IF EXISTS pi_auto_groups_status_check;

ALTER TABLE public.pi_auto_groups
  ADD CONSTRAINT pi_auto_groups_status_check
  CHECK (status IN ('forming','pending_acceptance','partial','ready','invited','claimed','placed','expired','dissolved','awaiting_replacement_vote'));

CREATE OR REPLACE FUNCTION public.pi_vote_on_replacement(
  p_group_id UUID,
  p_replacement_member_id UUID,
  p_voter_id UUID,
  p_vote TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_accepted_count INT;
  v_current_approvals JSONB;
  v_current_passes JSONB;
  v_majority INT;
  v_all_replacements RECORD;
BEGIN
  IF p_vote NOT IN ('approve', 'pass') THEN
    RETURN jsonb_build_object('result', 'error', 'message', 'Invalid vote');
  END IF;

  SELECT * INTO v_member
  FROM pi_auto_group_members
  WHERE id = p_replacement_member_id
    AND group_id = p_group_id
    AND is_replacement = true
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'error', 'message', 'Replacement member not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pi_auto_group_members
    WHERE group_id = p_group_id
      AND user_id = p_voter_id
      AND status = 'accepted'
      AND is_replacement = false
  ) THEN
    RETURN jsonb_build_object('result', 'error', 'message', 'Not an accepted group member');
  END IF;

  SELECT COUNT(*) INTO v_accepted_count
  FROM pi_auto_group_members
  WHERE group_id = p_group_id
    AND status = 'accepted'
    AND is_replacement = false;

  v_majority := CEIL(v_accepted_count::NUMERIC / 2);

  IF p_vote = 'approve' THEN
    v_current_approvals := COALESCE(v_member.replacement_approved_by, '[]'::JSONB);
    IF NOT v_current_approvals ? p_voter_id::TEXT THEN
      v_current_approvals := v_current_approvals || to_jsonb(p_voter_id::TEXT);
    END IF;

    UPDATE pi_auto_group_members
    SET replacement_approved_by = v_current_approvals
    WHERE id = p_replacement_member_id;

    IF jsonb_array_length(v_current_approvals) >= v_majority THEN
      UPDATE pi_auto_group_members
      SET status = 'removed'
      WHERE group_id = p_group_id
        AND is_replacement = true
        AND id != p_replacement_member_id
        AND status = 'pending';

      UPDATE pi_auto_groups
      SET status = 'pending_acceptance',
          acceptance_deadline = NOW() + INTERVAL '72 hours'
      WHERE id = p_group_id;

      RETURN jsonb_build_object('result', 'approved');
    END IF;

    RETURN jsonb_build_object('result', 'voted');
  ELSE
    v_current_passes := COALESCE(v_member.replacement_passed_by, '[]'::JSONB);
    IF NOT v_current_passes ? p_voter_id::TEXT THEN
      v_current_passes := v_current_passes || to_jsonb(p_voter_id::TEXT);
    END IF;

    UPDATE pi_auto_group_members
    SET replacement_passed_by = v_current_passes
    WHERE id = p_replacement_member_id;

    IF jsonb_array_length(v_current_passes) >= v_majority THEN
      UPDATE pi_auto_group_members
      SET status = 'removed'
      WHERE id = p_replacement_member_id;

      RETURN jsonb_build_object('result', 'rejected');
    END IF;

    RETURN jsonb_build_object('result', 'voted');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pi_dissolve_group(
  p_group_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pi_auto_group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('result', 'error', 'message', 'Not an accepted group member');
  END IF;

  UPDATE pi_auto_groups
  SET status = 'dissolved'
  WHERE id = p_group_id;

  UPDATE pi_auto_group_members
  SET status = 'left'
  WHERE group_id = p_group_id
    AND status IN ('pending', 'accepted');

  RETURN jsonb_build_object('result', 'dissolved');
END;
$$;
