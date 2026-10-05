-- Kit ADN — esquema para el proyecto de Supabase de CADA cliente (un proyecto por negocio).
-- Se puede correr varias veces (idempotente). Pruebas: supabase/test-schema.mjs (PGlite).
--
-- Secciones: 1. Base  2. Agenda de citas  3. Asistente  4. Cobros (SPEI)  5. Autofactura (CFDI)  6. Calendario (ICS)
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

-- ════════════════════════════ 4. COBROS (SPEI / DiMo) ════════════════════════════
-- El enlace de pago lleva solo un token: CLABE, beneficiario y monto salen de la base, así nadie puede
-- armar un enlace falso con otra CLABE en el dominio del negocio. ajustes.cobro = { clabe, beneficiario, dimo? }.
create or replace function public.clabe_valida(c text) returns boolean language sql immutable as $$
  select c ~ '^[0-9]{18}$' and (10 - (select sum((substr(c, i, 1)::int * (array[3,7,1])[(i - 1) % 3 + 1]) % 10) from generate_series(1, 17) i) % 10) % 10
    = substr(c, 18, 1)::int
$$;
-- Igual que kit/cobro.js → referencia(): 6 dígitos del consecutivo + verificador.
create or replace function public.ref_cobro(n bigint) returns text language sql immutable as $$
  select b || ((select sum(substr(b, i, 1)::int * case when i % 2 = 1 then 2 else 1 end) from generate_series(1, 6) i) % 10)::text
    from (select lpad((abs(n) % 1000000)::text, 6, '0') as b) x
$$;
-- Concepto SPEI: mayúsculas sin acentos ni símbolos, máximo 40.
create or replace function public.concepto_spei(t text) returns text language sql immutable as $$
  select left(trim(regexp_replace(regexp_replace(upper(translate(coalesce(t, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9 ]', '', 'g'), '\s+', ' ', 'g')), 40)
$$;

create table if not exists public.cobros (
  id bigint generated by default as identity primary key,
  monto numeric(10,2) not null check (monto > 0 and monto <= 500000),
  concepto text not null check (concepto ~ '^[A-Z0-9 ]{1,40}$'),
  referencia text not null unique,
  cliente_tel text check (cliente_tel ~ '^[0-9]{10}$'),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'avisado', 'pagado', 'cancelado')),
  creado timestamptz not null default now(),
  avisado_en timestamptz,
  pagado_en timestamptz
);
create or replace function public.cobro_referencia() returns trigger language plpgsql as $$
begin new.referencia := ref_cobro(new.id); return new; end $$;
drop trigger if exists cobro_referencia on public.cobros;
create trigger cobro_referencia before insert on public.cobros for each row execute function public.cobro_referencia();

alter table public.cobros enable row level security;
drop policy if exists "equipo ve cobros" on public.cobros;
create policy "equipo ve cobros" on public.cobros for select using (public.es_equipo());
drop policy if exists "equipo marca cobros" on public.cobros;
create policy "equipo marca cobros" on public.cobros for update using (public.es_equipo()) with check (public.es_equipo());
revoke all on public.cobros from anon, authenticated;
grant select on public.cobros to authenticated;
grant update (estado, pagado_en) on public.cobros to authenticated;

create or replace function public.crear_cobro(p_monto numeric, p_concepto text, p_tel text default null)
returns table (id bigint, referencia text, token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare aj jsonb; tel text; c cobros;
begin
  if not es_equipo() then raise exception 'Solo el equipo crea cobros.'; end if;
  select valor into aj from ajustes where clave = 'cobro';
  if not clabe_valida(coalesce(aj->>'clabe', '')) or coalesce(trim(aj->>'beneficiario'), '') = '' then
    raise exception 'Falta configurar la CLABE y el beneficiario del negocio.';
  end if;
  tel := nullif(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), '');
  if tel is not null and length(tel) = 12 and left(tel, 2) = '52' then tel := right(tel, 10); end if;
  insert into cobros (monto, concepto, cliente_tel) values (round(p_monto, 2), coalesce(nullif(concepto_spei(p_concepto), ''), 'PAGO'), tel)
  returning * into c;
  return query select c.id, c.referencia, c.token;
end $$;

-- Lo que ve el cliente con su enlace (sin teléfono).
create or replace function public.cobro_por_token(t text)
returns table (negocio text, beneficiario text, clabe text, dimo text, monto numeric, concepto text, referencia text, estado text)
language sql stable security definer set search_path = public as $$
  select (select valor->>'nombre' from ajustes where clave = 'negocio'), a.valor->>'beneficiario', a.valor->>'clabe', nullif(a.valor->>'dimo', ''),
         c.monto, c.concepto, c.referencia, c.estado
    from cobros c, ajustes a
   where c.token = t and a.clave = 'cobro' and clabe_valida(a.valor->>'clabe')
$$;

-- "Ya pagué": solo avisa al equipo; marcar pagado lo hace el equipo al ver el dinero (o la conciliación).
create or replace function public.avisar_pago(t text) returns text
language plpgsql security definer set search_path = public as $$
declare c cobros;
begin
  select * into c from cobros where token = t for update;
  if not found then raise exception 'No encontramos ese cobro.'; end if;
  if c.estado = 'pendiente' then update cobros set estado = 'avisado', avisado_en = now() where id = c.id; return 'avisado'; end if;
  return c.estado;
end $$;

-- ════════════════════════════ 5. AUTOFACTURA (CFDI 4.0) ════════════════════════════
-- El negocio sube sus tickets (folio, total, conceptos); el cliente pide su factura con folio + total;
-- el servidor (servidor/facturas.js, llave de servicio) timbra con Facturama y la manda por correo.
create table if not exists public.tickets (
  folio text primary key check (folio ~ '^[A-Z0-9-]{1,20}$'),
  fecha date not null,
  total numeric(10,2) not null check (total > 0),
  forma_pago text not null default '03' check (forma_pago ~ '^[0-9]{2}$'),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0)
);
create table if not exists public.facturas (
  id bigint generated always as identity primary key,
  folio text not null unique references public.tickets(folio),
  rfc text not null check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  nombre text not null check (length(nombre) between 1 and 254),
  cp text not null check (cp ~ '^[0-9]{5}$'),
  regimen text not null check (regimen ~ '^[0-9]{3}$'),
  uso text not null check (uso ~ '^[A-Z][0-9]{2}$'),
  correo text not null check (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(correo) <= 120),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'timbrada', 'error')),
  intentos int not null default 0,
  uuid text, facturama_id text, error text,
  creada timestamptz not null default now(),
  timbrada timestamptz
);
alter table public.tickets enable row level security;
alter table public.facturas enable row level security;
drop policy if exists "equipo maneja tickets" on public.tickets;
create policy "equipo maneja tickets" on public.tickets for all using (public.es_equipo()) with check (public.es_equipo());
drop policy if exists "equipo ve facturas" on public.facturas;
create policy "equipo ve facturas" on public.facturas for select using (public.es_equipo());
revoke all on public.tickets, public.facturas from anon, authenticated;
grant select, insert, update, delete on public.tickets to authenticated;
grant select on public.facturas to authenticated;

-- La dueña reintenta una que falló (después de corregir el ticket o los datos de la cuenta de Facturama).
create or replace function public.reintentar_factura(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_duena() then raise exception 'Solo la dueña.'; end if;
  update facturas set estado = 'pendiente', intentos = 0, error = null where id = p_id and estado = 'error';
end $$;

-- Pedir factura desde la página. Plazo: el mes de la compra + 3 días (como kit/cfdi.js → enPlazo).
-- La validación completa del RFC (dígito verificador, régimen/uso por tipo) la hace el servidor antes de timbrar.
create or replace function public.pedir_factura(p_folio text, p_total numeric, p_rfc text, p_nombre text, p_cp text,
  p_regimen text, p_uso text, p_correo text) returns bigint
language plpgsql security definer set search_path = public as $$
declare t tickets; f text; nuevo bigint;
begin
  f := upper(trim(coalesce(p_folio, '')));
  select * into t from tickets where folio = f;
  if not found or abs(t.total - coalesce(p_total, -1)) > 0.01 then raise exception 'No encontramos ese ticket con ese total. Revisa tu ticket.'; end if;
  if ahora_local()::date >= (date_trunc('month', t.fecha) + interval '1 month' + interval '3 days')::date then
    raise exception 'Este ticket ya no se puede facturar: el plazo es dentro del mes de la compra.';
  end if;
  if exists (select 1 from facturas where folio = f) then raise exception 'Ese ticket ya tiene factura solicitada.'; end if;
  if (select count(*) from facturas where creada > now() - interval '10 minutes') >= 30 then raise exception 'Demasiadas solicitudes. Intenta en unos minutos.'; end if;
  insert into facturas (folio, rfc, nombre, cp, regimen, uso, correo)
  values (f, upper(trim(p_rfc)), upper(trim(p_nombre)), trim(p_cp), p_regimen, upper(p_uso), lower(trim(p_correo)))
  returning id into nuevo;
  return nuevo;
end $$;

create or replace function public.estado_factura(p_folio text) returns text
language sql stable security definer set search_path = public as $$
  select estado from facturas where folio = upper(trim(p_folio))
$$;

-- Para el servidor: solicitudes por timbrar con su ticket (máximo 3 intentos).
drop function if exists public.facturas_por_timbrar();
create function public.facturas_por_timbrar()
returns table (id bigint, folio text, rfc text, nombre text, cp text, regimen text, uso text, correo text, forma_pago text, items jsonb, intentos int)
language sql stable security definer set search_path = public as $$
  select f.id, f.folio, f.rfc, f.nombre, f.cp, f.regimen, f.uso, f.correo, t.forma_pago, t.items, f.intentos
    from facturas f join tickets t on t.folio = f.folio
   where f.estado = 'pendiente' and f.intentos < 3 order by f.creada limit 20
$$;

-- ════════════════════════════ 6. CALENDARIO (Google Calendar, iPhone, Outlook) ════════════════════════════
-- Un enlace secreto por persona (o de todo el negocio) que el calendario del teléfono se suscribe a leer.
-- Lo sirve la función `calendario` (servidor, llave de servicio): ?t=<token>.
create table if not exists public.calendarios (
  token text primary key default encode(gen_random_bytes(16), 'hex'),
  personal text references public.personal(id) on delete cascade,  -- null = todo el negocio
  creado timestamptz not null default now()
);
alter table public.calendarios enable row level security;
drop policy if exists "dueña maneja calendarios" on public.calendarios;
create policy "dueña maneja calendarios" on public.calendarios for all using (public.es_duena()) with check (public.es_duena());
revoke all on public.calendarios from anon, authenticated;
grant select, insert, delete on public.calendarios to authenticated;

create or replace function public.citas_calendario(t text)
returns table (id uuid, inicio timestamp, fin timestamp, estado text, servicio text, personal text, cliente_nombre text, cliente_tel text)
language sql stable security definer set search_path = public as $$
  select c.id, c.inicio, c.fin, c.estado, s.nombre, p.nombre, c.cliente_nombre, c.cliente_tel
    from calendarios k join citas c on (k.personal is null or c.personal = k.personal)
    join servicios s on s.id = c.servicio join personal p on p.id = c.personal
   where k.token = t and c.inicio > ahora_local() - interval '14 days' and c.inicio < ahora_local() + interval '90 days'
   order by c.inicio
$$;

revoke all on function public.facturas_por_timbrar(), public.citas_calendario(text) from public, anon, authenticated;
revoke all on function public.crear_cobro(numeric, text, text), public.reintentar_factura(bigint) from public, anon;
grant execute on function public.crear_cobro(numeric, text, text), public.reintentar_factura(bigint) to authenticated;
grant execute on function public.cobro_por_token(text), public.avisar_pago(text), public.pedir_factura(text, numeric, text, text, text, text, text, text),
  public.estado_factura(text) to anon, authenticated;
