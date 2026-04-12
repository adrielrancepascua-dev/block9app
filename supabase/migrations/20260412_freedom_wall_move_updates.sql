-- Freedom Wall drag-and-move support
-- Run this in Supabase SQL Editor for the production project.

ALTER TABLE public.freedom_wall ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall'
      AND policyname = 'Users can move their own freedom wall posts'
  ) THEN
    CREATE POLICY "Users can move their own freedom wall posts"
    ON public.freedom_wall
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freedom_wall'
      AND policyname = 'Admins can move any freedom wall post'
  ) THEN
    CREATE POLICY "Admins can move any freedom wall post"
    ON public.freedom_wall
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;
