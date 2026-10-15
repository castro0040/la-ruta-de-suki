-- La Ruta de Suki: reportar cafeterías y marcarlas como cerradas.
-- Pégalo completo en Supabase > SQL Editor > New query y presiona Run.
-- Solo hace falta si ya habías ejecutado schema.sql antes de esta versión.
-- Es seguro ejecutarlo más de una vez.

-- 1) Estado de la cafetería: 'active' (se ve) o 'closed' (oculta para todos menos moderadores).
alter table public.cafes add column if not exists status text not null default 'active';
alter table public.cafes drop constraint if exists cafes_status_check;
alter table public.cafes add constraint cafes_status_check check (status in ('active', 'closed'));

-- 2) Las cerradas solo las ven los moderadores.
drop policy if exists "cafeterias visibles" on public.cafes;
create policy "cafeterias visibles" on public.cafes for select
  using (status = 'active' or public.is_admin());

-- 3) Reportes de cafeterías.
create table if not exists public.cafe_reports (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('closed', 'other_place', 'duplicate', 'wrong_data')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (cafe_id, reporter_id)
);

create index if not exists cafe_reports_cafe_idx on public.cafe_reports (cafe_id);

alter table public.cafe_reports enable row level security;

drop policy if exists "crear reporte de cafeteria" on public.cafe_reports;
drop policy if exists "ver reportes de cafeteria" on public.cafe_reports;
drop policy if exists "borrar reportes de cafeteria" on public.cafe_reports;

create policy "crear reporte de cafeteria" on public.cafe_reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy "ver reportes de cafeteria" on public.cafe_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "borrar reportes de cafeteria" on public.cafe_reports for delete to authenticated
  using (public.is_admin());

-- 4) Actualizaciones en vivo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cafe_reports'
  ) then
    alter publication supabase_realtime add table public.cafe_reports;
  end if;
end $$;
