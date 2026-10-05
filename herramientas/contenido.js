import { calendario, HASHTAGS } from "../kit/contenido.js";
import { ahoraLocal, fechaLarga } from "../kit/agenda.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const [a, m] = ahoraLocal().fecha.split("-").map(Number);
$("#mes").value = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
function pintar() {
  const [anio, mes] = $("#mes").value.split("-").map(Number);
  const productos = $("#productos").value.split(",").map((x) => x.trim()).filter(Boolean);
  if (!anio || !productos.length) { $("#calendario").innerHTML = `<li><span></span><span class="vacio">Escribe al menos un producto.</span></li>`; return; }
  const posts = calendario({ anio, mes, productos, negocio: $("#negocio").value || "tu negocio", diasPublicar: $("#frecuencia").value.split(",").map(Number) });
  const tags = HASHTAGS().join(" ");
  $("#calendario").innerHTML = posts.map((p) => `<li><span class="hora">${+p.fecha.slice(8)}</span><div>
    <div class="quien"><b>${esc(fechaLarga(p.fecha).split(" ")[0])}</b><span class="pill ${p.especial ? "no_asistio" : "confirmada"}">${esc(p.tipo)}</span><span class="pill asistio">${esc(p.formato)}</span></div>
    <div class="det">${esc(p.idea)}</div><div class="det" style="font-size:.8rem">${esc(tags)}</div></div></li>`).join("");
}
["negocio", "productos", "mes", "frecuencia"].forEach((id) => $("#" + id).addEventListener("input", pintar));
pintar();
