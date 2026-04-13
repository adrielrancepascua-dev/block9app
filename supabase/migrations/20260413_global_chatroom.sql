-- Global chatroom support for Block9
-- Run this in Supabase SQL Editor for the production project.

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON public.chat_messages (created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Authenticated users can read chat messages'
  ) THEN
    CREATE POLICY "Authenticated users can read chat messages"
    ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Users can send chat messages'
  ) THEN
    CREATE POLICY "Users can send chat messages"
    ON public.chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Users can delete own chat messages'
  ) THEN
    CREATE POLICY "Users can delete own chat messages"
    ON public.chat_messages
    FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Admins can delete any chat message'
  ) THEN
    CREATE POLICY "Admins can delete any chat message"
    ON public.chat_messages
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
