import * as R from "../kit/resenas.js";
import { detectarIdioma } from "../kit/idioma.js";
import { limpiarTel } from "../kit/agenda.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MOMENTOS = { restaurante: "Restaurante o cafetería", cita: "Consultorio, salón o estudio", hospedaje: "Hotel o renta", servicio: "Taller o servicio" };
$("#giro").innerHTML = Object.entries(MOMENTOS).map(([k, v]) => `<option value="${k}">${esc(v)} · ${esc(R.MOMENTO[k].texto)}</option>`).join("");

let resenas = [
  { nombre: "Mariana Cota", estrellas: 5, texto: "El matcha está buenísimo y la atención súper amable.", respondida: true },
  { nombre: "Mike Johnson", estrellas: 4, texto: "Great coffee and friendly staff, a bit slow on Sunday.", respondida: false },
  { nombre: "Raúl Lizárraga", estrellas: 2, texto: "Mi pedido llegó frío y tardó más de una hora.", respondida: false },
  { nombre: "Ana Gómez", estrellas: 5, texto: "Las galletas rellenas son lo mejor de Mazatlán.", respondida: false },
  { nombre: "Pedro Tirado", estrellas: 3, texto: "Bien, pero el lugar estaba muy lleno.", respondida: true },
];

function pintarInvitacion() {
  const pid = $("#placeid").value.trim();
  const enlace = R.placeIdValido(pid) ? R.enlaceResena(pid) : "https://g.page/r/tu-negocio/review";
  const texto = R.invitacion({ nombre: $("#cliente").value, negocio: $("#negocio").value || "tu negocio", enlace });
  $("#invitacion").textContent = texto;
  const tel = limpiarTel($("#tel").value);
  $("#inv-acciones").innerHTML = tel
    ? `<a class="wa" target="_blank" rel="noopener" href="https://wa.me/52${tel}?text=${encodeURIComponent(texto)}">Mandar por WhatsApp</a>`
    : `<span class="sub">Escribe el WhatsApp del cliente para mandarla. En el sistema sale sola ${esc(R.MOMENTO[$("#giro").value].texto)}.</span>`;
}
function pintarResenas() {
  const m = R.metricas(resenas);
  $("#metricas").innerHTML = `<div><b>${m.promedio ?? "—"}</b><span>promedio de estrellas</span></div><div><b>${Math.round(m.respondidas * 100)}%</b><span>respondidas</span></div><div><b>${m.sinResponderNegativas}</b><span>negativas sin responder</span></div>`;
  const ul = $("#resenas");
  ul.innerHTML = "";
  resenas.forEach((r, i) => {
    const idioma = detectarIdioma(r.texto);
    const li = document.createElement("li");
    li.innerHTML = `<span class="hora" aria-label="${r.estrellas} estrellas">${"★".repeat(r.estrellas)}<span style="color:var(--line)">${"★".repeat(5 - r.estrellas)}</span></span><div>
      <div class="quien"><b>${esc(r.nombre)}</b>${r.respondida ? '<span class="pill confirmada">Respondida</span>' : `<span class="pill ${r.estrellas <= 3 ? "no_asistio" : "pendiente"}">Sin responder</span>`}</div>
      <div class="det">“${esc(r.texto)}”</div></div>`;
    if (!r.respondida) {
      const cont = li.querySelector("div");
      const ta = document.createElement("textarea");
      ta.id = "resp-" + i; ta.setAttribute("aria-label", "Respuesta a " + r.nombre);
      ta.value = R.borrador({ estrellas: r.estrellas, nombre: r.nombre, negocio: $("#negocio").value || "nosotros", contacto: $("#contacto").value, idioma });
      ta.style.marginTop = "8px";
      const acc = document.createElement("div"); acc.className = "acciones-mini";
      const b = document.createElement("button"); b.type = "button"; b.textContent = "Marcar como respondida";
      b.addEventListener("click", () => {
        navigator.clipboard?.writeText(ta.value).catch(() => {}); // no esperar: algunos navegadores piden permiso
        resenas[i].respondida = true; pintarResenas();
      });
      acc.appendChild(b); cont.append(ta, acc);
    }
    ul.appendChild(li);
  });
}
["negocio", "placeid", "cliente", "tel"].forEach((id) => $("#" + id).addEventListener("input", pintarInvitacion));
$("#giro").addEventListener("change", pintarInvitacion);
["negocio", "contacto"].forEach((id) => $("#" + id).addEventListener("change", pintarResenas));
pintarInvitacion(); pintarResenas();
