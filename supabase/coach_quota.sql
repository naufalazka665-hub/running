-- Kuota harian Coach AI. Diterapkan ke proyek "lintasan" (migrasi coach_usage_quota +
-- coach_quota_for_user; hak akses dikunci lewat SQL karena migrasi connector timeout).
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default (now() at time zone 'Asia/Jakarta')::date,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;

-- pelari boleh melihat pemakaiannya sendiri; menulis hanya lewat fungsi di bawah
create policy "lihat kuota sendiri" on public.coach_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Ambil 1 kuota secara atomik untuk p_user. Hanya Edge Function (service role) yang memanggil,
-- setelah memverifikasi token pelari; p_user tidak pernah berasal dari input browser.
create or replace function public.coach_take_quota_for(p_user uuid, daily_limit integer)
returns table (allowed boolean, remaining integer)
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
  used integer;
begin
  if p_user is null then
    return query select false, 0;
    return;
  end if;
  insert into public.coach_usage as cu (user_id, day, count)
  values (p_user, today, 1)
  on conflict (user_id, day) do update set count = cu.count + 1
    where cu.count < daily_limit
  returning cu.count into used;
  if used is null then
    return query select false, 0;
  else
    return query select true, greatest(daily_limit - used, 0);
  end if;
end;
$$;

revoke all on function public.coach_take_quota_for(uuid, integer) from public, anon, authenticated;
grant execute on function public.coach_take_quota_for(uuid, integer) to service_role;
