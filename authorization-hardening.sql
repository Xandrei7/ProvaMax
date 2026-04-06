-- ============================================================================
-- Authorization hardening (single source of truth = public.profiles)
-- Run once in Supabase SQL editor (production-safe, idempotent)
-- ============================================================================

begin;

-- 0) Helper functions
create or replace function public.normalize_email(raw_email text)
returns text
language sql
immutable
as $$
  select lower(btrim(coalesce(raw_email, '')))
$$;

-- 1) Profiles schema hardening
alter table public.profiles
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists is_validated boolean default false,
  add column if not exists status text,
  add column if not exists role text,
  add column if not exists updated_at timestamp with time zone default now(),
  add column if not exists requested_access_at timestamp with time zone,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists suspended_at timestamp with time zone;

alter table public.profiles
  alter column status set default 'pending',
  alter column role set default 'user',
  alter column is_validated set default false;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and p.status = 'approved'
  )
$$;

update public.profiles
set
  email = public.normalize_email(email),
  role = case when role in ('admin', 'user') then role else 'user' end,
  status = case
    when status in ('pending', 'approved', 'suspended', 'revoked') then status
    else 'pending'
  end,
  requested_access_at = coalesce(requested_access_at, created_at, now()),
  approved_at = case
    when status = 'approved' then coalesce(approved_at, updated_at, created_at, now())
    else approved_at
  end,
  suspended_at = case
    when status = 'suspended' then coalesce(suspended_at, updated_at, created_at, now())
    else suspended_at
  end,
  is_validated = (status = 'approved'),
  updated_at = coalesce(updated_at, now());

-- Any non-admin "approved" profile without explicit manual approval evidence
-- is forced back to pending.
update public.profiles
set
  status = 'pending',
  is_validated = false,
  approved_at = null,
  suspended_at = null,
  requested_access_at = coalesce(requested_access_at, now()),
  updated_at = now()
where public.normalize_email(email) <> 'alexandregoncalvespmrr@gmail.com'
  and status = 'approved'
  and (
    approved_at is null
    or approved_at <= coalesce(created_at, approved_at)
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('pending', 'approved', 'suspended', 'revoked'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'user'));
  end if;
end $$;

-- 2) Ensure deterministic admin record
update public.profiles
set
  email = 'alexandregoncalvespmrr@gmail.com',
  role = 'admin',
  status = 'approved',
  is_validated = true,
  approved_at = coalesce(approved_at, now()),
  suspended_at = null,
  updated_at = now()
where public.normalize_email(email) = 'alexandregoncalvespmrr@gmail.com';

insert into public.profiles (
  user_id,
  email,
  name,
  role,
  status,
  is_validated,
  requested_access_at,
  approved_at,
  suspended_at,
  updated_at
)
select
  u.id,
  'alexandregoncalvespmrr@gmail.com',
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  'admin',
  'approved',
  true,
  now(),
  now(),
  null,
  now()
from auth.users u
where public.normalize_email(u.email) = 'alexandregoncalvespmrr@gmail.com'
on conflict (user_id) do update
set
  email = excluded.email,
  role = 'admin',
  status = 'approved',
  is_validated = true,
  approved_at = coalesce(public.profiles.approved_at, excluded.approved_at),
  suspended_at = null,
  updated_at = now();

-- 3) New signup trigger (pending by default, admin auto-approved)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  profile_role text;
  profile_status text;
  profile_approved_at timestamp with time zone;
  profile_requested_at timestamp with time zone;
begin
  normalized_email := public.normalize_email(new.email);

  if normalized_email = 'alexandregoncalvespmrr@gmail.com' then
    profile_role := 'admin';
    profile_status := 'approved';
    profile_approved_at := now();
    profile_requested_at := now();
  else
    profile_role := 'user';
    profile_status := 'pending';
    profile_approved_at := null;
    profile_requested_at := now();
  end if;

  insert into public.profiles (
    user_id,
    email,
    name,
    role,
    status,
    is_validated,
    requested_access_at,
    approved_at,
    suspended_at,
    updated_at
  )
  values (
    new.id,
    normalized_email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    profile_role,
    profile_status,
    profile_status = 'approved',
    profile_requested_at,
    profile_approved_at,
    null,
    now()
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    status = excluded.status,
    is_validated = excluded.is_validated,
    requested_access_at = excluded.requested_access_at,
    approved_at = excluded.approved_at,
    suspended_at = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3.1) Profiles write guardrails
create or replace function public.enforce_profile_authorization_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_admin_email constant text := 'alexandregoncalvespmrr@gmail.com';
  actor_is_admin boolean;
begin
  new.email := public.normalize_email(new.email);
  new.updated_at := now();

  actor_is_admin := public.is_current_admin();

  if new.email = normalized_admin_email then
    new.role := 'admin';
    new.status := 'approved';
    new.is_validated := true;
    new.approved_at := coalesce(
      new.approved_at,
      case when tg_op = 'UPDATE' then old.approved_at else null end,
      now()
    );
    new.suspended_at := null;
    new.requested_access_at := coalesce(
      new.requested_access_at,
      case when tg_op = 'UPDATE' then old.requested_access_at else null end,
      now()
    );
    return new;
  end if;

  new.role := 'user';

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_validated := false;
    new.requested_access_at := coalesce(new.requested_access_at, now());
    new.approved_at := null;
    new.suspended_at := null;
    return new;
  end if;

  if new.status not in ('pending', 'approved', 'suspended', 'revoked') then
    raise exception 'Invalid status for profiles: %', new.status;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'approved' then
      if not actor_is_admin then
        raise exception 'Only admin can approve users';
      end if;

      new.approved_at := coalesce(new.approved_at, now());
      new.suspended_at := null;
      new.is_validated := true;
    elsif new.status = 'suspended' then
      if not actor_is_admin then
        raise exception 'Only admin can suspend users';
      end if;

      new.suspended_at := coalesce(new.suspended_at, now());
      new.is_validated := false;
    elsif new.status = 'revoked' then
      if not actor_is_admin then
        raise exception 'Only admin can revoke users';
      end if;

      new.is_validated := false;
    else
      if old.status in ('approved', 'revoked') and not actor_is_admin then
        raise exception 'Only admin can move approved/revoked user to pending';
      end if;

      new.requested_access_at := now();
      new.approved_at := null;
      new.suspended_at := null;
      new.is_validated := false;
    end if;
  else
    if new.status = 'approved' then
      new.approved_at := coalesce(new.approved_at, old.approved_at);
      new.suspended_at := null;
      new.is_validated := true;
    elsif new.status = 'suspended' then
      new.suspended_at := coalesce(new.suspended_at, old.suspended_at, now());
      new.is_validated := false;
    elsif new.status = 'pending' then
      new.requested_access_at := coalesce(new.requested_access_at, old.requested_access_at, now());
      new.approved_at := null;
      new.suspended_at := null;
      new.is_validated := false;
    else
      new.is_validated := false;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_authorization_guard on public.profiles;
create trigger profiles_authorization_guard
  before insert or update on public.profiles
  for each row execute procedure public.enforce_profile_authorization_rules();

-- 4) RLS policies (profiles is the only authorization source)
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Service can insert profiles" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;
drop policy if exists "profiles_update_self_guarded" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_current_admin()
  );

create policy "profiles_insert_self_or_admin"
  on public.profiles
  for insert
  to authenticated
  with check (
    public.is_current_admin()
    or (
      auth.uid() = user_id
      and role = 'user'
      and status = 'pending'
      and public.normalize_email(email) <> 'alexandregoncalvespmrr@gmail.com'
    )
    or (
      auth.uid() = user_id
      and public.normalize_email(email) = 'alexandregoncalvespmrr@gmail.com'
      and role = 'admin'
      and status = 'approved'
    )
  );

create policy "profiles_update_admin_only"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_current_admin()
    or (
      auth.uid() = user_id
      and public.normalize_email(email) = 'alexandregoncalvespmrr@gmail.com'
    )
  )
  with check (
    public.is_current_admin()
    or (
      auth.uid() = user_id
      and public.normalize_email(email) = 'alexandregoncalvespmrr@gmail.com'
      and role = 'admin'
      and status = 'approved'
    )
  );

create policy "profiles_update_self_guarded"
  on public.profiles
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and role = 'user'
  )
  with check (
    auth.uid() = user_id
    and role = 'user'
  );

-- Optional: keep writes restricted to admin for core content tables.
alter table public.disciplines enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;

drop policy if exists "Authenticated can insert disciplines" on public.disciplines;
drop policy if exists "Authenticated can update disciplines" on public.disciplines;
drop policy if exists "Authenticated can delete disciplines" on public.disciplines;
drop policy if exists "admin_manage_disciplines" on public.disciplines;
create policy "admin_manage_disciplines"
  on public.disciplines
  for all
  to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

drop policy if exists "Authenticated can insert subjects" on public.subjects;
drop policy if exists "Authenticated can update subjects" on public.subjects;
drop policy if exists "Authenticated can delete subjects" on public.subjects;
drop policy if exists "admin_manage_subjects" on public.subjects;
create policy "admin_manage_subjects"
  on public.subjects
  for all
  to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

drop policy if exists "Authenticated can insert questions" on public.questions;
drop policy if exists "Authenticated can update questions" on public.questions;
drop policy if exists "Authenticated can delete questions" on public.questions;
drop policy if exists "admin_manage_questions" on public.questions;
create policy "admin_manage_questions"
  on public.questions
  for all
  to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

commit;
