CREATE INDEX IF NOT EXISTS idx_messages_media ON public.messages(match_id, message_type)
  WHERE message_type IN ('image', 'images', 'document', 'file');

ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
