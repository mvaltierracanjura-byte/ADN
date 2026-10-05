// Datos de la agenda: Supabase (cliente real) o demo (localStorage, mismo navegador). Misma interfaz.
//   const a = almacenAgenda({ supabase: { url, anonKey } })   // real
//   const a = almacenAgenda({ demo: "adn-demo-agenda" })       // demo con datos de ejemplo
// Público: negocio(), servicios(), personal(), libres(servicioId, fecha, personalId?), reservar(...),
//          cita(token), cambiar(token, "confirmada"|"cancelada"), reprogramar(token, fecha, hora)
// Equipo:  entrar(correo, clave), salir(), citasDe(fecha), marcar(id, estado), marcarRecordada(id), sesion()
import * as A from "./agenda.js";

const EJEMPLO = {
  negocio: { nombre: "Consultorio Dental Sonrisa", intervalo: 30, anticipacionMin: 60, diasAdelante: 21,
    horario: { 1: [["09:00", "14:00"], ["16:00", "20:00"]], 2: [["09:00", "14:00"], ["16:00", "20:00"]], 3: [["09:00", "14:00"], ["16:00", "20:00"]],
      4: [["09:00", "14:00"], ["16:00", "20:00"]], 5: [["09:00", "14:00"], ["16:00", "20:00"]], 6: [["09:00", "13:00"]] } },
  servicios: [
    { id: "revision", nombre: "Revisión", minutos: 30, precio: 400, personal: ["ana", "luis"] },
    { id: "limpieza", nombre: "Limpieza dental", minutos: 60, precio: 700, personal: ["ana", "luis"] },
    { id: "blanqueamiento", nombre: "Blanqueamiento", minutos: 90, precio: 2500, personal: ["ana"] },
  ],
  personal: [{ id: "ana", nombre: "Dra. Ana" }, { id: "luis", nombre: "Dr. Luis" }],
};

function semilla(ahora) {
  const d = { ...structuredClone(EJEMPLO), citas: [], bloqueos: [] };
  const nombres = ["Laura Méndez", "Jorge Ibarra", "Sofía Ramos", "Pedro Tirado", "Carmen Osuna", "Raúl Lizárraga", "Ana Gómez", "Luis Sánchez"];
  let n = 0;
  const poner = (fecha, hora, servicio, personal, estado, recordada = false) => {
    const s = d.servicios.find((x) => x.id === servicio);
    d.citas.push({ id: "ej" + n, token: "ejemplo" + n, servicio, personal, fecha, hora, minutos: s.minutos, estado, recordada,
      cliente: { nombre: nombres[n % nombres.length], tel: "66900000" + String(10 + n) } });
    n++;
  };
  // Pasadas (para la tasa de inasistencia), de hoy y de mañana.
  for (let i = 1; i <= 6; i++) {
    const f = A.fechaMas(ahora.fecha, -i);
    if (!d.negocio.horario[A.diaSemana(f)]) continue;
    poner(f, "10:00", "limpieza", "ana", i % 4 === 0 ? "no_asistio" : "asistio");
    poner(f, "17:00", "revision", "luis", i % 3 === 0 ? "no_asistio" : "asistio");
  }
  let manana = A.fechaMas(ahora.fecha, 1);
  while (!d.negocio.horario[A.diaSemana(manana)]) manana = A.fechaMas(manana, 1);
  poner(manana, "09:00", "limpieza", "ana", "pendiente");
  poner(manana, "10:30", "revision", "luis", "confirmada", true);
  poner(manana, "16:00", "blanqueamiento", "ana", "pendiente");
  poner(manana, "18:00", "revision", "luis", "pendiente");
  return d;
}

export function almacenAgenda({ supabase = null, demo = null, ahora = () => A.ahoraLocal() } = {}) {
  return supabase ? deSupabase(supabase, ahora) : deDemo(demo || "adn-demo-agenda", ahora);
}

// ───────────── Demo (localStorage) ─────────────
function deDemo(clave, ahora) {
  let memoria = null;
  const leer = () => {
    if (memoria) return memoria;
    try { memoria = JSON.parse(localStorage.getItem(clave)); } catch (e) { memoria = null; }
    if (!memoria) { memoria = semilla(ahora()); guardar(); }
    return memoria;
  };
  const guardar = () => { try { localStorage.setItem(clave, JSON.stringify(memoria)); } catch (e) {} };
  const ctx = () => { const d = leer(); return { negocio: d.negocio, servicios: d.servicios, personal: d.personal, citas: d.citas, bloqueos: d.bloqueos }; };
  const porToken = (t) => leer().citas.find((c) => c.token === t);
  const vista = (c) => {
    const d = leer(), s = d.servicios.find((x) => x.id === c.servicio), p = d.personal.find((x) => x.id === c.personal);
    return { servicio: s.nombre, servicioId: s.id, personal: p.nombre, fecha: c.fecha, hora: c.hora, minutos: c.minutos, estado: c.estado, cliente: c.cliente.nombre.split(" ")[0] };
  };
  const pasada = (c) => { const a = ahora(); return c.fecha < a.fecha || (c.fecha === a.fecha && c.hora <= a.hora); };
  return {
    modo: "demo",
    reiniciar() { memoria = semilla(ahora()); guardar(); },
    async negocio() { return leer().negocio; },
    async servicios() { return leer().servicios; },
    async personal() { return leer().personal; },
    async libres(servicioId, fecha, personalId = null) { return A.horariosLibres({ ...ctx(), servicioId, fecha, personalId, ahora: ahora() }); },
    async reservar({ servicioId, fecha, hora, nombre, tel, personalId = null }) {
      const futuras = leer().citas.filter((c) => c.cliente.tel === A.limpiarTel(tel) && ["pendiente", "confirmada"].includes(c.estado) && !pasada(c));
      if (futuras.length >= 3) throw new Error("Ya tienes 3 citas apartadas. Para más, escríbenos por WhatsApp.");
      const r = A.reservar({ ...ctx(), servicioId, fecha, hora, personalId, cliente: { nombre, tel }, ahora: ahora() });
      if (r.error) throw new Error(r.error);
      leer().citas.push(r.cita); guardar();
      return { token: r.cita.token, personal: r.cita.personal, id: r.cita.id };
    },
    async cita(t) { const c = porToken(t); return c ? vista(c) : null; },
    async cambiar(t, nuevo) {
      const c = porToken(t);
      if (!c) throw new Error("No encontramos esa cita.");
      if (!["confirmada", "cancelada"].includes(nuevo)) throw new Error("Acción no válida.");
      if (!["pendiente", "confirmada"].includes(c.estado) || pasada(c)) throw new Error("Esta cita ya no se puede cambiar.");
      c.estado = nuevo; guardar(); return nuevo;
    },
    async reprogramar(t, fecha, hora) {
      const c = porToken(t);
      if (!c) throw new Error("No encontramos esa cita.");
      if (pasada(c)) throw new Error("Esta cita ya no se puede cambiar.");
      const r = A.reprogramar({ ...ctx(), cita: c, fecha, hora, ahora: ahora() });
      if (r.error) throw new Error(r.error);
      Object.assign(c, r.cita); guardar(); return vista(c);
    },
    // Equipo (en la demo no hay contraseña)
    async entrar() { return { nombre: "Demo", rol: "duena" }; },
    async salir() {},
    sesion() { return { nombre: "Demo", rol: "duena" }; },
    async citasDe(fecha) { return leer().citas.filter((c) => c.fecha === fecha).sort((a, b) => A.aMin(a.hora) - A.aMin(b.hora)); },
    async todas() { return leer().citas; },
    async citasDeTelefono(tel) { const t = A.limpiarTel(tel); return leer().citas.filter((c) => c.cliente.tel === t && ["pendiente", "confirmada"].includes(c.estado) && !pasada(c)); },
    async marcar(id, estado) { const c = leer().citas.find((x) => x.id === id); if (!c) throw new Error("No existe."); c.estado = estado; guardar(); },
    async marcarRecordada(id) { const c = leer().citas.find((x) => x.id === id); if (c) { c.recordada = true; guardar(); } },
  };
}

// ───────────── Supabase (PostgREST con fetch, sin librerías) ─────────────
function deSupabase({ url, anonKey }, ahora) {
  let sesion = null;
  try { sesion = JSON.parse(sessionStorage.getItem("adn-sesion")); } catch (e) {}
  const hdr = () => ({ apikey: anonKey, Authorization: `Bearer ${sesion?.access_token || anonKey}`, "Content-Type": "application/json" });
  const pedir = async (ruta, op = {}) => {
    const r = await fetch(url + ruta, { ...op, headers: { ...hdr(), ...(op.headers || {}) } });
    const texto = await r.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!r.ok) throw new Error(datos?.message || datos?.error_description || `Error ${r.status}`);
    return datos;
  };
  const rpc = (fn, args) => pedir(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  const partir = (ts) => { const s = String(ts).replace(" ", "T"); return { fecha: s.slice(0, 10), hora: s.slice(11, 16) }; };
  const aCita = (c) => ({ id: c.id, token: c.token, servicio: c.servicio, personal: c.personal, ...partir(c.inicio),
    minutos: Math.round((new Date(c.fin) - new Date(c.inicio)) / 60000), estado: c.estado, recordada: c.recordada,
    cliente: { nombre: c.cliente_nombre, tel: c.cliente_tel } });
  let cache = null;
  const base = async () => cache || (cache = {
    negocio: (await pedir(`/rest/v1/ajustes?clave=eq.negocio&select=valor`))[0]?.valor || {},
    servicios: await pedir(`/rest/v1/servicios?activo=eq.true&select=*&order=nombre`),
    personal: await pedir(`/rest/v1/personal?activo=eq.true&select=*&order=nombre`),
  });
  return {
    modo: "supabase",
    async negocio() { return (await base()).negocio; },
    async servicios() { return (await base()).servicios; },
    async personal() { return (await base()).personal; },
    async libres(servicioId, fecha, personalId = null) {
      const b = await base();
      const ocup = await rpc("agenda_ocupado", { desde: fecha, hasta: fecha });
      // Citas y bloqueos llegan juntos y sin datos de clientes; para calcular huecos valen lo mismo.
      const bloqueos = ocup.map((o) => {
        const i = partir(o.inicio), f = partir(o.fin);
        return { personal: o.personal || null, fecha, desde: i.fecha < fecha ? "00:00" : i.hora, hasta: f.fecha > fecha ? "23:59" : f.hora };
      });
      return A.horariosLibres({ ...b, citas: [], bloqueos, servicioId, fecha, personalId, ahora: ahora() });
    },
    async reservar({ servicioId, fecha, hora, nombre, tel, personalId = null }) {
      const [r] = await rpc("reservar_cita", { p_servicio: servicioId, p_fecha: fecha, p_hora: hora, p_nombre: nombre, p_tel: tel, p_personal: personalId });
      return { token: r.token, personal: r.personal, id: r.id };
    },
    async cita(t) {
      const [c] = await rpc("cita_por_token", { t });
      return c ? { servicio: c.servicio, servicioId: c.servicio_id, personal: c.personal, ...partir(c.inicio), minutos: c.minutos, estado: c.estado, cliente: c.cliente } : null;
    },
    async cambiar(t, nuevo) { return rpc("cambiar_estado_cita", { t, nuevo }); },
    async reprogramar(t, fecha, hora) { await rpc("reprogramar_cita", { t, p_fecha: fecha, p_hora: hora }); return this.cita(t); },
    async entrar(correo, clave) {
      const r = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: correo, password: clave }) });
      const d = await r.json();
      if (!r.ok) throw new Error("Correo o contraseña incorrectos.");
      sesion = d;
      try { sessionStorage.setItem("adn-sesion", JSON.stringify(d)); } catch (e) {}
      return sesion;
    },
    async salir() { sesion = null; try { sessionStorage.removeItem("adn-sesion"); } catch (e) {} },
    sesion() { return sesion; },
    async citasDe(fecha) {
      const filas = await pedir(`/rest/v1/citas?inicio=gte.${fecha}T00:00:00&inicio=lt.${A.fechaMas(fecha, 1)}T00:00:00&order=inicio`);
      return filas.map(aCita);
    },
    async todas() { return (await pedir(`/rest/v1/citas?order=inicio.desc&limit=500`)).map(aCita); },
    // Solo en el servidor (llave de servicio): las citas activas de un teléfono.
    async citasDeTelefono(tel) {
      const a = ahora();
      const filas = await pedir(`/rest/v1/citas?cliente_tel=eq.${A.limpiarTel(tel)}&estado=in.(pendiente,confirmada)&inicio=gte.${a.fecha}T${a.hora}:00&order=inicio`);
      return filas.map(aCita);
    },
    async marcar(id, estado) { await pedir(`/rest/v1/citas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ estado }), headers: { Prefer: "return=minimal" } }); },
    async marcarRecordada(id) { await pedir(`/rest/v1/citas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ recordada: true }), headers: { Prefer: "return=minimal" } }); },
  };
}
