-- ============================================================================
-- Legacy migration kept for compatibility.
-- Prefer running authorization-hardening.sql in production.
-- ============================================================================

alter table public.profiles add column if not exists status text default 'pending';
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists updated_at timestamp with time zone default now();
alter table public.profiles add column if not exists requested_access_at timestamp with time zone default now();
alter table public.profiles add column if not exists approved_at timestamp with time zone;
alter table public.profiles add column if not exists suspended_at timestamp with time zone;

update public.profiles
set status = 'approved', role = 'admin', approved_at = coalesce(approved_at, now()), updated_at = now()
where lower(trim(email)) = 'alexandregoncalvespmrr@gmail.com';

update public.profiles
set status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
where is_validated = true and coalesce(status, 'pending') = 'pending';

update public.profiles
set status = 'pending', role = 'user', requested_access_at = coalesce(requested_access_at, now()), updated_at = now()
where status is null or status not in ('pending', 'approved', 'suspended', 'revoked');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  normalized_email text;
  profile_role text;
  profile_status text;
begin
  normalized_email := lower(trim(new.email));

  if normalized_email = 'alexandregoncalvespmrr@gmail.com' then
    profile_role := 'admin';
    profile_status := 'approved';
  else
    profile_role := 'user';
    profile_status := 'pending';
  end if;

  insert into public.profiles (user_id, email, name, is_validated, status, role, requested_access_at, approved_at, suspended_at, updated_at)
  values (
    new.id,
    normalized_email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    profile_status = 'approved',
    profile_status,
    profile_role,
    now(),
    case when profile_status = 'approved' then now() else null end,
    null,
    now()
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    name = excluded.name,
    status = excluded.status,
    role = excluded.role,
    is_validated = excluded.is_validated,
    requested_access_at = excluded.requested_access_at,
    approved_at = excluded.approved_at,
    suspended_at = null,
    updated_at = now();

  return new;
end;
$$;
