ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE NOT NULL,
  pinned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_group ON public.pinned_messages(group_id);

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS last_read_message_id UUID;

CREATE TABLE IF NOT EXISTS public.message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON public.message_mentions(mentioned_user_id, read);
CREATE INDEX IF NOT EXISTS idx_mentions_group ON public.message_mentions(group_id);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Group members can view pinned messages') THEN
    CREATE POLICY "Group members can view pinned messages"
      ON public.pinned_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = pinned_messages.group_id
          AND gm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can pin messages') THEN
    CREATE POLICY "Admins can pin messages"
      ON public.pinned_messages FOR INSERT
      WITH CHECK (auth.uid() = pinned_by);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can unpin messages') THEN
    CREATE POLICY "Admins can unpin messages"
      ON public.pinned_messages FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = pinned_messages.group_id
          AND gm.user_id = auth.uid()
          AND gm.is_admin = TRUE
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can see their mentions') THEN
    CREATE POLICY "Users can see their mentions"
      ON public.message_mentions FOR SELECT
      USING (mentioned_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create mentions') THEN
    CREATE POLICY "Users can create mentions"
      ON public.message_mentions FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = message_mentions.group_id
          AND gm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their mentions') THEN
    CREATE POLICY "Users can update their mentions"
      ON public.message_mentions FOR UPDATE
      USING (mentioned_user_id = auth.uid());
  END IF;
END $$;
