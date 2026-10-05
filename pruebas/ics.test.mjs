import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarioIcs, localAUtc, doblar, escIcs } from "../kit/ics.js";

const cita = { id: "c1", inicio: "2026-10-06 16:30:00", fin: "2026-10-06 17:15:00", estado: "pendiente", servicio: "Limpieza",
  personal: "Dra. Ana", cliente_nombre: "María López", cliente_tel: "6691234567" };

test("hora de Mazatlán a UTC (+7 h, también cruzando el día)", () => {
  assert.equal(localAUtc("2026-10-06 16:30").toISOString(), "2026-10-06T23:30:00.000Z");
  assert.equal(localAUtc("2026-10-06T19:00:00").toISOString(), "2026-10-07T02:00:00.000Z");
});

test("arma un VCALENDAR válido con CRLF y un evento por cita", () => {
  const ics = calendarioIcs({ nombre: "Consultorio Sonrisa", citas: [cita, { ...cita, id: "c2", estado: "cancelada" }], ahora: new Date("2026-10-05T12:00:00Z") });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(ics.split("BEGIN:VEVENT").length - 1, 2);
  assert.match(ics, /DTSTART:20261006T233000Z\r\nDTEND:20261007T001500Z/);
  assert.match(ics, /SUMMARY:Limpieza · María/);
  assert.match(ics, /STATUS:TENTATIVE/);
  assert.match(ics, /SUMMARY:Cancelada · Limpieza[^\r]*\r\n[^\r]*\r\nSTATUS:CANCELLED|STATUS:CANCELLED/);
  assert.match(ics, /UID:c1@adn/);
  assert.ok(!/[^\r]\n/.test(ics), "todos los saltos son CRLF");
});

test("escapa comas, punto y coma y saltos de línea", () => {
  assert.equal(escIcs("a,b;c\nd\\e"), "a\\,b\;c\\nd\\\\e");
});

test("dobla líneas largas a 75 octetos sin partir acentos", () => {
  const larga = "DESCRIPTION:" + "ñ".repeat(80);
  const doblada = doblar(larga);
  const enc = new TextEncoder();
  for (const l of doblada.split("\r\n")) assert.ok(enc.encode(l).length <= 75);
  assert.equal(doblada.split("\r\n").map((l, i) => (i ? l.slice(1) : l)).join(""), larga);
});
