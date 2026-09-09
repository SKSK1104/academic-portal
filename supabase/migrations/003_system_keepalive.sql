-- Harmless system-only activity for the Academic Portal project.
-- No student data is read or written by this health check.
create table if not exists public.v2_system_status (
  id text primary key,
  last_ping timestamptz not null default now(),
  ping_count bigint not null default 0
);

alter table public.v2_system_status enable row level security;

insert into public.v2_system_status(id, last_ping, ping_count)
values ('academic_portal', now(), 0)
on conflict (id) do nothing;

create or replace function public.v2_keepalive()
returns timestamptz
language plpgsql
security definer
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
grant execute on function public.v2_keepalive() to anon, authenticated;
