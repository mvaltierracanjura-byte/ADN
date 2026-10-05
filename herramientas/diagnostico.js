import { diagnosticar, resumenWhatsApp } from "../kit/diagnostico.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const BASES = { A: "var(--a)", T: "var(--t)", C: "var(--c)", G: "var(--g)" };
const ENLACE = { asistente: "../#demo", agenda: "agenda.html", telefono: "../#ofrecemos", google: "google.html", cobro: "cobro.html", factura: "factura.html", reactivar: "bandeja.html" };
$("#giro").innerHTML = window.ADN.giros.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join("") + `<option value="otro">Otro</option>`;
function calcular() {
  const v = (id) => $("#" + id).value;
  $("#bloque-citas").hidden = v("citas") !== "si";
  const r = { giro: v("giro"), giroNombre: $("#giro").selectedOptions[0]?.text, mensajesDia: +v("mensajes"), respondeEn: v("responde"), ticket: +v("ticket"),
    llamadasPerdidasDia: +v("llamadas"), citas: v("citas"), citasSemana: +v("citas-semana"), inasistencia: +v("inasist") / 100, google: v("google"),
    cobro: v("cobro"), factura: $("#factura").checked };
  const d = diagnosticar(r);
  const wa = `https://wa.me/${window.ADN.contacto.whatsapp}?text=${encodeURIComponent(resumenWhatsApp(r, d, v("negocio").trim()))}`;
  $("#resultado").innerHTML = `<div class="kpis"><div style="grid-column:span 2"><b>${pesos(d.perdidaMensual)}</b><span>al mes en oportunidades que hoy se pierden (estimación conservadora)</span></div><div><b>${d.recomendaciones.length}</b><span>mejoras posibles</span></div></div>
    <div class="ok-msj"><b>Empieza por: ${esc(d.primero.titulo)}</b><span>${esc(d.primero.porque)}</span></div>
    <ol class="lista-hace" style="list-style:none;padding:0">${d.recomendaciones.map((x) => `<li><span class="chip" style="--col:${BASES[x.base]}">${x.base}</span><span><b>${esc(x.titulo)}</b>${x.impacto ? ` · ≈ ${pesos(x.impacto)}/mes` : x.ahorroHoras ? ` · ≈ ${x.ahorroHoras} h/mes` : ""}<br><span class="sub">${esc(x.porque)}</span> <a href="${ENLACE[x.id]}">Ver herramienta</a></span></li>`).join("")}</ol>
    <div class="acciones" style="margin-top:4px"><a class="boton wa" target="_blank" rel="noopener" href="${wa}">Mandar mi diagnóstico por WhatsApp</a></div>
    <p class="sub">Supuestos: 3 de cada 10 personas que escriben iban a comprar; los recordatorios reducen 30% las inasistencias; la terminal cobra alrededor de 3% más IVA. Ajustamos los números contigo en la plática.</p>`;
}
$("#preguntas").addEventListener("input", calcular);
$("#preguntas").addEventListener("change", calcular);
calcular();
