import * as F from "../kit/cfdi.js";
import { ahoraLocal, fechaMas } from "../kit/agenda.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const hoy = ahoraLocal().fecha;
const TICKETS = {
  LM482: { total: 175, fecha: hoy, forma: "03", items: [{ descripcion: "Latte", cantidad: 2, precio: 65 }, { descripcion: "Galleta rellena", cantidad: 1, precio: 45 }] },
  LM483: { total: 600, fecha: fechaMas(hoy, -2), forma: "04", items: [{ descripcion: "Limpieza dental", cantidad: 1, precio: 600, unidad: "E48", unidadNombre: "Servicio" }] },
};

function opciones(sel, filas, actual) {
  sel.innerHTML = filas.map(([c, d]) => `<option value="${c}">${c} · ${esc(d)}</option>`).join("");
  if (filas.some((f) => f[0] === actual)) sel.value = actual;
}
function alCambiarRFC() {
  const v = F.validarRFC($("#rfc").value);
  const tipo = v.ok ? (v.tipo === "moral" ? "moral" : "fisica") : "fisica";
  $("#rfc-estado").textContent = !$("#rfc").value ? "" : v.ok ? `✓ ${v.tipo === "moral" ? "Empresa (persona moral)" : v.tipo === "generico" ? "Público en general" : v.tipo === "extranjero" ? "Extranjero" : "Persona física"}` : v.error;
  $("#rfc-estado").style.color = v.ok ? "var(--ok)" : "var(--a)";
  if (v.ok && v.tipo === "generico") { opciones($("#regimen"), F.REGIMENES.filter((r) => r[0] === "616"), "616"); opciones($("#uso"), F.USOS.filter((u) => u[0] === "S01"), "S01"); return; }
  opciones($("#regimen"), F.regimenesPara(tipo), $("#regimen").value || (tipo === "moral" ? "601" : "626"));
  opciones($("#uso"), F.usosPara(tipo), $("#uso").value || "G03");
}
function ticket() {
  const t = TICKETS[$("#folio").value.trim().toUpperCase()];
  const total = parseFloat($("#total").value);
  if (!t) return { error: "No encontramos ese folio. Revisa tu ticket." };
  if (Math.abs(t.total - total) > 0.01) return { error: "El total no coincide con el ticket." };
  if (!F.enPlazo(t.fecha, hoy)) return { error: "Este ticket ya no se puede facturar: el plazo es dentro del mes de la compra." };
  return { t };
}
$("#rfc").addEventListener("input", alCambiarRFC);
["folio", "total"].forEach((id) => $("#" + id).addEventListener("input", () => { const r = ticket(); $("#ticket-estado").textContent = r.error || `✓ Ticket del ${r.t.fecha} por ${pesos(r.t.total)}`; $("#ticket-estado").style.color = r.error ? "var(--a)" : "var(--ok)"; }));
$("#facturar").addEventListener("click", () => {
  const tk = ticket();
  const v = F.validarReceptor({ rfc: $("#rfc").value, nombre: $("#nombre").value, cp: $("#cp").value, regimen: $("#regimen").value, uso: $("#uso").value });
  const errores = { ...(tk.error ? { ticket: tk.error } : {}), ...v.errores };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($("#correo").value)) errores.correo = "Escribe un correo válido para mandarte la factura.";
  if (Object.keys(errores).length) {
    $("#errores").innerHTML = `<ul class="error-msj" style="margin:0;padding-left:18px">${Object.values(errores).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    return;
  }
  $("#errores").innerHTML = "";
  const s = F.solicitudFacturama({ receptor: v.datos, items: tk.t.items, emisor: { cp: "82000" }, formaPago: tk.t.forma, folio: $("#folio").value.toUpperCase() });
  $("#vista").innerHTML = `<div class="ok-msj"><b>Datos correctos. En el sistema real aquí se timbra y la factura llega a ${esc($("#correo").value)}.</b></div>
    <p><b>${esc(v.datos.nombre)}</b> · ${esc(v.datos.rfc)} · CP ${esc(v.datos.cp)}<br>Régimen ${esc(v.datos.regimen)} · Uso ${esc(v.datos.uso)} · Pago: ${esc(F.FORMAS_PAGO[s.PaymentForm])}</p>
    <div class="tabla-envuelta"><table class="tabla"><thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Subtotal</th><th class="num">IVA</th><th class="num">Total</th></tr></thead><tbody>
    ${s.Items.map((i) => `<tr><td>${esc(i.Description)} <small class="sub">${esc(i.ProductCode)}</small></td><td class="num">${i.Quantity}</td><td class="num">${pesos(i.Subtotal)}</td><td class="num">${pesos(i.Taxes[0].Total)}</td><td class="num">${pesos(i.Total)}</td></tr>`).join("")}
    </tbody></table></div>`;
});
alCambiarRFC();
$("#folio").dispatchEvent(new Event("input"));
