-- Migration 103: Comprehensive Security Hardening
-- Adds RLS to unprotected tables, tightens overly permissive policies,
-- adds DELETE policies, and restricts notification inserts.

-- =============================================
-- PART 1a: affiliates — Enable RLS + policies
-- =============================================
ALTER TABLE IF EXISTS public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliates_select_own"
  ON public.affiliates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "affiliates_update_own"
  ON public.affiliates FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "affiliates_insert_own"
  ON public.affiliates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "affiliates_service_role"
  ON public.affiliates FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- PART 1b: affiliate_referrals — Enable RLS + policies
-- =============================================
ALTER TABLE IF EXISTS public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_referrals_select_own"
  ON public.affiliate_referrals FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "affiliate_referrals_service_role"
  ON public.affiliate_referrals FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- PART 1c: boost_purchases — Enable RLS + policies
-- =============================================
ALTER TABLE IF EXISTS public.boost_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boost_purchases_select_own"
  ON public.boost_purchases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "boost_purchases_insert_own"
  ON public.boost_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "boost_purchases_service_role"
  ON public.boost_purchases FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- PART 1d: zip_code_data — Enable RLS + policies
-- =============================================
ALTER TABLE IF EXISTS public.zip_code_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zip_code_data_select_authenticated"
  ON public.zip_code_data FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "zip_code_data_modify_service_only"
  ON public.zip_code_data FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- PART 2: Restrict notification INSERT to service_role only
-- (no actor_id column exists, so only Edge Functions should insert)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "notifications_insert_service_only"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- PART 3a: Tighten preformed_groups SELECT
-- =============================================
DROP POLICY IF EXISTS preformed_groups_select ON public.preformed_groups;

CREATE POLICY "preformed_groups_select_members"
  ON public.preformed_groups FOR SELECT
  USING (
    group_lead_id = auth.uid()
    OR id IN (
      SELECT preformed_group_id FROM public.preformed_group_members
      WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- =============================================
-- PART 3b: Tighten preformed_group_members SELECT
-- =============================================
DROP POLICY IF EXISTS preformed_members_select ON public.preformed_group_members;

CREATE POLICY "preformed_group_members_select_same_group"
  ON public.preformed_group_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR preformed_group_id IN (
      SELECT preformed_group_id FROM public.preformed_group_members
      WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- =============================================
-- PART 3c: Tighten group_shortlist SELECT
-- =============================================
DROP POLICY IF EXISTS shortlist_select ON public.group_shortlist;

CREATE POLICY "group_shortlist_select_members"
  ON public.group_shortlist FOR SELECT
  USING (
    preformed_group_id IN (
      SELECT preformed_group_id FROM public.preformed_group_members
      WHERE user_id = auth.uid()
    )
    OR preformed_group_id IN (
      SELECT id FROM public.preformed_groups
      WHERE group_lead_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- =============================================
-- PART 10a: messages — Allow sender to delete (unsend)
-- =============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "messages_delete_sender" ON public.messages FOR DELETE USING (sender_id = auth.uid())';
  END IF;
END $$;

-- =============================================
-- PART 10b: notifications — Allow recipient to delete (dismiss)
-- =============================================
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- PART 10c: whitelisted_emails — Service role only
-- =============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whitelisted_emails' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "whitelisted_emails_service_role" ON public.whitelisted_emails FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;
