import * as P from "../kit/pronostico.js";
import { ahoraLocal, fechaMas, fechaLarga } from "../kit/agenda.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hoy = ahoraLocal().fecha;
// Ventas de ejemplo hasta hoy: el pronóstico es para mañana, como dice la herramienta.
let ventas = P.ventasEjemplo(hoy);
const ajustes = { calor: false, lluvia: false, evento: false };
const REGLAS = { calor: { "Frappé": 1.3, "*": 1 }, lluvia: 0.85, evento: 1.2 };
$("#fecha").value = hoy;

function pintar() {
  const fecha = $("#fecha").value || hoy;
  const colchon = +$("#colchon").value / 100;
  $("#colchon-o").value = Math.round(colchon * 100) + "%";
  const r = P.pronosticar({ ventas, fecha, ajustes, reglas: REGLAS, colchon });
  $("#t-res").textContent = `Para preparar el ${fechaLarga(fecha)}`;
  $("#tabla").innerHTML = r.map((p) => `<tr><td>${esc(p.producto)}${p.tendencia !== 1 ? ` <small class="sub">${p.tendencia > 1 ? "▲" : "▼"} ${Math.round(Math.abs(p.tendencia - 1) * 100)}%</small>` : ""}</td>
    <td class="num">${Math.round(p.estimado)}</td><td class="num">${p.bajo}–${p.alto}</td><td class="num"><b>${p.preparar}</b></td></tr>`).join("");
  const ev = P.evaluar({ ventas, dias: 14, reglas: REGLAS, colchon });
  $("#evaluacion").textContent = ev
    ? `Prueba con tus últimas 2 semanas: el pronóstico se equivoca en promedio ${Math.round(ev.error * 100)}%, contra ${Math.round(ev.errorIngenuo * 100)}% de copiar el mismo día de la semana pasada.`
    : "";
}
document.querySelectorAll("[data-ajuste]").forEach((b) => b.addEventListener("click", () => {
  const k = b.dataset.ajuste; ajustes[k] = !ajustes[k]; b.setAttribute("aria-pressed", ajustes[k]); pintar();
}));
$("#fecha").addEventListener("change", pintar);
$("#colchon").addEventListener("input", pintar);
$("#archivo").addEventListener("change", async () => {
  const f = $("#archivo").files[0];
  if (!f) return;
  try {
    const v = P.leerVentas(await f.text());
    if (!v.length) throw new Error("No encontré renglones con fecha AAAA-MM-DD.");
    ventas = v;
    const ult = v.map((x) => x.fecha).sort().at(-1);
    $("#fecha").value = fechaMas(ult, 1);
    $("#datos-estado").textContent = `✓ ${v.length} renglones, hasta el ${ult}. Tus datos no salen de tu navegador.`;
    $("#datos-estado").style.color = "var(--ok)";
    pintar();
  } catch (e) { $("#datos-estado").textContent = e.message; $("#datos-estado").style.color = "var(--a)"; }
});
$("#datos-estado").textContent = "Usando datos de ejemplo.";
pintar();
