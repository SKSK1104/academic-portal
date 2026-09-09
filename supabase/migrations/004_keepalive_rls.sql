-- Keepalive stays anonymous but no longer needs SECURITY DEFINER.
-- The anon role can update only the single non-student health row.
drop policy if exists v2_system_status_keepalive_select on public.v2_system_status;
create policy v2_system_status_keepalive_select
on public.v2_system_status
for select
to anon
using (id = 'academic_portal');

drop policy if exists v2_system_status_keepalive_update on public.v2_system_status;
create policy v2_system_status_keepalive_update
on public.v2_system_status
for update
to anon
using (id = 'academic_portal')
with check (id = 'academic_portal');

create or replace function public.v2_keepalive()
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  pinged_at timestamptz := now();
begin
  update public.v2_system_status
  set last_ping = pinged_at,
      ping_count = ping_count + 1
  where id = 'academic_portal';
  return pinged_at;
end;
$$;

revoke all on function public.v2_keepalive() from public;
grant execute on function public.v2_keepalive() to anon;
