-- Migración 2: columnas para cafeterías importadas de OpenStreetMap.
-- Ejecútalo UNA vez si ya habías corrido schema.sql antes de esta versión.
-- Si tu proyecto es nuevo, schema.sql ya lo incluye y no necesitas este archivo.
-- Es seguro correrlo más de una vez.

alter table public.cafes add column if not exists source text;
alter table public.cafes add column if not exists osm_id text;

create unique index if not exists cafes_osm_id_key on public.cafes (osm_id);
