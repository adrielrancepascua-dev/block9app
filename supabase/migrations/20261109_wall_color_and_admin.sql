-- Sticky-note color, and a single admin for the current account.
alter table public.freedom_wall
  add column if not exists note_color text;

update public.profiles
set role = 'student'
where user_id <> '89ae1e69-eaf5-4173-a929-ea62af458ae3';

update public.profiles
set role = 'admin'
where user_id = '89ae1e69-eaf5-4173-a929-ea62af458ae3';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, role, name_confirmed)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'student'), '@', 1)
    ),
    case
      when lower(coalesce(new.email, '')) = 'adrielrancepascua@gmail.com' then 'admin'
      else 'student'
    end,
    false
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
