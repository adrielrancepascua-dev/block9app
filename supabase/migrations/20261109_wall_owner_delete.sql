drop policy if exists "Users can delete their own freedom wall posts" on public.freedom_wall;
create policy "Users can delete their own freedom wall posts"
  on public.freedom_wall
  for delete
  to authenticated
  using (auth.uid() = author_id);
