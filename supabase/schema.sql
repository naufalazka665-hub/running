-- Lintasan: skema database untuk akun pelari.
-- Jalankan sekali di Supabase → SQL Editor → New query → Run.

create table if not exists public.runner_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Setiap pelari hanya bisa melihat & mengubah datanya sendiri.
alter table public.runner_data enable row level security;

drop policy if exists "baca data sendiri" on public.runner_data;
create policy "baca data sendiri" on public.runner_data
  for select using (auth.uid() = user_id);

drop policy if exists "tambah data sendiri" on public.runner_data;
create policy "tambah data sendiri" on public.runner_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "ubah data sendiri" on public.runner_data;
create policy "ubah data sendiri" on public.runner_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "hapus data sendiri" on public.runner_data;
create policy "hapus data sendiri" on public.runner_data
  for delete using (auth.uid() = user_id);

-- Batasi ukuran data per pelari (±2 MB) agar tidak disalahgunakan.
alter table public.runner_data drop constraint if exists runner_data_size;
alter table public.runner_data add constraint runner_data_size check (pg_column_size(data) < 2000000);
