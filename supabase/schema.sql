-- La Ruta de Suki: esquema de base de datos y reglas de seguridad.
-- Pégalo completo en Supabase > SQL Editor > New query y presiona Run.
-- Es seguro ejecutarlo una sola vez en un proyecto nuevo.

-- ============ Tablas ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  address text check (char_length(address) <= 160),
  barrio text check (char_length(barrio) <= 40),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  hours jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  description text check (char_length(description) <= 600),
  price smallint not null default 0 check (price between 0 and 4),
  phone text check (char_length(phone) <= 20),
  instagram text check (char_length(instagram) <= 30),
  website text check (char_length(website) <= 200),
  drinks text check (char_length(drinks) <= 900),
  photos text[] not null default '{}',
  menu text[] not null default '{}',
  is_example boolean not null default false,
  source text,   -- 'osm' si se importó de OpenStreetMap
  osm_id text,   -- identificador en OpenStreetMap, evita duplicados al importar
  created_at timestamptz not null default now()
);

create unique index cafes_osm_id_key on public.cafes (osm_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1500),
  photo text,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  status text not null check (status in ('want', 'been')),
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) <= 80),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create index on public.reviews (cafe_id);
create index on public.reviews (user_id);
create index on public.cafes (owner_id);

-- ============ Perfil automático al registrarse ============

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Quién es administrador ============

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============ Seguridad (Row Level Security) ============

alter table public.profiles  enable row level security;
alter table public.cafes     enable row level security;
alter table public.reviews   enable row level security;
alter table public.favorites enable row level security;
alter table public.reports   enable row level security;

-- Perfiles: todos los ven; cada quien edita su nombre, pero nadie puede cambiarse el rol.
create policy "perfiles visibles" on public.profiles for select using (true);
create policy "editar mi perfil" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- Cafeterías: todos las ven; quien inicia sesión agrega; solo su autor o un admin edita o borra.
create policy "cafeterias visibles" on public.cafes for select using (true);
create policy "agregar cafeteria" on public.cafes for insert to authenticated
  with check (owner_id = auth.uid() and is_example = false);
create policy "editar cafeteria" on public.cafes for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "borrar cafeteria" on public.cafes for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- Reseñas: todos las ven; cada quien publica las suyas; autor o admin borra. No se editan.
create policy "resenas visibles" on public.reviews for select using (true);
create policy "publicar resena" on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
create policy "borrar resena" on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Guardadas: privadas, cada quien ve y cambia solo las suyas.
create policy "mis guardadas" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reportes: cualquiera reporta; cada quien ve los suyos; el admin ve y borra todos.
create policy "crear reporte" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy "ver reportes" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "borrar reportes" on public.reports for delete to authenticated
  using (public.is_admin());

-- ============ Fotos (Storage) ============

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "fotos visibles" on storage.objects for select
  using (bucket_id = 'photos');
create policy "subir fotos propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar fotos propias" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============ Actualizaciones en vivo ============

alter publication supabase_realtime add table public.cafes, public.reviews, public.reports;
