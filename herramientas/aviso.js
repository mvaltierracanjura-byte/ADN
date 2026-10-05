import * as V from "../kit/privacidad.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TODOS = [...V.DATOS_COMUNES.map((d) => [d, false]), ...V.SENSIBLES.map((d) => [d, true])];
const marcados = new Set(["nombre", "teléfono o WhatsApp", "historial de compras o citas", V.SENSIBLES[0]]);
$("#datos").innerHTML = TODOS.map(([d, s], i) => `<label class="casilla" style="color:var(--ink)" for="d-${i}"><input type="checkbox" id="d-${i}" data-dato="${esc(d)}" ${marcados.has(d) ? "checked" : ""}><span>${esc(d)}${s ? ' <span class="pill no_asistio">sensible</span>' : ""}</span></label>`).join("");
const lineas = (id) => $("#" + id).value.split("\n").map((x) => x.trim()).filter(Boolean);
function generar() {
  const elegidos = [...document.querySelectorAll("[data-dato]:checked")].map((c) => c.dataset.dato);
  const hoy = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mazatlan" }).format(new Date());
  $("#aviso").value = V.generarAviso({ responsable: $("#responsable").value, nombreComercial: $("#comercial").value, domicilio: $("#domicilio").value, correo: $("#correo").value, telefono: $("#telefono").value,
    datos: elegidos.filter((d) => !V.SENSIBLES.includes(d)), sensibles: elegidos.filter((d) => V.SENSIBLES.includes(d)), finalidades: lineas("finalidades"), secundarias: lineas("secundarias"), comparte: lineas("comparte"), fecha: hoy });
  $("#corto").textContent = V.avisoCorto({ responsable: $("#comercial").value || $("#responsable").value, finalidades: lineas("finalidades"), enlace: "tu página /privacidad" });
}
document.querySelectorAll("input, textarea").forEach((el) => el.id !== "aviso" && el.addEventListener("input", generar));
$("#datos").addEventListener("change", generar);
$("#copiar").addEventListener("click", (e) => navigator.clipboard.writeText($("#aviso").value).then(() => { e.target.textContent = "Copiado"; }, () => { $("#aviso").select(); e.target.textContent = "Texto seleccionado"; }));
generar();
