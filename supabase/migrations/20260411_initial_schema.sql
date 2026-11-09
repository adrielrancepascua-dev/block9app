-- Base schema for a fresh Block9 Supabase project.
-- Later migrations add chat, storage, and freedom-wall policies on top of this.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'student' check (role in ('student', 'admin', 'teacher')),
  custom_bg_url text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  room text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  status text not null check (status in ('going', 'late', 'absent')),
  primary key (user_id, schedule_id)
);

create table if not exists public.freedom_wall (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  author_id uuid not null references public.profiles (user_id) on delete cascade,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  x_pos int,
  y_pos int
);

create index if not exists schedules_start_time_idx on public.schedules (start_time);
create index if not exists attendance_schedule_id_idx on public.attendance (schedule_id);
create index if not exists freedom_wall_created_at_idx on public.freedom_wall (created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.profile_role_unchanged(target uuid, next_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = target
      and role = next_role
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_count integer;
begin
  select count(*) into profile_count from public.profiles;

  insert into public.profiles (user_id, name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'student'), '@', 1)),
    case when profile_count = 0 then 'admin' else 'student' end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.freedom_wall enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select on public.schedules to anon, authenticated;
grant insert, update, delete on public.schedules to authenticated, service_role;
grant select, insert, update, delete on public.attendance to authenticated, service_role;
grant select, insert, update, delete on public.freedom_wall to authenticated, service_role;
grant all on public.profiles, public.schedules, public.attendance, public.freedom_wall to service_role;
grant execute on function public.is_admin() to authenticated, anon, service_role;
grant execute on function public.profile_role_unchanged(uuid, text) to authenticated, service_role;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id and role = 'student');

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.profile_role_unchanged(user_id, role));

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Anyone can read schedules" on public.schedules;
create policy "Anyone can read schedules"
  on public.schedules
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert schedules" on public.schedules;
create policy "Admins can insert schedules"
  on public.schedules
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update schedules" on public.schedules;
create policy "Admins can update schedules"
  on public.schedules
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete schedules" on public.schedules;
create policy "Admins can delete schedules"
  on public.schedules
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Authenticated users can read attendance" on public.attendance;
create policy "Authenticated users can read attendance"
  on public.attendance
  for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own attendance" on public.attendance;
create policy "Users can insert their own attendance"
  on public.attendance
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own attendance" on public.attendance;
create policy "Users can update their own attendance"
  on public.attendance
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read freedom wall" on public.freedom_wall;
create policy "Authenticated users can read freedom wall"
  on public.freedom_wall
  for select
  to authenticated
  using (true);

drop policy if exists "Users can post on the freedom wall" on public.freedom_wall;
create policy "Users can post on the freedom wall"
  on public.freedom_wall
  for insert
  to authenticated
  with check (auth.uid() = author_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'freedom_wall'
  ) then
    alter publication supabase_realtime add table public.freedom_wall;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'schedules'
  ) then
    alter publication supabase_realtime add table public.schedules;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
exception
  when undefined_object then
    null;
end $$;
