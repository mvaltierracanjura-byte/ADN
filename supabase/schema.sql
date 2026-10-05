-- Kit ADN — esquema para el proyecto de Supabase de CADA cliente (un proyecto por negocio).
-- Se puede correr varias veces (idempotente). Pruebas: supabase/test-schema.mjs (PGlite).
--
-- Secciones: 1. Base (equipo y ajustes)  2. Agenda de citas  3. Asistente (conversaciones)  4+ ver abajo
-- Horas de la agenda: hora LOCAL del negocio (timestamp sin zona), como kit/agenda.js.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ════════════════════════════ 1. BASE ════════════════════════════
-- Equipo = fila en `equipo` (no basta con tener sesión). Rol 'duena' ve dinero y ajustes.
create table if not exists public.equipo (
  user_id uuid primary key,
  nombre text not null,
  rol text not null default 'equipo' check (rol in ('duena', 'equipo'))
);
alter table public.equipo enable row level security;

create or replace function public.es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipo where user_id = auth.uid())
$$;
create or replace function public.es_duena() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipo where user_id = auth.uid() and rol = 'duena')
$$;

drop policy if exists "equipo se ve a sí mismo" on public.equipo;
create policy "equipo se ve a sí mismo" on public.equipo for select using (user_id = auth.uid() or public.es_duena());

-- Ajustes del negocio. Las claves de `ajustes_publicos` se leen sin sesión; las demás solo el equipo.
create table if not exists public.ajustes (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
alter table public.ajustes enable row level security;
create or replace function public.ajuste_publico(c text) returns boolean language sql immutable as $$
  select c in ('negocio', 'cobro', 'resenas')
$$;
drop policy if exists "ajustes públicos" on public.ajustes;
create policy "ajustes públicos" on public.ajustes for select using (public.ajuste_publico(clave) or public.es_equipo());
drop policy if exists "dueña edita ajustes" on public.ajustes;
create policy "dueña edita ajustes" on public.ajustes for all using (public.es_duena()) with check (public.es_duena());

-- Hora local del negocio (Mazatlán por defecto; se cambia en ajustes.negocio.zona).
create or replace function public.ahora_local() returns timestamp
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select valor->>'zona' from public.ajustes where clave = 'negocio'), 'America/Mazatlan'))::timestamp
$$;

-- ════════════════════════════ 2. AGENDA ════════════════════════════
create table if not exists public.personal (
  id text primary key,
  nombre text not null,
  horario jsonb,                       -- opcional: { "1": [["09:00","14:00"]], ... }; si no, el del negocio
  activo boolean not null default true
);
create table if not exists public.servicios (
  id text primary key,
  nombre text not null,
  minutos int not null check (minutos between 5 and 600),
  precio numeric(10,2),
  personal text[] not null default '{}',
  activo boolean not null default true
);
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  servicio text not null references public.servicios(id),
  personal text not null references public.personal(id),
  inicio timestamp not null,
  fin timestamp not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada', 'asistio', 'no_asistio')),
  cliente_nombre text not null check (length(cliente_nombre) between 1 and 80),
  cliente_tel text not null check (cliente_tel ~ '^[0-9]{10}$'),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  recordada boolean not null default false,
  historial jsonb not null default '[]'::jsonb,
  creada timestamptz not null default now(),
  check (fin > inicio)
);
-- La base misma impide dos citas encimadas de la misma persona, aunque lleguen al mismo tiempo.
do $$ begin
  alter table public.citas add constraint citas_sin_encimar
    exclude using gist (personal with =, tsrange(inicio, fin) with &&)
    where (estado in ('pendiente', 'confirmada', 'asistio'));
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists citas_inicio on public.citas (inicio);

create table if not exists public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  personal text references public.personal(id),   -- null = todo el negocio
  inicio timestamp not null,
  fin timestamp not null,
  motivo text,
  check (fin > inicio)
);

alter table public.personal enable row level security;
alter table public.servicios enable row level security;
alter table public.citas enable row level security;
alter table public.bloqueos enable row level security;

drop policy if exists "todos ven personal activo" on public.personal;
create policy "todos ven personal activo" on public.personal for select using (activo or public.es_equipo());
drop policy if exists "dueña edita personal" on public.personal;
create policy "dueña edita personal" on public.personal for all using (public.es_duena()) with check (public.es_duena());
drop policy if exists "todos ven servicios activos" on public.servicios;
create policy "todos ven servicios activos" on public.servicios for select using (activo or public.es_equipo());
drop policy if exists "dueña edita servicios" on public.servicios;
create policy "dueña edita servicios" on public.servicios for all using (public.es_duena()) with check (public.es_duena());
drop policy if exists "equipo ve citas" on public.citas;
create policy "equipo ve citas" on public.citas for select using (public.es_equipo());
drop policy if exists "equipo actualiza citas" on public.citas;
create policy "equipo actualiza citas" on public.citas for update using (public.es_equipo()) with check (public.es_equipo());
drop policy if exists "equipo maneja bloqueos" on public.bloqueos;
create policy "equipo maneja bloqueos" on public.bloqueos for all using (public.es_equipo()) with check (public.es_equipo());

-- El equipo solo cambia el estado y la marca de recordatorio; el resto pasa por las funciones.
revoke all on public.citas from anon, authenticated;
grant select on public.citas to authenticated;
grant update (estado, recordada) on public.citas to authenticated;
grant select on public.personal, public.servicios to anon, authenticated;
grant insert, update, delete on public.personal, public.servicios to authenticated;
grant select, insert, update, delete on public.bloqueos to authenticated;
grant select on public.ajustes to anon, authenticated;
grant insert, update, delete on public.ajustes to authenticated;

-- ¿Cabe [ini, fin) en el horario de esa persona? Horario: { "0".."6": [["HH:MM","HH:MM"], ...] }
create or replace function public.en_horario(p_personal text, ini timestamp, fin timestamp) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare h jsonb; t jsonb;
begin
  if ini::date <> (fin - interval '1 second')::date then return false; end if;
  select coalesce(p.horario, (select valor->'horario' from ajustes where clave = 'negocio')) into h from personal p where p.id = p_personal;
  for t in select * from jsonb_array_elements(coalesce(h -> extract(dow from ini)::int::text, '[]'::jsonb)) loop
    if ini::time >= (t->>0)::time and fin::time <= (t->>1)::time then return true; end if;
  end loop;
  return false;
end $$;

-- Lo ocupado entre dos fechas, sin datos de clientes: la página calcula los horarios libres con esto.
create or replace function public.agenda_ocupado(desde date, hasta date)
returns table (personal text, inicio timestamp, fin timestamp)
language sql stable security definer set search_path = public as $$
  select c.personal, c.inicio, c.fin from citas c
   where c.estado in ('pendiente', 'confirmada', 'asistio') and c.inicio >= desde and c.inicio < hasta + 1
  union all
  select b.personal, b.inicio, b.fin from bloqueos b
   where b.inicio < hasta + 1 and b.fin > desde
$$;

-- Reservar desde la página. Valida todo en la base: servicio, persona, horario, anticipación,
-- días hacia adelante, bloqueos y encimados. Si no se dice persona, toma la primera libre.
create or replace function public.reservar_cita(p_servicio text, p_fecha date, p_hora time, p_nombre text, p_tel text, p_personal text default null)
returns table (id uuid, token text, personal text, inicio timestamp)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  s servicios; neg jsonb; v_ini timestamp; v_fin timestamp; candidato text; tel text;
  nueva citas;
begin
  select * into s from servicios where servicios.id = p_servicio and activo;
  if not found then raise exception 'Ese servicio no existe.'; end if;
  tel := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  if length(tel) = 12 and left(tel, 2) = '52' then tel := right(tel, 10); end if;
  if length(tel) = 13 and left(tel, 3) = '521' then tel := right(tel, 10); end if;
  if tel !~ '^[0-9]{10}$' then raise exception 'Falta un WhatsApp de 10 dígitos.'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre.'; end if;
  select valor into neg from ajustes where clave = 'negocio';
  v_ini := p_fecha + p_hora;
  v_fin := v_ini + make_interval(mins => s.minutos);
  if v_ini < ahora_local() + make_interval(mins => coalesce((neg->>'anticipacionMin')::int, 0)) then
    raise exception 'Ese horario ya pasó o está muy cerca. Elige otro.';
  end if;
  if neg ? 'diasAdelante' and p_fecha > ahora_local()::date + (neg->>'diasAdelante')::int then
    raise exception 'Todavía no abrimos la agenda para esa fecha.';
  end if;
  -- Máximo 3 citas futuras por teléfono (evita que alguien aparte toda la agenda).
  if (select count(*) from citas c where c.cliente_tel = tel and c.estado in ('pendiente', 'confirmada') and c.inicio > ahora_local()) >= 3 then
    raise exception 'Ya tienes 3 citas apartadas. Para más, escríbenos por WhatsApp.';
  end if;
  for candidato in
    select x from unnest(s.personal) with ordinality as u(x, n)
     where (p_personal is null or x = p_personal) and exists (select 1 from personal pp where pp.id = x and pp.activo)
     order by n
  loop
    continue when not en_horario(candidato, v_ini, v_fin);
    continue when exists (select 1 from bloqueos b where (b.personal is null or b.personal = candidato) and tsrange(b.inicio, b.fin) && tsrange(v_ini, v_fin));
    begin
      insert into citas (servicio, personal, inicio, fin, cliente_nombre, cliente_tel, historial)
      values (s.id, candidato, v_ini, v_fin, left(trim(p_nombre), 80), tel, jsonb_build_array(jsonb_build_object('estado', 'pendiente', 'en', now())))
      returning * into nueva;
      return query select nueva.id, nueva.token, nueva.personal, nueva.inicio;
      return;
    exception when exclusion_violation then
      continue;
    end;
  end loop;
  raise exception 'Ese horario ya no está disponible. Elige otro.';
end $$;

-- Lo que ve el cliente con el enlace de su cita (sin teléfono).
create or replace function public.cita_por_token(t text)
returns table (servicio text, servicio_id text, personal text, inicio timestamp, minutos int, estado text, cliente text)
language sql stable security definer set search_path = public as $$
  select s.nombre, s.id, p.nombre, c.inicio, s.minutos, c.estado, split_part(c.cliente_nombre, ' ', 1)
    from citas c join servicios s on s.id = c.servicio join personal p on p.id = c.personal
   where c.token = t
$$;

create or replace function public.cambiar_estado_cita(t text, nuevo text) returns text
language plpgsql security definer set search_path = public as $$
declare c citas;
begin
  if nuevo not in ('confirmada', 'cancelada') then raise exception 'Acción no válida.'; end if;
  select * into c from citas where token = t for update;
  if not found then raise exception 'No encontramos esa cita.'; end if;
  if c.estado not in ('pendiente', 'confirmada') then raise exception 'Esta cita ya no se puede cambiar.'; end if;
  if c.inicio < ahora_local() then raise exception 'Esta cita ya pasó.'; end if;
  update citas set estado = nuevo, historial = historial || jsonb_build_object('estado', nuevo, 'en', now(), 'por', 'cliente') where id = c.id;
  return nuevo;
end $$;

create or replace function public.reprogramar_cita(t text, p_fecha date, p_hora time) returns timestamp
language plpgsql security definer set search_path = public as $$
declare c citas; r record;
begin
  select * into c from citas where token = t for update;
  if not found then raise exception 'No encontramos esa cita.'; end if;
  if c.estado not in ('pendiente', 'confirmada') or c.inicio < ahora_local() then raise exception 'Esta cita ya no se puede cambiar.'; end if;
  update citas set estado = 'cancelada', historial = historial || jsonb_build_object('estado', 'cancelada', 'en', now(), 'por', 'cambio') where id = c.id;
  select * into r from reservar_cita(c.servicio, p_fecha, p_hora, c.cliente_nombre, c.cliente_tel, null);
  -- La cita nueva conserva el token, para que el enlace del cliente siga sirviendo.
  update citas set token = encode(gen_random_bytes(12), 'hex') where id = c.id;
  update citas set token = t where id = r.id;
  return r.inicio;
end $$;

-- Para el servidor (llave de servicio): citas pendientes sin recordar en las próximas `horas`.
create or replace function public.citas_por_recordar(horas int default 24)
returns table (id uuid, token text, cliente_nombre text, cliente_tel text, servicio text, personal text, inicio timestamp)
language sql stable security definer set search_path = public as $$
  select c.id, c.token, c.cliente_nombre, c.cliente_tel, s.nombre, p.nombre, c.inicio
    from citas c join servicios s on s.id = c.servicio join personal p on p.id = c.personal
   where c.estado = 'pendiente' and not c.recordada
     and c.inicio > ahora_local() and c.inicio <= ahora_local() + make_interval(hours => horas)
   order by c.inicio
$$;

revoke all on function public.citas_por_recordar(int) from public, anon, authenticated;
grant execute on function public.agenda_ocupado(date, date), public.reservar_cita(text, date, time, text, text, text),
  public.cita_por_token(text), public.cambiar_estado_cita(text, text), public.reprogramar_cita(text, date, time) to anon, authenticated;

-- ════════════════════════════ 3. ASISTENTE (WhatsApp, Instagram, teléfono) ════════════════════════════
-- Una conversación por teléfono. estado 'asistente' = contesta la IA; 'persona' = la tomó el equipo.
create table if not exists public.conversaciones (
  tel text primary key check (tel ~ '^[0-9]{10}$'),
  nombre text,
  estado text not null default 'asistente' check (estado in ('asistente', 'persona')),
  motivo text,
  actualizado timestamptz not null default now()
);
create table if not exists public.mensajes (
  id bigint generated always as identity primary key,
  tel text not null references public.conversaciones(tel) on delete cascade,
  autor text not null check (autor in ('cliente', 'asistente', 'equipo')),
  texto text not null,
  id_meta text unique,                 -- id del mensaje en WhatsApp: evita contestar dos veces el mismo aviso
  enviado boolean not null default true,
  creado timestamptz not null default now()
);
create index if not exists mensajes_tel on public.mensajes (tel, creado);
-- Llamadas en curso (las funciones del servidor no guardan memoria entre peticiones). Solo el servidor.
create table if not exists public.llamadas (
  call_sid text primary key,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);
alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.llamadas enable row level security;
drop policy if exists "equipo ve conversaciones" on public.conversaciones;
create policy "equipo ve conversaciones" on public.conversaciones for select using (public.es_equipo());
drop policy if exists "equipo devuelve o toma conversaciones" on public.conversaciones;
create policy "equipo devuelve o toma conversaciones" on public.conversaciones for update using (public.es_equipo()) with check (public.es_equipo());
drop policy if exists "equipo ve mensajes" on public.mensajes;
create policy "equipo ve mensajes" on public.mensajes for select using (public.es_equipo());
-- El equipo escribe respuestas con enviado = false; el servidor las manda por WhatsApp y las marca.
drop policy if exists "equipo responde" on public.mensajes;
create policy "equipo responde" on public.mensajes for insert with check (public.es_equipo() and autor = 'equipo' and enviado = false);
revoke all on public.conversaciones, public.mensajes, public.llamadas from anon, authenticated;
grant select on public.conversaciones, public.mensajes to authenticated;
grant update (estado, motivo) on public.conversaciones to authenticated;
grant insert (tel, autor, texto, enviado) on public.mensajes to authenticated;
