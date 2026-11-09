-- People pick a display name after Google sign-up.
alter table public.profiles
  add column if not exists name_confirmed boolean not null default false;

update public.profiles
set name_confirmed = true
where name_confirmed = false;

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

  insert into public.profiles (user_id, name, role, name_confirmed)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'student'), '@', 1)
    ),
    case when profile_count = 0 then 'admin' else 'student' end,
    false
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
