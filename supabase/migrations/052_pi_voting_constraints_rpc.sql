DROP POLICY IF EXISTS preformed_groups_select ON public.preformed_groups;
CREATE POLICY preformed_groups_select ON public.preformed_groups
  FOR SELECT USING (
    auth.uid() = group_lead_id
    OR EXISTS (
      SELECT 1 FROM public.preformed_group_members pgm
      WHERE pgm.preformed_group_id = id AND pgm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS preformed_members_select ON public.preformed_group_members;
CREATE POLICY preformed_members_select ON public.preformed_group_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.preformed_groups pg
      WHERE pg.id = preformed_group_id AND pg.group_lead_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.preformed_group_members other
      WHERE other.preformed_group_id = preformed_group_members.preformed_group_id
        AND other.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS shortlist_select ON public.group_shortlist;
CREATE POLICY shortlist_select ON public.group_shortlist
  FOR SELECT USING (
    auth.uid() = added_by
    OR EXISTS (
      SELECT 1 FROM public.preformed_group_members pgm
      WHERE pgm.preformed_group_id = group_shortlist.preformed_group_id
        AND pgm.user_id = auth.uid()
        AND pgm.status = 'joined'
    )
    OR EXISTS (
      SELECT 1 FROM public.preformed_groups pg
      WHERE pg.id = preformed_group_id AND pg.group_lead_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.join_preformed_group_by_code(
  p_invite_code TEXT,
  p_user_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_existing RECORD;
  v_pending RECORD;
  v_joined_count INT;
BEGIN
  SELECT * INTO v_group
  FROM preformed_groups
  WHERE invite_code = UPPER(p_invite_code)
    AND status IN ('forming', 'ready', 'searching');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Group not found');
  END IF;

  SELECT * INTO v_existing
  FROM preformed_group_members
  WHERE preformed_group_id = v_group.id
    AND user_id = auth.uid();

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'group_id', v_group.id);
  END IF;

  SELECT * INTO v_pending
  FROM preformed_group_members
  WHERE preformed_group_id = v_group.id
    AND user_id IS NULL
    AND status = 'invited'
  LIMIT 1;

  IF FOUND THEN
    UPDATE preformed_group_members
    SET user_id = auth.uid(),
        name = p_user_name,
        status = 'joined',
        joined_at = NOW()
    WHERE id = v_pending.id;
  ELSE
    INSERT INTO preformed_group_members (preformed_group_id, user_id, name, status, joined_at)
    VALUES (v_group.id, auth.uid(), p_user_name, 'joined', NOW());
  END IF;

  UPDATE profiles
  SET listing_type_preference = 'any',
      apartment_search_type = 'have_group'
  WHERE user_id = auth.uid();

  SELECT COUNT(*) INTO v_joined_count
  FROM preformed_group_members
  WHERE preformed_group_id = v_group.id
    AND status = 'joined';

  IF v_joined_count >= v_group.group_size THEN
    UPDATE preformed_groups
    SET status = 'ready'
    WHERE id = v_group.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'group_id', v_group.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_preformed_group_by_code(
  p_invite_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_members JSONB;
BEGIN
  SELECT * INTO v_group
  FROM preformed_groups
  WHERE invite_code = UPPER(p_invite_code)
    AND status IN ('forming', 'ready', 'searching');

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', pgm.id,
    'name', pgm.name,
    'status', pgm.status,
    'user_id', pgm.user_id
  )) INTO v_members
  FROM preformed_group_members pgm
  WHERE pgm.preformed_group_id = v_group.id;

  RETURN jsonb_build_object(
    'id', v_group.id,
    'name', v_group.name,
    'group_size', v_group.group_size,
    'status', v_group.status,
    'invite_code', v_group.invite_code,
    'city', v_group.city,
    'group_lead_id', v_group.group_lead_id,
    'members', COALESCE(v_members, '[]'::JSONB)
  );
END;
$$;

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
