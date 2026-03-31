ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS free_message_unlock_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS free_message_unlock_conversation_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS free_message_unlock_used_at TIMESTAMPTZ DEFAULT NULL;
