-- Contador de folios oficiales (A = administración, P = producción, O = obra).
-- Ejecutado en Supabase (SQL Editor) el 2026-11-06. Es seguro volver a correrlo.
-- La app lo usa vía supabase.rpc('siguiente_folio', ...) en permisosService.generarFolioOficial.

create table if not exists public.folios_contador (
  prefijo text     not null,
  anio    smallint not null,
  ultimo  integer  not null default 0,
  primary key (prefijo, anio)
);
alter table public.folios_contador enable row level security;

-- Arranca el contador con el folio más alto que ya existe
insert into public.folios_contador (prefijo, anio, ultimo)
select split_part(folio, '-', 1),
       split_part(folio, '-', 2)::smallint,
       max(split_part(folio, '-', 3)::int)
from public.permisos
where folio ~ '^[APO]-[0-9]{2}-[0-9]{4,}$'
group by 1, 2
on conflict (prefijo, anio)
  do update set ultimo = greatest(folios_contador.ultimo, excluded.ultimo);

-- Entrega el siguiente folio. El insert ... on conflict do update bloquea el renglón,
-- así dos autorizaciones simultáneas nunca reciben el mismo número.
-- OJO: cada llamada gasta un número; no ejecutarla "para probar".
create or replace function public.siguiente_folio(p_prefijo text, p_anio smallint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  insert into folios_contador (prefijo, anio, ultimo)
  values (p_prefijo, p_anio, 1)
  on conflict (prefijo, anio)
    do update set ultimo = folios_contador.ultimo + 1
  returning ultimo into v_num;

  return p_prefijo || '-' || lpad(p_anio::text, 2, '0') || '-' || lpad(v_num::text, 4, '0');
end;
$$;

grant execute on function public.siguiente_folio(text, smallint) to anon, authenticated;
