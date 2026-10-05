// Calendario ICS (RFC 5545) para suscribirse desde Google Calendar, iPhone u Outlook.
//   calendarioIcs({ nombre, citas, offsetHoras = -7, ahora = new Date() }) → texto .ics
//   citas: [{ id, inicio "YYYY-MM-DD HH:MM[:SS]" (hora local), fin, estado, servicio, personal, cliente_nombre, cliente_tel }]
// Mazatlán es UTC−7 todo el año (sin horario de verano desde 2022): la hora local se pasa a UTC sumando 7 h.
const dos = (n) => String(n).padStart(2, "0");
const utc = (d) => `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}${dos(d.getUTCSeconds())}Z`;
export function localAUtc(texto, offsetHoras = -7) {
  const [f, h = "00:00"] = String(texto).replace("T", " ").split(" ");
  const [a, m, d] = f.split("-").map(Number), [hh, mm, ss = 0] = h.split(":").map(Number);
  return new Date(Date.UTC(a, m - 1, d, hh - offsetHoras, mm, ss));
}
export const escIcs = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Líneas de máximo 75 octetos; las siguientes empiezan con un espacio. No corta caracteres UTF-8.
export function doblar(linea) {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes = [];
  let actual = "", bytes = 0, limite = 75;
  for (const ch of linea) {
    const b = enc.encode(ch).length;
    if (bytes + b > limite) { partes.push(actual); actual = ""; bytes = 0; limite = 74; }
    actual += ch; bytes += b;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}
const TITULO = { pendiente: "", confirmada: "✓ ", asistio: "", no_asistio: "No llegó · ", cancelada: "Cancelada · " };
export function calendarioIcs({ nombre, citas, offsetHoras = -7, ahora = new Date(), dominio = "adn" }) {
  const l = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//ADN//Agenda//ES`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcs(nombre)}`, "X-PUBLISHED-TTL:PT15M", "REFRESH-INTERVAL;VALUE=DURATION:PT15M"];
  for (const c of citas) {
    const cliente = [c.cliente_nombre, c.cliente_tel ? `WhatsApp ${c.cliente_tel}` : ""].filter(Boolean).join(" · ");
    l.push("BEGIN:VEVENT", `UID:${escIcs(c.id)}@${dominio}`, `DTSTAMP:${utc(ahora)}`,
      `DTSTART:${utc(localAUtc(c.inicio, offsetHoras))}`, `DTEND:${utc(localAUtc(c.fin, offsetHoras))}`,
      `SUMMARY:${escIcs(`${TITULO[c.estado] ?? ""}${c.servicio} · ${String(c.cliente_nombre || "").split(" ")[0]}`)}`,
      `DESCRIPTION:${escIcs(`${c.servicio} con ${c.personal}\n${cliente}`)}`,
      `STATUS:${c.estado === "cancelada" ? "CANCELLED" : c.estado === "pendiente" ? "TENTATIVE" : "CONFIRMED"}`,
      "TRANSP:OPAQUE", "END:VEVENT");
  }
  l.push("END:VCALENDAR");
  return l.map(doblar).join("\r\n") + "\r\n";
}
