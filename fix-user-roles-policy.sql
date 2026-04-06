-- Deprecated: authorization now uses public.profiles only.
-- This script disables legacy user_roles access when the table exists.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'user_roles'
  ) then
    execute 'alter table public.user_roles enable row level security';
    execute 'drop policy if exists "Allow first admin setup" on public.user_roles';
    execute 'drop policy if exists "Authenticated can read user_roles" on public.user_roles';
    execute 'drop policy if exists "readonly_user_roles" on public.user_roles';
    execute ''
      || 'create policy "readonly_user_roles" '
      || 'on public.user_roles for select to authenticated using (false)';
  end if;
end $$;
