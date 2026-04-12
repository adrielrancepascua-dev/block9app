-- Freedom Wall vote-to-clear support
-- Run this in Supabase SQL Editor for the production project.

ALTER TABLE public.freedom_wall
  ADD COLUMN IF NOT EXISTS x_pos INT,
  ADD COLUMN IF NOT EXISTS y_pos INT;

CREATE TABLE IF NOT EXISTS public.freedom_wall_clear_votes (
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.freedom_wall_clear_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall'
      AND policyname = 'Admins can delete freedom wall posts'
  ) THEN
    CREATE POLICY "Admins can delete freedom wall posts"
    ON public.freedom_wall
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall_clear_votes'
      AND policyname = 'Authenticated users can read clear votes'
  ) THEN
    CREATE POLICY "Authenticated users can read clear votes"
    ON public.freedom_wall_clear_votes
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall_clear_votes'
      AND policyname = 'Users can cast their own clear vote'
  ) THEN
    CREATE POLICY "Users can cast their own clear vote"
    ON public.freedom_wall_clear_votes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall_clear_votes'
      AND policyname = 'Users can remove their own clear vote'
  ) THEN
    CREATE POLICY "Users can remove their own clear vote"
    ON public.freedom_wall_clear_votes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall_clear_votes'
      AND policyname = 'Admins can clear all clear votes'
  ) THEN
    CREATE POLICY "Admins can clear all clear votes"
    ON public.freedom_wall_clear_votes
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;
