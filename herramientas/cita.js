// Enlace de la cita para el cliente: ver, confirmar, cambiar o cancelar. El token va en el #.
import * as A from "../kit/agenda.js";
import { almacenAgenda } from "../kit/almacen-agenda.js";
import { SUPABASE } from "../kit/config.js";

const $ = (s) => document.querySelector(s);
const almacen = almacenAgenda(SUPABASE ? { supabase: SUPABASE } : { demo: "adn-demo-agenda" });
const token = decodeURIComponent(location.hash.slice(1));
const ESTADO = { pendiente: "Por confirmar", confirmada: "Confirmada", cancelada: "Cancelada", asistio: "Ya asististe", no_asistio: "No asististe" };
let negocio, cita;

const error = (m) => { $("#error").textContent = m; $("#error").hidden = !m; };

function pintar() {
  $("#negocio").textContent = negocio.nombre || "Tu cita";
  $("#titulo").textContent = `${cita.cliente}, tu cita: ${cita.servicio}`;
  $("#detalle").innerHTML = "";
  const p = document.createElement("p");
  p.innerHTML = `<b></b><br><span></span><br><span class="pill ${cita.estado}"></span>`;
  p.querySelector("b").textContent = `${A.fechaLarga(cita.fecha)[0].toUpperCase()}${A.fechaLarga(cita.fecha).slice(1)}, ${A.horaBonita(cita.hora)}`;
  p.querySelector("span").textContent = `Con ${cita.personal} · ${cita.minutos} minutos`;
  p.querySelector(".pill").textContent = ESTADO[cita.estado];
  $("#detalle").appendChild(p);
  const activa = ["pendiente", "confirmada"].includes(cita.estado);
  $("#acciones").hidden = !activa;
  $("#confirmar").hidden = cita.estado !== "pendiente";
}

async function cargar() {
  if (!token) { $("#titulo").textContent = "Falta el enlace de tu cita."; return; }
  negocio = await almacen.negocio();
  cita = await almacen.cita(token);
  if (!cita) { $("#titulo").textContent = "No encontramos esa cita."; return; }
  pintar();
}

$("#confirmar").addEventListener("click", async () => {
  try { await almacen.cambiar(token, "confirmada"); await cargar(); error(""); } catch (e) { error(e.message); }
});
$("#cancelar").addEventListener("click", () => { $("#seguro").hidden = false; });
$("#no-cancelar").addEventListener("click", () => { $("#seguro").hidden = true; });
$("#si-cancelar").addEventListener("click", async () => {
  try { await almacen.cambiar(token, "cancelada"); $("#seguro").hidden = true; $("#cambio").hidden = true; await cargar(); error(""); } catch (e) { error(e.message); }
});

let diaElegido = null;
$("#cambiar").addEventListener("click", () => { $("#cambio").hidden = false; pintarDias(); });
function pintarDias() {
  const hoy = A.ahoraLocal().fecha, cont = $("#dias");
  cont.innerHTML = "";
  for (let i = 0, n = 0; n < 7 && i < 21; i++) {
    const f = A.fechaMas(hoy, i);
    if (!negocio.horario[A.diaSemana(f)]) continue;
    n++;
    const [dia, num, , mes] = A.fechaLarga(f).split(" ");
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-pressed", f === diaElegido);
    b.innerHTML = `${dia}<small>${num} ${mes}</small>`;
    b.addEventListener("click", () => { diaElegido = f; pintarDias(); pintarHoras(); });
    cont.appendChild(b);
  }
}
async function pintarHoras() {
  const cont = $("#horas");
  const libres = (await almacen.libres(cita.servicioId, diaElegido)).filter((l) => !(diaElegido === cita.fecha && l.hora === cita.hora));
  cont.innerHTML = libres.length ? "" : `<p class="vacio">No hay horarios libres ese día.</p>`;
  for (const l of libres) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = l.hora;
    b.addEventListener("click", async () => {
      try { await almacen.reprogramar(token, diaElegido, l.hora); $("#cambio").hidden = true; await cargar(); error(""); } catch (e) { error(e.message); }
    });
    cont.appendChild(b);
  }
}

cargar().catch((e) => error("No pude cargar tu cita: " + e.message));
