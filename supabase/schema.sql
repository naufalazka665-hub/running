-- Lintasan: skema database untuk akun pelari.
-- Sudah diterapkan ke proyek Supabase "lintasan" sebagai dua migrasi:
--   create_runner_data_table, runner_data_rls_policies.
-- Untuk proyek baru: Supabase → SQL Editor → tempel file ini → Run.

create table if not exists public.runner_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  -- batasi ukuran data per pelari (±2 MB) agar tidak disalahgunakan
  constraint runner_data_size check (pg_column_size(data) < 2000000)
);

-- Setiap pelari hanya bisa melihat & mengubah datanya sendiri.
alter table public.runner_data enable row level security;

create policy "baca data sendiri" on public.runner_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tambah data sendiri" on public.runner_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ubah data sendiri" on public.runner_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "hapus data sendiri" on public.runner_data
  for delete to authenticated using ((select auth.uid()) = user_id);
