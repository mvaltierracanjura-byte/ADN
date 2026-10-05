// Prueba schema.sql en Postgres real (PGlite: Postgres compilado a WASM) simulando los roles y el esquema
// `auth` de Supabase. No necesita cuenta ni Docker. PGlite se instala FUERA del repo:
//   mkdir -p ~/adn-deps && cd ~/adn-deps && npm i @electric-sql/pglite
//   ADN_DEPS=~/adn-deps node supabase/test-schema.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const deps = process.env.ADN_DEPS;
const req = createRequire(deps ? join(deps, "package.json") : import.meta.url);
const cargar = async (m) => import(pathToFileURL(req.resolve(m)).href);
const { PGlite } = await cargar("@electric-sql/pglite");
const { btree_gist } = await cargar("@electric-sql/pglite/contrib/btree_gist");
const { pgcrypto } = await cargar("@electric-sql/pglite/contrib/pgcrypto");

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
let fallas = 0, total = 0;
const ok = (cond, msg) => { total++; console.log(`${cond ? "✔" : "✘"} ${msg}`); if (!cond) fallas++; };
const falla = async (sql, patron, msg) => {
  total++;
  try { await db.exec(sql); console.log(`✘ ${msg} (debió fallar)`); fallas++; }
  catch (e) {
    const bien = !patron || patron.test(e.message);
    console.log(`${bien ? "✔" : "✘"} ${msg} → ${e.message.split("\n")[0]}`);
    if (!bien) fallas++;
  }
};
const filas = async (sql) => (await db.query(sql)).rows;
const como = (rol, sub = "") => db.exec(`reset role; set request.jwt.claim.role = '${rol}'; set request.jwt.claim.sub = '${sub}'; set role ${rol};`);
const DUENA = "11111111-1111-1111-1111-111111111111", EQUIPO = "22222222-2222-2222-2222-222222222222", EXTRANO = "33333333-3333-3333-3333-333333333333";

// --- Lo que Supabase ya trae: roles, auth.uid(), permisos por defecto ---
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid(), auth.role() to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await db.exec(schema);
await db.exec(schema); // idempotente
ok(true, "schema.sql corre dos veces sin error");

// --- Datos del negocio (como dueña / postgres) ---
await db.exec(`
  insert into equipo values ('${DUENA}', 'Dueña', 'duena'), ('${EQUIPO}', 'Recepción', 'equipo');
  insert into ajustes (clave, valor) values ('negocio', '{"nombre":"Consultorio Sonrisa","zona":"America/Mazatlan","anticipacionMin":60,"diasAdelante":30,
    "horario":{"0":[["09:00","18:00"]],"1":[["09:00","18:00"]],"2":[["09:00","18:00"]],"3":[["09:00","18:00"]],"4":[["09:00","18:00"]],"5":[["09:00","18:00"]],"6":[["09:00","18:00"]]}}'),
    ('secreto', '{"x":1}');
  insert into personal (id, nombre, horario) values ('ana', 'Dra. Ana', null),
    ('luis', 'Dr. Luis', '{"0":[["16:00","18:00"]],"1":[["16:00","18:00"]],"2":[["16:00","18:00"]],"3":[["16:00","18:00"]],"4":[["16:00","18:00"]],"5":[["16:00","18:00"]],"6":[["16:00","18:00"]]}');
  insert into servicios (id, nombre, minutos, precio, personal) values
    ('limpieza', 'Limpieza', 45, 600, '{ana,luis}'), ('blanqueamiento', 'Blanqueamiento', 90, 2500, '{ana}'),
    ('retirado', 'Retirado', 30, 100, '{ana}');
  update servicios set activo = false where id = 'retirado';
`);
const [{ hoy }] = await filas(`select to_char(ahora_local()::date, 'YYYY-MM-DD') as hoy`);
const dia = (n) => { const d = new Date(hoy); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const D2 = dia(2), D3 = dia(3);
const reservar = (serv, fecha, hora, nombre, tel, persona = null) =>
  `select * from reservar_cita('${serv}', '${fecha}', '${hora}', '${nombre}', '${tel}', ${persona ? `'${persona}'` : "null"})`;

// --- Público (anon) ---
await como("anon");
ok((await filas(`select id from servicios order by id`)).map((r) => r.id).join() === "blanqueamiento,limpieza", "anon ve solo servicios activos");
ok((await filas(`select clave from ajustes order by clave`)).map((r) => r.clave).join() === "negocio", "anon ve el ajuste público, no los demás");
await falla(`select * from citas`, /permission denied/, "anon no puede leer la tabla de citas");

const r1 = (await filas(reservar("limpieza", D2, "09:00", "María López", "+52 669 123 4567")))[0];
ok(r1 && r1.personal === "ana" && r1.token.length === 24, "reservar: asigna a Ana (Luis no trabaja en la mañana) y da token");
await falla(reservar("limpieza", D2, "09:30", "Pedro", "6690000001"), /ya no está disponible/, "no deja encimar con la cita de Ana");
await falla(reservar("limpieza", D2, "08:30", "Pedro", "6690000001"), /ya no está disponible/, "fuera de horario");
await falla(reservar("limpieza", D2, "17:30", "Pedro", "6690000001"), /ya no está disponible/, "termina después del cierre (17:30 + 45)");
const t1 = (await filas(reservar("limpieza", D2, "16:00", "Ana B", "6690000002")))[0];
const t2 = (await filas(reservar("limpieza", D2, "16:00", "Carlos", "6690000003")))[0];
ok(t1.personal === "ana" && t2.personal === "luis", "16:00: la primera con Ana, la segunda con Luis");
await falla(reservar("limpieza", D2, "16:00", "Diana", "6690000004"), /ya no está disponible/, "16:00: la tercera ya no cabe");
await falla(reservar("retirado", D2, "11:00", "Diana", "6690000004"), /no existe/, "servicio inactivo");
await falla(reservar("limpieza", D2, "11:00", "Diana", "123"), /10 dígitos/, "teléfono inválido");
await falla(reservar("limpieza", D2, "11:00", "  ", "6690000004"), /nombre/, "sin nombre");
await falla(reservar("limpieza", hoy, "00:00", "Diana", "6690000004"), /ya pasó|muy cerca/, "hora que ya pasó");
await falla(reservar("limpieza", dia(40), "11:00", "Diana", "6690000004"), /Todavía no abrimos/, "más allá de los días permitidos");
await falla(reservar("blanqueamiento", D2, "16:30", "Diana", "6690000004", "luis"), /ya no está disponible/, "persona que no da ese servicio");

for (const h of ["10:00", "11:00"]) await db.query(reservar("limpieza", D3, h, "Frecuente", "6690000009"));
await db.query(reservar("limpieza", D3, "12:00", "Frecuente", "6690000009"));
await falla(reservar("limpieza", D3, "13:00", "Frecuente", "6690000009"), /3 citas/, "máximo 3 citas futuras por teléfono");

const ocup = await filas(`select * from agenda_ocupado('${D2}', '${D2}')`);
ok(ocup.length === 3 && Object.keys(ocup[0]).join() === "personal,inicio,fin", "agenda_ocupado: 3 ocupados, sin datos del cliente");

const vista = (await filas(`select * from cita_por_token('${r1.token}')`))[0];
ok(vista.servicio === "Limpieza" && vista.personal === "Dra. Ana" && vista.cliente === "María" && vista.estado === "pendiente", "cita_por_token: datos y solo el primer nombre");
ok((await filas(`select * from cita_por_token('no-existe')`)).length === 0, "token desconocido no devuelve nada");

ok((await filas(`select cambiar_estado_cita('${r1.token}', 'confirmada') as e`))[0].e === "confirmada", "el cliente confirma con su enlace");
await falla(`select cambiar_estado_cita('${r1.token}', 'asistio')`, /no válida/, "el cliente no puede marcarse como asistió");
const nueva = (await filas(`select reprogramar_cita('${r1.token}', '${D2}', '11:00') as i`))[0];
ok(String(nueva.i).includes("11:00"), "reprogramar a las 11:00");
ok((await filas(`select * from cita_por_token('${r1.token}')`))[0].estado === "pendiente", "el mismo enlace apunta a la cita nueva");
const libre9 = (await filas(reservar("limpieza", D2, "09:00", "Elena", "6690000005")))[0];
ok(libre9.personal === "ana", "el horario viejo (9:00) quedó libre");
ok((await filas(`select cambiar_estado_cita('${t1.token}', 'cancelada') as e`))[0].e === "cancelada", "el cliente cancela");
ok((await filas(reservar("limpieza", D2, "16:00", "Diana", "6690000004")))[0].personal === "ana", "cancelar libera el horario");
await falla(`select cambiar_estado_cita('${t1.token}', 'confirmada')`, /ya no se puede/, "una cita cancelada no se reactiva");
await falla(`select * from citas_por_recordar(48)`, /permission denied/, "anon no puede pedir las citas por recordar");
await falla(`insert into citas (servicio, personal, inicio, fin, cliente_nombre, cliente_tel) values ('limpieza','ana','${D2} 13:00','${D2} 13:45','X','6690000006')`, /permission denied/, "anon no inserta citas directo");

// --- La base impide encimar aunque se salten las funciones ---
await db.exec(`reset role`);
await falla(`insert into citas (servicio, personal, inicio, fin, cliente_nombre, cliente_tel) values ('limpieza','luis','${D2} 16:15','${D2} 17:00','X','6690000007')`, /citas_sin_encimar/, "restricción de la base: no hay dos citas encimadas");
await db.exec(`insert into bloqueos (personal, inicio, fin, motivo) values (null, '${D3} 14:00', '${D3} 16:00', 'Comida')`);
await como("anon");
await falla(reservar("limpieza", D3, "15:00", "Gabi", "6690000008"), /ya no está disponible/, "un bloqueo de todo el negocio impide reservar");

// --- Equipo ---
await como("authenticated", EXTRANO);
ok((await filas(`select * from citas`)).length === 0, "una cuenta que no está en `equipo` no ve citas");
await como("authenticated", EQUIPO);
const visibles = await filas(`select id, cliente_tel from citas where estado <> 'cancelada'`);
ok(visibles.length >= 6, `el equipo ve las citas (${visibles.length})`);
await db.exec(`update citas set estado = 'asistio' where id = '${visibles[0].id}'`);
ok((await filas(`select estado from citas where id = '${visibles[0].id}'`))[0].estado === "asistio", "el equipo marca asistió");
await falla(`update citas set cliente_tel = '0000000000' where id = '${visibles[0].id}'`, /permission denied/, "el equipo no cambia el teléfono del cliente");
const cambio = await db.query(`update ajustes set valor = '{}' where clave = 'negocio'`).catch((e) => ({ error: e }));
ok(cambio.error || cambio.affectedRows === 0, "el equipo (no dueña) no cambia ajustes");
await como("authenticated", DUENA);
const cambioD = await db.query(`update ajustes set actualizado = now() where clave = 'negocio'`);
ok(cambioD.affectedRows === 1, "la dueña sí edita ajustes");


// --- Asistente: conversaciones y mensajes ---
await db.exec(`reset role; insert into conversaciones (tel, nombre) values ('6691234567', 'María');
  insert into mensajes (tel, autor, texto, id_meta) values ('6691234567', 'cliente', 'Hola', 'wamid.1'), ('6691234567', 'asistente', '¡Hola!', null);`);
await falla(`insert into mensajes (tel, autor, texto, id_meta) values ('6691234567', 'cliente', 'Hola', 'wamid.1')`, /duplicate key/, "un aviso de Meta repetido no se guarda dos veces");
await como("anon");
await falla(`select * from mensajes`, /permission denied/, "anon no lee mensajes");
await falla(`select * from llamadas`, /permission denied/, "anon no lee llamadas");
await como("authenticated", EXTRANO);
ok((await filas(`select * from mensajes`)).length === 0, "una cuenta fuera del equipo no ve mensajes");
await como("authenticated", EQUIPO);
ok((await filas(`select * from mensajes`)).length === 2, "el equipo ve los mensajes");
await db.exec(`update conversaciones set estado = 'persona', motivo = 'la tomé' where tel = '6691234567'`);
ok((await filas(`select estado from conversaciones`))[0].estado === "persona", "el equipo toma la conversación");
await db.exec(`insert into mensajes (tel, autor, texto, enviado) values ('6691234567', 'equipo', 'Te ayudo yo', false)`);
ok(true, "el equipo escribe una respuesta pendiente de enviar");
await falla(`insert into mensajes (tel, autor, texto, enviado) values ('6691234567', 'asistente', 'Finjo ser la IA', false)`, /row-level security/, "el equipo no puede escribir como asistente");
await falla(`insert into mensajes (tel, autor, texto, enviado) values ('6691234567', 'equipo', 'x', true)`, /row-level security/, "el equipo no marca como enviado lo que no salió");
await falla(`select * from llamadas`, /permission denied/, "el equipo no ve llamadas en curso");
await db.exec(`reset role`);

// --- Servidor (llave de servicio = postgres en la prueba) ---
await db.exec(`reset role`);
const rec = await filas(`select * from citas_por_recordar(72)`);
ok(rec.length >= 1 && rec.every((c) => c.cliente_tel && c.servicio), `citas por recordar en 72 h: ${rec.length}, con teléfono y servicio`);

// --- 4. Cobros ---
const { referencia: refJs } = await import("../kit/cobro.js");
ok((await filas(`select ref_cobro(481) as r`))[0].r === refJs(481) && (await filas(`select ref_cobro(1234567) as r`))[0].r === refJs(1234567), "ref_cobro en SQL = referencia() de kit/cobro.js");
ok((await filas(`select clabe_valida('002010077777777771') as a, clabe_valida('002010077777777772') as b`)).map((r) => [r.a, r.b]).join() === "true,false", "clabe_valida: dígito de control");
ok((await filas(`select concepto_spei('Cita limpieza — Sofía #2') as c`))[0].c === "CITA LIMPIEZA SOFIA 2", "concepto_spei: sin acentos ni símbolos");
await como("authenticated", EQUIPO);
await falla(`select * from crear_cobro(600, 'Cita', '6691234567')`, /CLABE/, "sin CLABE configurada no se crean cobros");
await db.exec(`reset role; insert into ajustes (clave, valor) values ('cobro', '{"clabe":"002010077777777771","beneficiario":"Consultorio Sonrisa SC","dimo":""}')`);
await como("authenticated", EXTRANO);
await falla(`select * from crear_cobro(600, 'Cita', null)`, /Solo el equipo/, "una cuenta fuera del equipo no crea cobros");
await como("authenticated", EQUIPO);
const cb = (await filas(`select * from crear_cobro(600, 'Cita limpieza', '+52 669 123 4567')`))[0];
ok(cb.referencia === refJs(Number(cb.id)) && cb.token.length === 24, `crear_cobro: referencia ${cb.referencia} y token`);
await falla(`select * from crear_cobro(0, 'x', null)`, /check/, "monto cero no");
await falla(`insert into cobros (monto, concepto) values (1, 'X')`, /permission denied/, "el equipo no inserta cobros directo");
await como("anon");
await falla(`select * from cobros`, /permission denied/, "anon no lee cobros");
const vc = (await filas(`select * from cobro_por_token('${cb.token}')`))[0];
ok(vc.clabe === "002010077777777771" && Number(vc.monto) === 600 && vc.concepto === "CITA LIMPIEZA" && vc.negocio === "Consultorio Sonrisa" && !("cliente_tel" in vc), "cobro_por_token: CLABE y monto de la base, sin teléfono");
ok((await filas(`select * from cobro_por_token('falso')`)).length === 0, "token inventado no devuelve datos");
ok((await filas(`select avisar_pago('${cb.token}') as e`))[0].e === "avisado", "el cliente avisa que pagó");
ok((await filas(`select avisar_pago('${cb.token}') as e`))[0].e === "avisado", "avisar dos veces no cambia nada");
await como("authenticated", EQUIPO);
await db.exec(`update cobros set estado = 'pagado', pagado_en = now() where id = ${cb.id}`);
await falla(`update cobros set monto = 1 where id = ${cb.id}`, /permission denied/, "el equipo no cambia el monto");
await como("anon");
ok((await filas(`select avisar_pago('${cb.token}') as e`))[0].e === "pagado", "ya pagado: el aviso no lo regresa");
await db.exec(`reset role; update ajustes set valor = '{"clabe":"002010077777777772","beneficiario":"Otro"}' where clave = 'cobro'`);
await como("anon");
ok((await filas(`select * from cobro_por_token('${cb.token}')`)).length === 0, "con una CLABE inválida en ajustes no se muestran datos de pago");

// --- 5. Autofactura ---
await db.exec(`reset role; insert into tickets (folio, fecha, total, forma_pago, items) values
  ('LM482', ahora_local()::date, 175, '03', '[{"descripcion":"Latte","cantidad":2,"precio":65},{"descripcion":"Galleta","cantidad":1,"precio":45}]'),
  ('LM100', ahora_local()::date - 70, 90, '04', '[{"descripcion":"Latte","cantidad":1,"precio":90}]');`);
await como("anon");
await falla(`select * from tickets`, /permission denied/, "anon no ve los tickets");
const pf = (f, t, rfc = "EKU9003173C9") => `select pedir_factura('${f}', ${t}, '${rfc}', 'Escuela Kemper Urgate', '42501', '601', 'G03', 'compras@ejemplo.mx') as id`;
await falla(pf("LM482", 170), /No encontramos/, "total que no coincide con el ticket");
await falla(pf("NOEXISTE", 175), /No encontramos/, "folio que no existe");
await falla(pf("LM100", 90), /plazo/, "ticket de hace 70 días: fuera de plazo");
await falla(pf("LM482", 175, "123"), /check/, "RFC con formato inválido");
const idf = (await filas(pf("lm482", 175)))[0].id;
ok(idf > 0, "pedir_factura: folio en minúsculas también sirve");
await falla(pf("LM482", 175), /ya tiene factura/, "no se pide dos veces el mismo ticket");
ok((await filas(`select estado_factura('LM482') as e`))[0].e === "pendiente", "el cliente consulta el estado");
await falla(`select * from facturas_por_timbrar()`, /permission denied/, "anon no pide las facturas por timbrar");
await como("authenticated", EQUIPO);
ok((await filas(`select rfc from facturas`))[0].rfc === "EKU9003173C9", "el equipo ve las solicitudes");
await falla(`update facturas set estado = 'timbrada'`, /permission denied/, "el equipo no marca una factura como timbrada");
await db.exec(`reset role; update facturas set estado = 'error', intentos = 3, error = 'x' where id = ${idf}`);
await como("authenticated", EQUIPO);
await falla(`select reintentar_factura(${idf})`, /Solo la dueña/, "el equipo no reintenta");
await como("authenticated", DUENA);
await db.exec(`select reintentar_factura(${idf})`);
await db.exec(`reset role`);
const pt = await filas(`select * from facturas_por_timbrar()`);
ok(pt.length === 1 && pt[0].forma_pago === "03" && pt[0].items.length === 2, "la dueña reintenta y el servidor la ve con su ticket");

// --- 6. Calendario ---
await db.exec(`reset role; insert into calendarios (token, personal) values ('cal-ana', 'ana'), ('cal-todos', null)`);
const ca = await filas(`select * from citas_calendario('cal-ana')`), ct = await filas(`select * from citas_calendario('cal-todos')`);
ok(ca.length > 0 && ca.every((c) => c.personal === "Dra. Ana") && ct.length > ca.length, `calendario: Ana ${ca.length} citas, todo el negocio ${ct.length}`);
ok((await filas(`select * from citas_calendario('nada')`)).length === 0, "token desconocido: calendario vacío");
await como("anon");
await falla(`select * from citas_calendario('cal-ana')`, /permission denied/, "anon no lee el calendario directo (solo la función del servidor)");
await como("authenticated", EQUIPO);
ok((await filas(`select * from calendarios`)).length === 0, "el equipo (no dueña) no ve los enlaces de calendario");
await como("authenticated", DUENA);
ok((await filas(`select * from calendarios`)).length === 2, "la dueña ve y maneja los enlaces");
await db.exec(`reset role`);

console.log(`\n${total - fallas} de ${total} pruebas pasaron.`);
process.exit(fallas ? 1 : 0);
