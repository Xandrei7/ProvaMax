-- ============================================================
-- PROVA MAX - Setup inicial seguro (Supabase)
-- ============================================================

-- 1. DISCIPLINES
create table if not exists public.disciplines (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text default '📚',
  created_at timestamp with time zone default now()
);

-- 2. SUBJECTS
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  discipline_id uuid references public.disciplines(id) on delete cascade,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

-- 3. QUESTIONS
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  statement text not null,
  type text check (type in ('multiple_choice', 'true_false')) not null default 'true_false',
  options jsonb,
  correct_answer text not null,
  comment text not null default '',
  legal_basis text,
  exam_tips text,
  subject_id uuid references public.subjects(id) on delete cascade,
  discipline_id uuid references public.disciplines(id) on delete cascade,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

-- 4. PROFILES (single source of truth for authorization)
create table if not exists public.profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'revoked')),
  is_validated boolean not null default false,
  requested_access_at timestamp with time zone default now(),
  approved_at timestamp with time zone,
  suspended_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. QUESTION_REPORTS
create table if not exists public.question_reports (
  id uuid default gen_random_uuid() primary key,
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  message text,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- Trigger: create profile on signup (pending by default)
-- ============================================================
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
  normalized_email := lower(trim(coalesce(new.email, '')));

  if normalized_email = 'alexandregoncalvespmrr@gmail.com' then
    profile_role := 'admin';
    profile_status := 'approved';
  else
    profile_role := 'user';
    profile_status := 'pending';
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
    now(),
    case when profile_status = 'approved' then now() else null end,
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

-- ============================================================
-- RLS
-- ============================================================
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

alter table public.disciplines enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.profiles enable row level security;
alter table public.question_reports enable row level security;

drop policy if exists "Authenticated can read disciplines" on public.disciplines;
drop policy if exists "admin_manage_disciplines" on public.disciplines;
create policy "Authenticated can read disciplines"
  on public.disciplines for select to authenticated using (true);
create policy "admin_manage_disciplines"
  on public.disciplines for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

drop policy if exists "Authenticated can read subjects" on public.subjects;
drop policy if exists "admin_manage_subjects" on public.subjects;
create policy "Authenticated can read subjects"
  on public.subjects for select to authenticated using (true);
create policy "admin_manage_subjects"
  on public.subjects for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

drop policy if exists "Authenticated can read questions" on public.questions;
drop policy if exists "admin_manage_questions" on public.questions;
create policy "Authenticated can read questions"
  on public.questions for select to authenticated using (true);
create policy "admin_manage_questions"
  on public.questions for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id or public.is_current_admin());
create policy "profiles_insert_self_or_admin"
  on public.profiles for insert to authenticated
  with check (
    public.is_current_admin()
    or (
      auth.uid() = user_id
      and role = 'user'
      and status = 'pending'
      and lower(trim(email)) <> 'alexandregoncalvespmrr@gmail.com'
    )
    or (
      auth.uid() = user_id
      and lower(trim(email)) = 'alexandregoncalvespmrr@gmail.com'
      and role = 'admin'
      and status = 'approved'
    )
  );
create policy "profiles_update_admin_only"
  on public.profiles for update to authenticated
  using (
    public.is_current_admin()
    or (
      auth.uid() = user_id
      and lower(trim(email)) = 'alexandregoncalvespmrr@gmail.com'
    )
  )
  with check (
    public.is_current_admin()
    or (
      auth.uid() = user_id
      and lower(trim(email)) = 'alexandregoncalvespmrr@gmail.com'
      and role = 'admin'
      and status = 'approved'
    )
  );

drop policy if exists "Authenticated can read reports" on public.question_reports;
drop policy if exists "Authenticated can insert reports" on public.question_reports;
create policy "Authenticated can read reports"
  on public.question_reports for select to authenticated
  using (public.is_current_admin());
create policy "Authenticated can insert reports"
  on public.question_reports for insert to authenticated
  with check (auth.uid() = user_id);
