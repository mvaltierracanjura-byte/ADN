import * as G from "../kit/geo.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const marcados = new Set(["perfil", "horario"]);
$("#puntos").innerHTML = G.PUNTOS.map((p) => `<label class="casilla" style="color:var(--ink)" for="p-${p.id}"><input type="checkbox" id="p-${p.id}" data-id="${p.id}" ${marcados.has(p.id) ? "checked" : ""}><span>${esc(p.texto)}</span></label>`).join("");
function revisar() {
  const a = G.auditoria([...marcados]);
  $("#puntaje").innerHTML = `<div><b>${a.puntaje}</b><span>de 100</span></div><div><b style="font-size:1.1rem">${esc(a.nivel)}</b><span>cómo te ven</span></div><div><b>${a.pendientes.length}</b><span>pendientes</span></div>`;
  $("#pendientes").innerHTML = a.pendientes.length ? `<div class="paso"><b>Empieza por aquí</b><ol style="margin:0;padding-left:20px;display:grid;gap:6px">${a.pendientes.slice(0, 5).map((p) => `<li><b>${esc(p.texto)}.</b> <span class="sub">${esc(p.como)}</span></li>`).join("")}</ol></div>` : "";
}
$("#puntos").addEventListener("change", (e) => { const id = e.target.dataset.id; if (!id) return; e.target.checked ? marcados.add(id) : marcados.delete(id); revisar(); });
$("#tipo").innerHTML = Object.entries(G.TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
$("#tipo").value = "CafeOrCoffeeShop";
function codigo() {
  const v = (id) => $("#" + id).value.trim();
  const horario = {}; for (let d = 1; d <= 6; d++) horario[d] = [[v("abre"), v("cierra")]];
  $("#codigo").value = G.etiquetaScript(G.jsonLd({ tipo: v("tipo"), nombre: v("nombre"), telefono: v("tel"), cp: v("cp"), calle: v("calle"), colonia: v("colonia"), url: v("url"), horario }));
}
["nombre", "tipo", "tel", "cp", "calle", "colonia", "url", "abre", "cierra"].forEach((id) => $("#" + id).addEventListener("input", codigo));
$("#copiar").addEventListener("click", (e) => navigator.clipboard.writeText($("#codigo").value).then(() => { e.target.textContent = "Copiado"; }, () => { $("#codigo").select(); e.target.textContent = "Texto seleccionado"; }));
revisar(); codigo();
