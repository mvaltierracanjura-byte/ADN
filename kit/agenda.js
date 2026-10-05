// Agenda de citas con recordatorios. Lógica pura: la usan la página (navegador), el servidor (Deno) y las
// pruebas (Node). Fechas y horas en hora LOCAL del negocio, como texto "AAAA-MM-DD" y "HH:MM".
// Mazatlán está en UTC−7 todo el año (sin horario de verano desde 2022): ver ahoraLocal().
//
// negocio  { nombre, horario: { 0..6: [["09:00","14:00"], ...] }, intervalo, anticipacionMin, diasAdelante }
//          0 = domingo. Un día sin entrada = cerrado.
// servicios [{ id, nombre, minutos, precio?, personal: [ids] }]
// personal  [{ id, nombre, horario? }]   horario propio opcional; si no, usa el del negocio
// citas     [{ id, servicio, personal, fecha, hora, minutos, estado, cliente: { nombre, tel }, token, recordada? }]
// bloqueos  [{ personal: id | null, fecha, desde, hasta }]   null = todo el negocio (comida, día festivo)

export const ESTADOS = ["pendiente", "confirmada", "cancelada", "asistio", "no_asistio"];
const OCUPA = new Set(["pendiente", "confirmada", "asistio"]); // estados que apartan el horario

export const aMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function fechaMas(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}
export const diaSemana = (fecha) => { const [a, m, d] = fecha.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); };

// Fecha y hora local a partir de un instante. offsetHoras de Mazatlán: −7.
export function ahoraLocal(instante = new Date(), offsetHoras = -7) {
  const f = new Date(instante.getTime() + offsetHoras * 3600e3).toISOString();
  return { fecha: f.slice(0, 10), hora: f.slice(11, 16) };
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function fechaLarga(fecha) {
  const [, m, d] = fecha.split("-").map(Number);
  return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}
export function horaBonita(hhmm) {
  const min = aMin(hhmm), h = Math.floor(min / 60), m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

const cruza = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

function horarioDe(negocio, persona, fecha) {
  const h = (persona && persona.horario) || negocio.horario;
  return h[diaSemana(fecha)] || [];
}

// ¿Esta persona puede atender este servicio en esta fecha y hora? Devuelve null si sí, o el motivo.
export function motivoNoDisponible({ negocio, servicio, persona, citas = [], bloqueos = [], fecha, hora, ignorarCita = null }) {
  if (!servicio.personal.includes(persona.id)) return "Esa persona no da este servicio.";
  const ini = aMin(hora), fin = ini + servicio.minutos;
  const turnos = horarioDe(negocio, persona, fecha);
  if (!turnos.some(([d, h]) => ini >= aMin(d) && fin <= aMin(h))) return "Fuera del horario de atención.";
  for (const b of bloqueos) {
    if (b.fecha !== fecha || (b.personal && b.personal !== persona.id)) continue;
    if (cruza(ini, fin, aMin(b.desde), aMin(b.hasta))) return "Ese horario está bloqueado.";
  }
  for (const c of citas) {
    if (c.id === ignorarCita || c.personal !== persona.id || c.fecha !== fecha || !OCUPA.has(c.estado)) continue;
    const ci = aMin(c.hora);
    if (cruza(ini, fin, ci, ci + c.minutos)) return "Ese horario ya está ocupado.";
  }
  return null;
}

// Horarios libres para un servicio en una fecha: [{ hora, personal: [ids] }], en orden.
// `ahora` ({ fecha, hora }) quita lo que ya pasó o no cumple la anticipación mínima.
export function horariosLibres({ negocio, servicios, personal, citas = [], bloqueos = [], servicioId, fecha, personalId = null, ahora = null }) {
  const servicio = servicios.find((s) => s.id === servicioId);
  if (!servicio) return [];
  if (ahora) {
    if (fecha < ahora.fecha) return [];
    if (negocio.diasAdelante != null && fecha > fechaMas(ahora.fecha, negocio.diasAdelante)) return [];
  }
  const minimo = ahora && fecha === ahora.fecha ? aMin(ahora.hora) + (negocio.anticipacionMin || 0) : -1;
  const paso = negocio.intervalo || 15;
  const gente = personal.filter((p) => servicio.personal.includes(p.id) && (!personalId || p.id === personalId));
  const porHora = new Map();
  for (const p of gente) {
    for (const [d, h] of horarioDe(negocio, p, fecha)) {
      for (let t = aMin(d); t + servicio.minutos <= aMin(h); t += paso) {
        if (t < minimo) continue;
        const hora = aHora(t);
        if (!motivoNoDisponible({ negocio, servicio, persona: p, citas, bloqueos, fecha, hora })) {
          if (!porHora.has(hora)) porHora.set(hora, []);
          porHora.get(hora).push(p.id);
        }
      }
    }
  }
  return [...porHora.entries()].sort(([a], [b]) => aMin(a) - aMin(b)).map(([hora, ids]) => ({ hora, personal: ids }));
}

export function token(largo = 16) {
  const letras = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(largo);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => letras[b % letras.length]).join("");
}

// Crea la cita si el horario sigue libre. Si no se dice persona, toma la primera disponible.
// Devuelve { cita } o { error }.
export function reservar({ negocio, servicios, personal, citas = [], bloqueos = [], servicioId, fecha, hora, personalId = null, cliente, ahora = null }) {
  const servicio = servicios.find((s) => s.id === servicioId);
  if (!servicio) return { error: "Ese servicio no existe." };
  const nombre = (cliente?.nombre || "").trim(), tel = limpiarTel(cliente?.tel || "");
  if (!nombre) return { error: "Falta el nombre." };
  if (!tel) return { error: "Falta un WhatsApp de 10 dígitos." };
  const libres = horariosLibres({ negocio, servicios, personal, citas, bloqueos, servicioId, fecha, personalId, ahora });
  const hueco = libres.find((l) => l.hora === hora);
  if (!hueco) return { error: "Ese horario ya no está disponible. Elige otro." };
  const cita = {
    id: token(10), servicio: servicio.id, personal: personalId || hueco.personal[0], fecha, hora,
    minutos: servicio.minutos, estado: "pendiente", cliente: { nombre: nombre.slice(0, 80), tel }, token: token(), recordada: false,
  };
  return { cita };
}

// Cambiar de horario: mismo servicio, mismas reglas; la cita original no cuenta como ocupada.
export function reprogramar({ cita, negocio, servicios, personal, citas, bloqueos = [], fecha, hora, ahora = null }) {
  if (!["pendiente", "confirmada"].includes(cita.estado)) return { error: "Esta cita ya no se puede cambiar." };
  const otras = citas.filter((c) => c.id !== cita.id);
  const libres = horariosLibres({ negocio, servicios, personal, citas: otras, bloqueos, servicioId: cita.servicio, fecha, ahora });
  const hueco = libres.find((l) => l.hora === hora);
  if (!hueco) return { error: "Ese horario ya no está disponible. Elige otro." };
  const persona = hueco.personal.includes(cita.personal) ? cita.personal : hueco.personal[0];
  return { cita: { ...cita, fecha, hora, personal: persona, estado: "pendiente", recordada: false } };
}

export function limpiarTel(tel) {
  const d = String(tel).replace(/\D/g, "");
  const diez = d.length === 12 && d.startsWith("52") ? d.slice(2) : d.length === 13 && d.startsWith("521") ? d.slice(3) : d;
  return diez.length === 10 ? diez : "";
}

// Citas que toca recordar: pendientes, no recordadas, que empiezan entre ahora y `horas` horas.
export function porRecordar(citas, ahora, horas = 24) {
  const base = minutosAbsolutos(ahora.fecha, ahora.hora);
  return citas.filter((c) => {
    if (c.estado !== "pendiente" || c.recordada) return false;
    const falta = minutosAbsolutos(c.fecha, c.hora) - base;
    return falta > 0 && falta <= horas * 60;
  });
}
function minutosAbsolutos(fecha, hora) {
  const [a, m, d] = fecha.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 60000 + aMin(hora);
}

const conPunto = (t) => (t.endsWith(".") ? t : t + ".");

// Texto del recordatorio por WhatsApp, con el enlace para confirmar, cambiar o cancelar.
export function mensajeRecordatorio({ cita, negocio, servicio, persona, enlace }) {
  return `Hola, ${cita.cliente.nombre.split(" ")[0]}. Te recordamos tu cita en ${negocio.nombre}:\n` +
    `${servicio.nombre}${persona ? ` con ${persona.nombre}` : ""}, el ${fechaLarga(cita.fecha)} a las ${conPunto(horaBonita(cita.hora))}\n\n` +
    `Confirma, cambia o cancela aquí: ${enlace}\n` +
    `Si no puedes venir, avísanos para darle el lugar a alguien más. ¡Gracias!`;
}

export function mensajeConfirmacion({ cita, negocio, servicio, persona, enlace }) {
  return `¡Listo, ${cita.cliente.nombre.split(" ")[0]}! Tu cita en ${negocio.nombre} quedó apartada:\n` +
    `${servicio.nombre}${persona ? ` con ${persona.nombre}` : ""}, el ${fechaLarga(cita.fecha)} a las ${conPunto(horaBonita(cita.hora))}\n` +
    `Un día antes te mandamos un recordatorio. Para cambiarla: ${enlace}`;
}

// Inasistencias de citas que ya pasaron (asistió / no llegó).
export function resumen(citas) {
  const cerradas = citas.filter((c) => c.estado === "asistio" || c.estado === "no_asistio");
  const faltas = cerradas.filter((c) => c.estado === "no_asistio").length;
  return {
    total: citas.filter((c) => c.estado !== "cancelada").length,
    confirmadas: citas.filter((c) => c.estado === "confirmada").length,
    canceladas: citas.filter((c) => c.estado === "cancelada").length,
    inasistencia: cerradas.length ? faltas / cerradas.length : null,
  };
}
