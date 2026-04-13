-- Chat room settings support (name, subtitle, chat picture)
-- Run this in Supabase SQL Editor for the production project.

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Community Chat',
  subtitle TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

INSERT INTO public.chat_rooms (id, name, subtitle)
VALUES ('global', 'Community Chat', NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_rooms'
      AND policyname = 'Authenticated users can read chat room settings'
  ) THEN
    CREATE POLICY "Authenticated users can read chat room settings"
    ON public.chat_rooms
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_rooms'
      AND policyname = 'Authenticated users can insert chat room settings'
  ) THEN
    CREATE POLICY "Authenticated users can insert chat room settings"
    ON public.chat_rooms
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_rooms'
      AND policyname = 'Authenticated users can update chat room settings'
  ) THEN
    CREATE POLICY "Authenticated users can update chat room settings"
    ON public.chat_rooms
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'chat-media'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'chat-media',
      'chat-media',
      true,
      10485760,
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can view chat media'
  ) THEN
    CREATE POLICY "Public can view chat media"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'chat-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload chat media'
  ) THEN
    CREATE POLICY "Users can upload chat media"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'chat-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update chat media'
  ) THEN
    CREATE POLICY "Users can update chat media"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'chat-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'chat-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete chat media'
  ) THEN
    CREATE POLICY "Users can delete chat media"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'chat-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
