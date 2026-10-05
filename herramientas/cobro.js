import * as C from "../kit/cobro.js";
import { limpiarTel } from "../kit/agenda.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const leer = () => { try { return JSON.parse(localStorage.getItem("adn-demo-cobros")) || null; } catch (e) { return null; } };
const guardar = () => { try { localStorage.setItem("adn-demo-cobros", JSON.stringify(cobros)); } catch (e) {} };
let cobros = leer() || [
  { id: 480, monto: 600, conc: "CITA LIMPIEZA", ref: C.referencia(480), estado: "pendiente" },
  { id: 481, monto: 90, conc: "PEDIDO LM481", ref: C.referencia(481), estado: "pendiente" },
];

function estadoClabe() {
  const v = C.validarClabe($("#clabe").value);
  $("#clabe-estado").textContent = v.ok ? `✓ CLABE válida · ${v.banco}` : v.error;
  $("#clabe-estado").style.color = v.ok ? "var(--ok)" : "var(--a)";
  return v;
}
$("#clabe").addEventListener("input", estadoClabe);

$("#crear").addEventListener("click", () => {
  const err = $("#error"); err.hidden = true;
  const v = estadoClabe(), monto = +$("#monto").value;
  if (!v.ok) { err.textContent = v.error; err.hidden = false; return; }
  if (!(monto > 0)) { err.textContent = "Escribe un monto mayor a cero."; err.hidden = false; return; }
  const id = Math.max(479, ...cobros.map((c) => c.id)) + 1;
  const cobro = { id, monto, conc: C.concepto($("#conc").value).toUpperCase() || "PAGO", ref: C.referencia(id), estado: "pendiente" };
  cobros.push(cobro); guardar();
  const datos = { n: $("#negocio").value, b: $("#beneficiario").value, c: v.clabe, m: monto, k: cobro.conc, r: cobro.ref, d: $("#dimo").value };
  const enlace = new URL("pagar.html#" + btoa(unescape(encodeURIComponent(JSON.stringify(datos)))).replace(/=+$/, ""), location.href).href;
  const msj = C.mensajeCobro({ negocio: datos.n, beneficiario: datos.b, clabe: v.clabe, monto, conc: cobro.conc, ref: cobro.ref, enlace, dimo: datos.d });
  const tel = limpiarTel($("#cliente-tel").value);
  $("#creado").innerHTML = `<div class="ok-msj"><b>Cobro ${cobro.id} creado · referencia ${cobro.ref}</b><div class="mensaje-wa">${esc(msj)}</div>
    <div class="acciones-mini"><a href="${esc(enlace)}" target="_blank" rel="noopener">Ver lo que ve tu cliente</a>${tel ? `<a class="wa" target="_blank" rel="noopener" href="https://wa.me/52${tel}?text=${encodeURIComponent(msj)}">Mandar por WhatsApp</a>` : ""}</div></div>`;
  pintarCobros();
  ejemploCsv();
});

function pintarCobros() {
  $("#cobros").innerHTML = cobros.map((c) => `<tr><td>${c.id} · ${esc(c.ref)}</td><td>${esc(c.conc)}</td><td class="num">${pesos(c.monto)}</td>
    <td><span class="pill ${c.estado === "pagado" ? "confirmada" : "pendiente"}">${c.estado === "pagado" ? "Pagado" : "Pendiente"}</span></td></tr>`).join("");
}
function ejemploCsv() {
  const p = cobros.filter((c) => c.estado === "pendiente");
  const lineas = ["Fecha,Descripción,Referencia,Abono"];
  if (p[0]) lineas.push(`05/10/2026,SPEI RECIBIDO ${p[0].conc},${p[0].ref},${p[0].monto.toFixed(2)}`);
  if (p[1]) lineas.push(`05/10/2026,SPEI REF ${p[1].ref} ${p[1].conc},,${p[1].monto.toFixed(2)}`);
  lineas.push("05/10/2026,DEPOSITO EN EFECTIVO,,250.00");
  $("#csv").value = lineas.join("\n");
}
$("#conciliar").addEventListener("click", () => {
  const r = C.conciliar(C.leerMovimientos($("#csv").value), cobros.filter((c) => c.estado === "pendiente"));
  for (const p of r.pagados) cobros.find((c) => c.id === p.cobro).estado = "pagado";
  guardar(); pintarCobros();
  $("#sin-cobro").innerHTML = `<p class="sub">${r.pagados.length} cobro(s) marcados como pagados.${r.sinCobro.length ? ` ${r.sinCobro.length} movimiento(s) no corresponden a ningún cobro: ${r.sinCobro.map((m) => esc(m.concepto || m.referencia) + " " + pesos(m.monto)).join(", ")}.` : ""}</p>`;
});
estadoClabe(); pintarCobros(); ejemploCsv();
