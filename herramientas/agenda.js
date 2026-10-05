// Agenda: vista del cliente (apartar) y de la recepción (día, recordatorios, asistencia).
import * as A from "../kit/agenda.js";
import { almacenAgenda } from "../kit/almacen-agenda.js";
import { SUPABASE } from "../kit/config.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const ESTADO = { pendiente: "Por confirmar", confirmada: "Confirmada", cancelada: "Cancelada", asistio: "Asistió", no_asistio: "No llegó" };
const almacen = almacenAgenda(SUPABASE ? { supabase: SUPABASE } : { demo: "adn-demo-agenda" });
const enlaceCita = (token) => new URL(`cita.html#${token}`, location.href).href;

let negocio, servicios, personal;
const sel = { servicio: null, persona: null, dia: null, hora: null, diaNegocio: null };

function botones(cont, items, activo, alElegir) {
  cont.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-pressed", it.id === activo);
    b.innerHTML = `${esc(it.texto)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}`;
    b.addEventListener("click", () => alElegir(it.id));
    cont.appendChild(b);
  }
}
function proximosDias(n) {
  const hoy = A.ahoraLocal().fecha, dias = [];
  for (let i = 0; dias.length < n && i < 21; i++) {
    const f = A.fechaMas(hoy, i);
    if (negocio.horario[A.diaSemana(f)]) dias.push(f);
  }
  return dias;
}
const etiquetaDia = (f) => {
  const hoy = A.ahoraLocal().fecha;
  const [dia, num, , mes] = A.fechaLarga(f).split(" ");
  const texto = f === hoy ? "Hoy" : f === A.fechaMas(hoy, 1) ? "Mañana" : dia[0].toUpperCase() + dia.slice(1);
  return { texto, sub: `${num} ${mes}` };
};

// ───── Cliente ─────
function pintarCliente() {
  botones($("#servicios"), servicios.map((s) => ({ id: s.id, texto: s.nombre, sub: `${s.minutos} min${s.precio ? " · " + pesos(s.precio) : ""}` })), sel.servicio, (id) => { sel.servicio = id; sel.persona = null; sel.hora = null; pintarCliente(); });
  const serv = servicios.find((s) => s.id === sel.servicio);
  const gente = serv ? personal.filter((p) => serv.personal.includes(p.id)) : [];
  botones($("#personas"), [{ id: null, texto: "Quien esté libre" }, ...gente.map((p) => ({ id: p.id, texto: p.nombre }))], sel.persona, (id) => { sel.persona = id; sel.hora = null; pintarCliente(); });
  botones($("#dias"), proximosDias(7).map((f) => ({ id: f, ...etiquetaDia(f) })), sel.dia, (id) => { sel.dia = id; sel.hora = null; pintarCliente(); });
  pintarHoras();
}
async function pintarHoras() {
  const cont = $("#horas");
  if (!sel.servicio || !sel.dia) { cont.innerHTML = `<p class="vacio">Elige servicio y día para ver los horarios libres.</p>`; return; }
  const libres = await almacen.libres(sel.servicio, sel.dia, sel.persona);
  if (!libres.length) { cont.innerHTML = `<p class="vacio">Ya no hay horarios libres ese día. Prueba otro.</p>`; return; }
  cont.innerHTML = "";
  for (const l of libres) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = l.hora; b.setAttribute("aria-pressed", l.hora === sel.hora);
    b.setAttribute("aria-label", A.horaBonita(l.hora));
    b.addEventListener("click", () => { sel.hora = l.hora; pintarHoras(); });
    cont.appendChild(b);
  }
}
$("#forma-cita").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#c-error"), ok = $("#c-ok");
  err.hidden = true;
  if (!sel.servicio || !sel.dia || !sel.hora) { err.textContent = "Elige servicio, día y hora."; err.hidden = false; return; }
  try {
    const nombre = $("#c-nombre").value, tel = $("#c-tel").value;
    const r = await almacen.reservar({ servicioId: sel.servicio, fecha: sel.dia, hora: sel.hora, nombre, tel, personalId: sel.persona });
    const cita = { cliente: { nombre: nombre.trim() }, fecha: sel.dia, hora: sel.hora };
    const servicio = servicios.find((s) => s.id === sel.servicio), persona = personal.find((p) => p.id === r.personal);
    const texto = A.mensajeConfirmacion({ cita, negocio, servicio, persona, enlace: enlaceCita(r.token) });
    ok.innerHTML = `<b>¡Cita apartada!</b><div class="mensaje-wa">${esc(texto)}</div>
      <div class="acciones-mini"><a href="cita.html#${esc(r.token)}">Ver mi cita</a>
      <a class="wa" target="_blank" rel="noopener" href="https://wa.me/52${A.limpiarTel(tel)}?text=${encodeURIComponent(texto)}">Mandarme la confirmación</a></div>
      <p class="sub">En el sistema real este mensaje sale solo por WhatsApp. En la demo el botón abre tu WhatsApp.</p>`;
    ok.hidden = false;
    sel.hora = null; $("#forma-cita").reset();
    sel.diaNegocio = sel.dia;
    pintarHoras(); pintarNegocio();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
});

// ───── Negocio ─────
async function pintarNegocio() {
  const dias = proximosDias(6);
  if (!sel.diaNegocio) sel.diaNegocio = dias.find((f) => f > A.ahoraLocal().fecha) || dias[0];
  botones($("#dias-negocio"), dias.map((f) => ({ id: f, ...etiquetaDia(f) })), sel.diaNegocio, (id) => { sel.diaNegocio = id; pintarNegocio(); });

  const todas = await almacen.todas();
  const r = A.resumen(todas);
  const deHoy = todas.filter((c) => c.fecha === sel.diaNegocio && c.estado !== "cancelada").length;
  $("#kpis").innerHTML = `<div><b>${deHoy}</b><span>citas ese día</span></div><div><b>${r.confirmadas}</b><span>confirmadas</span></div>` +
    `<div><b>${r.inasistencia == null ? "—" : Math.round(r.inasistencia * 100) + "%"}</b><span>no llegan (historial)</span></div>`;

  const pend = A.porRecordar(todas, A.ahoraLocal(), 24);
  $("#por-recordar").innerHTML = pend.length
    ? `<p class="aviso-demo" style="margin:0"><span><b>${pend.length} por recordar</b> en las próximas 24 horas. En el sistema real salen solos cada hora; aquí puedes mandarlos a mano.</span></p>`
    : "";

  const citas = (await almacen.citasDe(sel.diaNegocio));
  const ul = $("#citas");
  if (!citas.length) { ul.innerHTML = `<li><span></span><span class="vacio">Sin citas este día.</span></li>`; return; }
  ul.innerHTML = "";
  for (const c of citas) {
    const s = servicios.find((x) => x.id === c.servicio), p = personal.find((x) => x.id === c.personal);
    const li = document.createElement("li");
    li.innerHTML = `<span class="hora">${esc(c.hora)}</span><div>
      <div class="quien"><b>${esc(c.cliente.nombre)}</b><span class="pill ${c.estado}">${ESTADO[c.estado]}</span>${c.recordada ? '<span class="pill confirmada">Recordada</span>' : ""}</div>
      <div class="det">${esc(s?.nombre || c.servicio)} · ${esc(p?.nombre || c.personal)} · ${c.minutos} min</div>
      <div class="acciones-mini"></div></div>`;
    const acc = li.querySelector(".acciones-mini");
    const boton = (texto, fn, clase = "") => { const b = document.createElement("button"); b.type = "button"; b.textContent = texto; if (clase) b.className = clase; b.addEventListener("click", fn); acc.appendChild(b); };
    if (["pendiente", "confirmada"].includes(c.estado)) {
      const texto = A.mensajeRecordatorio({ cita: c, negocio, servicio: s, persona: p, enlace: enlaceCita(c.token) });
      const a = document.createElement("a");
      a.className = "wa"; a.target = "_blank"; a.rel = "noopener"; a.textContent = c.recordada ? "Recordar otra vez" : "Mandar recordatorio";
      a.href = `https://wa.me/52${c.cliente.tel}?text=${encodeURIComponent(texto)}`;
      a.addEventListener("click", async () => { await almacen.marcarRecordada(c.id); setTimeout(pintarNegocio, 300); });
      acc.appendChild(a);
      boton("Asistió", async () => { await almacen.marcar(c.id, "asistio"); pintarNegocio(); });
      boton("No llegó", async () => { await almacen.marcar(c.id, "no_asistio"); pintarNegocio(); });
      boton("Cancelar", async () => { await almacen.marcar(c.id, "cancelada"); pintarNegocio(); pintarHoras(); });
    }
    ul.appendChild(li);
  }
}

// ───── Arranque ─────
(async () => {
  [negocio, servicios, personal] = await Promise.all([almacen.negocio(), almacen.servicios(), almacen.personal()]);
  if (almacen.modo === "demo") {
    $("#aviso-demo").hidden = false;
    $("#reiniciar").addEventListener("click", () => { almacen.reiniciar(); location.reload(); });
  }
  sel.servicio = servicios[0]?.id || null;
  sel.dia = proximosDias(7).find((f) => f > A.ahoraLocal().fecha) || proximosDias(1)[0];
  pintarCliente();
  pintarNegocio();
})().catch((e) => { document.querySelector("#contenido").insertAdjacentHTML("afterbegin", `<p class="error-msj" role="alert">No pude cargar la agenda: ${esc(e.message)}</p>`); });
