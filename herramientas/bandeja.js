import { clasificar, ruta, RUTAS } from "../kit/mensajes.js";
import { plan } from "../kit/reactivacion.js";
import { ahoraLocal, fechaMas } from "../kit/agenda.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
const ETIQ = { queja: "Queja", estado_pedido: "¿Dónde está mi pedido?", pedido: "Pedido", cita: "Cita", precio: "Precio", horario: "Horario", ubicacion: "Ubicación", pago: "Pago", factura: "Factura", saludo: "Saludo", gracias: "Gracias", otro: "Otro" };
const CORTO = { responder: "Contesta la IA", preguntar: "Falta un dato", persona: "A una persona", seguimiento: "Seguimiento" };
const CLASE = { responder: "confirmada", preguntar: "pendiente", persona: "no_asistio", seguimiento: "asistio" };
const EJEMPLOS = [
  ["09:02", "Laura", "¿A qué hora abren hoy?"], ["09:15", "Jorge", "Mi pedido 4823 llegó incompleto, faltó una galleta"],
  ["09:20", "Sofía", "¿Cuánto cuesta la limpieza dental?"], ["09:41", "Pedro", "¿Ya viene mi pedido?"],
  ["10:05", "Carmen", "Quiero agendar una cita para el jueves"], ["10:30", "Raúl", "¿Me pasan la CLABE para la transferencia?"],
  ["11:12", "Ana", "Gracias!"], ["11:30", "Mike", "Hi! How much is a cappuccino?"],
  ["12:01", "Luis", "Necesito factura, ¿qué datos les paso?"], ["12:45", "Diana", "Quiero hablar con el encargado por favor"],
];
let mensajes = EJEMPLOS.map(([hora, quien, texto]) => ({ hora, quien, texto }));

function pintarBandeja() {
  const filas = mensajes.map((m) => ({ ...m, c: clasificar(m.texto) })).map((m) => ({ ...m, r: ruta(m.c) }));
  const cuenta = (r) => filas.filter((f) => f.r === r).length;
  $("#resumen-rutas").innerHTML = `<div><b>${cuenta("responder")}</b><span>contesta la asistente</span></div><div><b>${cuenta("preguntar")}</b><span>falta un dato</span></div><div><b>${cuenta("persona")}</b><span>para una persona</span></div>`;
  $("#bandeja").innerHTML = filas.map((f) => `<li><span class="hora">${esc(f.hora)}</span><div>
    <div class="quien"><b>${esc(f.quien)}</b><span class="pill ${CLASE[f.r]}" title="${esc(RUTAS[f.r])}">${esc(CORTO[f.r])}</span>${f.c.urgencia === "alta" ? '<span class="pill no_asistio">Urgente</span>' : ""}</div>
    <div class="det">“${esc(f.texto)}” · ${esc(ETIQ[f.c.intencion])}${f.c.pedido ? ` · pedido ${esc(f.c.pedido)}` : ""}${f.c.motivo ? ` · ${esc(f.c.motivo)}` : ""}</div></div></li>`).join("");
}
$("#probar").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#msj").value.trim();
  if (!t) return;
  const h = ahoraLocal().hora;
  mensajes = [{ hora: h, quien: "Tú", texto: t }, ...mensajes];
  $("#msj").value = "";
  pintarBandeja();
});

const hoy = ahoraLocal().fecha;
const hace = (n) => fechaMas(hoy, -n);
const CLIENTES = [
  { tel: "6690000101", nombre: "Laura Méndez", compras: [hace(12)] },
  { tel: "6690000102", nombre: "Jorge Ibarra", compras: [hace(40), hace(36), hace(32), hace(28), hace(24)] },
  { tel: "6690000103", nombre: "Sofía Ramos", compras: [hace(45)] },
  { tel: "6690000104", nombre: "Pedro Tirado", compras: [hace(120), hace(100)] },
  { tel: "6690000105", nombre: "Carmen Osuna", compras: [hace(3)] },
  { tel: "6690000106", nombre: "Raúl Lizárraga", compras: [hace(60)], baja: true },
  { tel: "6690000107", nombre: "Ana Gómez", compras: [hace(33)], ultimoMensaje: hace(5) },
  { tel: "6690000108", nombre: "Mariana Cota", compras: [hace(9)] },
  { tel: "6690000109", nombre: "Iván Osuna", compras: [hace(70), hace(64), hace(58), hace(52), hace(46)] },
];
function pintarPlan() {
  const p = plan({ clientes: CLIENTES, hoy, negocio: "Café La Muestra", oferta: $("#oferta").value });
  $("#plan-resumen").innerHTML = `<div class="kpis"><div><b>${p.total}</b><span>mensajes hoy</span></div><div><b>${pesos(p.costo)}</b><span>costo en WhatsApp</span></div><div><b>${CLIENTES.length - p.total}</b><span>se quedan fuera (recientes, baja o ya contactados)</span></div></div>`;
  $("#plan").innerHTML = p.grupos.filter((g) => g.clientes.length).map((g) => `<div class="paso"><b>${esc(g.titulo)}</b><ul class="lista-citas">` +
    g.clientes.map((c) => `<li><span class="hora">${c.compras.length}×</span><div><div class="quien"><b>${esc(c.nombre)}</b></div>
      <div class="mensaje-wa" style="margin-top:6px">${esc(c.mensaje)}</div>
      <div class="acciones-mini"><a class="wa" target="_blank" rel="noopener" href="https://wa.me/52${c.tel}?text=${encodeURIComponent(c.mensaje)}">Abrir en WhatsApp</a></div></div></li>`).join("") +
    `</ul></div>`).join("") + `<p class="sub">En el sistema real salen solos como mensaje de marketing (≈ MXN 0.73 cada uno en México) y las respuestas llegan a la bandeja.</p>`;
}
$("#oferta").addEventListener("input", pintarPlan);
pintarBandeja(); pintarPlan();
