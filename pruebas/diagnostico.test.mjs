import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticar, resumenWhatsApp } from "../kit/diagnostico.js";

test("consultorio con muchas inasistencias: la agenda va primero", () => {
  const d = diagnosticar({ giro: "consultorios", mensajesDia: 5, respondeEn: "minutos", citas: "si", citasSemana: 80, inasistencia: 0.25, ticket: 700, llamadasPerdidasDia: 0, google: "si", cobro: "transferencia", factura: false });
  assert.equal(d.primero.id, "agenda");
  assert.ok(d.perdidaMensual > 0);
  assert.match(d.primero.porque, /25% de citas/);
});

test("cafetería que contesta tarde y cobra con terminal: el asistente va primero", () => {
  const d = diagnosticar({ giro: "restaurantes", mensajesDia: 40, respondeEn: "horas", citas: "no", ticket: 150, llamadasPerdidasDia: 2, google: "si_sin_resenas", cobro: "tarjeta", factura: true });
  assert.equal(d.primero.id, "asistente");
  const ids = d.recomendaciones.map((r) => r.id);
  for (const id of ["telefono", "google", "cobro", "factura", "reactivar"]) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes("agenda"));
});

test("sin Google: lo recomienda", () => {
  const d = diagnosticar({ mensajesDia: 0, respondeEn: "minutos", citas: "no", ticket: 300, google: "no", cobro: "transferencia" });
  assert.equal(d.primero.id, "google");
});

test("resumen para WhatsApp", () => {
  const r = { giro: "restaurantes", giroNombre: "Cafeterías y restaurantes", mensajesDia: 40, respondeEn: "horas", ticket: 150, google: "si", cobro: "transferencia" };
  assert.match(resumenWhatsApp(r, diagnosticar(r), "Café X"), /^Hola, ADN\. Hice el diagnóstico para Café X \(Cafeterías y restaurantes\)\. Me salen unos \$[\d,]+ al mes/);
});
