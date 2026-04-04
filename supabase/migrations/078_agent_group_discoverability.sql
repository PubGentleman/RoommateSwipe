-- Migration 078: Agent Group Discoverability
-- Allows agent-assembled groups to appear in renter group browser

-- Add is_discoverable column to groups table
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_groups_discoverable
  ON groups (is_discoverable) WHERE is_discoverable = true;

-- Add agent_group_id column to group_join_requests
ALTER TABLE public.group_join_requests
  ADD COLUMN IF NOT EXISTS agent_group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- Drop the existing check constraint that requires exactly one of pi_auto/preformed
ALTER TABLE public.group_join_requests
  DROP CONSTRAINT IF EXISTS group_join_requests_check;

-- Recreate with agent_group_id option
ALTER TABLE public.group_join_requests
  ADD CONSTRAINT group_join_requests_group_type_check CHECK (
    (
      (pi_auto_group_id IS NOT NULL)::int +
      (preformed_group_id IS NOT NULL)::int +
      (agent_group_id IS NOT NULL)::int
    ) = 1
  );

-- Unique index for agent group join requests (one pending request per user per group)
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_agent_unique
  ON public.group_join_requests(agent_group_id, requester_id)
  WHERE status IN ('pending');

CREATE INDEX IF NOT EXISTS idx_join_requests_agent_group
  ON public.group_join_requests(agent_group_id);

-- RLS policies for agent group join requests
-- Users can view their own requests (already covered by existing policy if present)
-- Agents can view requests for their groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Agents can view agent group requests'
      AND tablename = 'group_join_requests'
  ) THEN
    CREATE POLICY "Agents can view agent group requests"
      ON public.group_join_requests FOR SELECT
      USING (
        agent_group_id IN (
          SELECT id FROM groups WHERE created_by_agent = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Agents can review agent group requests'
      AND tablename = 'group_join_requests'
  ) THEN
    CREATE POLICY "Agents can review agent group requests"
      ON public.group_join_requests FOR UPDATE
      USING (
        agent_group_id IN (
          SELECT id FROM groups WHERE created_by_agent = auth.uid()
        )
      );
  END IF;
END $$;
