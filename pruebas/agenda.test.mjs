import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "../kit/agenda.js";

const negocio = {
  nombre: "Consultorio Sonrisa", intervalo: 30, anticipacionMin: 60, diasAdelante: 14,
  horario: { 1: [["09:00", "14:00"], ["16:00", "18:00"]], 2: [["09:00", "14:00"]], 6: [["09:00", "11:00"]] },
};
const servicios = [
  { id: "limpieza", nombre: "Limpieza", minutos: 45, personal: ["ana", "luis"] },
  { id: "blanqueamiento", nombre: "Blanqueamiento", minutos: 90, personal: ["ana"] },
];
const personal = [{ id: "ana", nombre: "Dra. Ana" }, { id: "luis", nombre: "Dr. Luis", horario: { 1: [["16:00", "18:00"]] } }];
const LUNES = "2026-10-05";
const cliente = { nombre: "María López", tel: "669 123 4567" };

test("fechas: día de la semana, sumar días, fecha larga y hora de 12 horas", () => {
  assert.equal(A.diaSemana(LUNES), 1);
  assert.equal(A.fechaMas("2026-12-31", 1), "2027-01-01");
  assert.equal(A.fechaLarga(LUNES), "lunes 5 de octubre");
  assert.equal(A.horaBonita("16:30"), "4:30 p. m.");
  assert.equal(A.horaBonita("00:15"), "12:15 a. m.");
  assert.equal(A.horaBonita("12:00"), "12:00 p. m.");
});

test("ahoraLocal: Mazatlán es UTC−7", () => {
  assert.deepEqual(A.ahoraLocal(new Date("2026-10-05T06:30:00Z")), { fecha: "2026-10-04", hora: "23:30" });
  assert.deepEqual(A.ahoraLocal(new Date("2026-10-05T16:00:00Z")), { fecha: "2026-10-05", hora: "09:00" });
});

test("horarios libres respetan turnos, duración y horario propio de cada persona", () => {
  const libres = A.horariosLibres({ negocio, servicios, personal, servicioId: "limpieza", fecha: LUNES });
  // Ana: 9:00..13:00 (45 min antes del cierre de las 14:00) cada 30, y 16:00..17:00. Luis solo en la tarde.
  assert.deepEqual(libres.map((l) => l.hora), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "16:00", "16:30", "17:00"]);
  assert.deepEqual(libres.find((l) => l.hora === "16:00").personal, ["ana", "luis"]);
  assert.deepEqual(libres.find((l) => l.hora === "09:00").personal, ["ana"]);
  assert.deepEqual(A.horariosLibres({ negocio, servicios, personal, servicioId: "limpieza", fecha: "2026-10-04" }), [], "domingo cerrado");
});

test("una cita ocupa a esa persona; la otra sigue libre", () => {
  const citas = [{ id: "c1", servicio: "limpieza", personal: "ana", fecha: LUNES, hora: "16:00", minutos: 45, estado: "pendiente" }];
  const libres = A.horariosLibres({ negocio, servicios, personal, citas, servicioId: "limpieza", fecha: LUNES });
  assert.deepEqual(libres.find((l) => l.hora === "16:00").personal, ["luis"]);
  assert.deepEqual(libres.find((l) => l.hora === "16:30").personal, ["luis"], "16:30 cruza con la de 16:00–16:45");
  const canceladas = [{ ...citas[0], estado: "cancelada" }];
  assert.deepEqual(A.horariosLibres({ negocio, servicios, personal, citas: canceladas, servicioId: "limpieza", fecha: LUNES }).find((l) => l.hora === "16:00").personal, ["ana", "luis"]);
});

test("bloqueos de una persona o de todo el negocio", () => {
  const bloqueos = [{ personal: null, fecha: LUNES, desde: "12:00", hasta: "14:00" }, { personal: "ana", fecha: LUNES, desde: "09:00", hasta: "10:00" }];
  const horas = A.horariosLibres({ negocio, servicios, personal, bloqueos, servicioId: "limpieza", fecha: LUNES }).map((l) => l.hora);
  assert.ok(!horas.includes("09:00") && !horas.includes("09:30") && horas.includes("10:00"));
  assert.ok(!horas.includes("11:30") && !horas.includes("12:00"), "11:30 + 45 min invade la comida");
});

test("anticipación mínima y días hacia adelante", () => {
  const ahora = { fecha: LUNES, hora: "10:10" };
  const horas = A.horariosLibres({ negocio, servicios, personal, servicioId: "limpieza", fecha: LUNES, ahora }).map((l) => l.hora);
  assert.equal(horas[0], "11:30", "10:10 + 60 min → 11:10 → primer turno 11:30");
  assert.deepEqual(A.horariosLibres({ negocio, servicios, personal, servicioId: "limpieza", fecha: "2026-10-04", ahora }), []);
  assert.deepEqual(A.horariosLibres({ negocio, servicios, personal, servicioId: "limpieza", fecha: "2026-10-26", ahora }), [], "más de 14 días");
});

test("reservar: valida datos, evita citas dobles y asigna persona", () => {
  assert.match(A.reservar({ negocio, servicios, personal, servicioId: "limpieza", fecha: LUNES, hora: "09:00", cliente: { nombre: "", tel: "6691234567" } }).error, /nombre/);
  assert.match(A.reservar({ negocio, servicios, personal, servicioId: "limpieza", fecha: LUNES, hora: "09:00", cliente: { nombre: "X", tel: "123" } }).error, /WhatsApp/);
  const { cita } = A.reservar({ negocio, servicios, personal, servicioId: "blanqueamiento", fecha: LUNES, hora: "09:00", cliente });
  assert.equal(cita.personal, "ana");
  assert.equal(cita.cliente.tel, "6691234567");
  assert.equal(cita.estado, "pendiente");
  assert.equal(cita.token.length, 16);
  const doble = A.reservar({ negocio, servicios, personal, citas: [cita], servicioId: "limpieza", fecha: LUNES, hora: "10:00", cliente });
  assert.match(doble.error, /ya no está disponible/, "Ana está ocupada de 9:00 a 10:30 y Luis no trabaja en la mañana");
});

test("reprogramar mueve la cita y la vuelve a dejar pendiente", () => {
  const { cita } = A.reservar({ negocio, servicios, personal, servicioId: "limpieza", fecha: LUNES, hora: "09:00", personalId: "ana", cliente });
  const confirmada = { ...cita, estado: "confirmada", recordada: true };
  const r = A.reprogramar({ cita: confirmada, negocio, servicios, personal, citas: [confirmada], fecha: LUNES, hora: "09:30" });
  assert.equal(r.cita.hora, "09:30", "puede encimarse con su propio horario anterior");
  assert.equal(r.cita.estado, "pendiente");
  assert.equal(r.cita.recordada, false);
  assert.match(A.reprogramar({ cita: { ...cita, estado: "cancelada" }, negocio, servicios, personal, citas: [], fecha: LUNES, hora: "10:00" }).error, /ya no se puede/);
});

test("teléfonos: 10 dígitos, con o sin 52 / 521", () => {
  assert.equal(A.limpiarTel("+52 1 669 123 4567"), "6691234567");
  assert.equal(A.limpiarTel("52 669 123 4567"), "6691234567");
  assert.equal(A.limpiarTel("669-123-45"), "");
});

test("por recordar: pendientes, no recordadas, dentro de las próximas horas", () => {
  const base = { servicio: "limpieza", personal: "ana", minutos: 45, cliente };
  const citas = [
    { ...base, id: "a", fecha: "2026-10-06", hora: "09:00", estado: "pendiente" },
    { ...base, id: "b", fecha: "2026-10-06", hora: "11:00", estado: "pendiente" },
    { ...base, id: "c", fecha: "2026-10-06", hora: "09:00", estado: "confirmada" },
    { ...base, id: "d", fecha: "2026-10-06", hora: "09:00", estado: "pendiente", recordada: true },
    { ...base, id: "e", fecha: "2026-10-05", hora: "09:00", estado: "pendiente" },
  ];
  assert.deepEqual(A.porRecordar(citas, { fecha: LUNES, hora: "10:00" }, 24).map((c) => c.id), ["a"]);
});

test("mensajes de confirmación y recordatorio", () => {
  const cita = { cliente: { nombre: "María López" }, fecha: "2026-10-06", hora: "16:30" };
  const m = A.mensajeRecordatorio({ cita, negocio, servicio: servicios[0], persona: personal[0], enlace: "https://x/c#abc" });
  assert.match(m, /^Hola, María\./);
  assert.match(m, /Limpieza con Dra\. Ana, el martes 6 de octubre a las 4:30 p\. m\./);
  assert.match(m, /https:\/\/x\/c#abc/);
  assert.match(A.mensajeConfirmacion({ cita, negocio, servicio: servicios[0], enlace: "E" }), /quedó apartada/);
});

test("resumen: inasistencia solo de citas cerradas", () => {
  const r = A.resumen([{ estado: "asistio" }, { estado: "no_asistio" }, { estado: "asistio" }, { estado: "asistio" }, { estado: "pendiente" }, { estado: "cancelada" }]);
  assert.equal(r.inasistencia, 0.25);
  assert.equal(r.total, 5);
  assert.equal(r.canceladas, 1);
  assert.equal(A.resumen([]).inasistencia, null);
});
