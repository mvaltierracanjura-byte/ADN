import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../kit/pronostico.js";
import { fechaMas, diaSemana } from "../kit/agenda.js";

const HASTA = "2026-10-04"; // domingo

test("respeta el patrón del día de la semana", () => {
  const ventas = [];
  for (let i = 0; i < 42; i++) { const f = fechaMas(HASTA, -i); ventas.push({ fecha: f, producto: "Pan", cantidad: diaSemana(f) === 6 ? 100 : 20 }); }
  const sab = P.pronosticar({ ventas, fecha: "2026-10-10" })[0];
  const lun = P.pronosticar({ ventas, fecha: "2026-10-05" })[0];
  assert.equal(sab.estimado, 100);
  assert.equal(lun.estimado, 20);
  assert.equal(sab.preparar, 110, "10% de colchón");
  assert.equal(sab.historial, 6);
});

test("las semanas recientes pesan más, y los días sin venta cuentan como cero", () => {
  const ventas = [{ fecha: fechaMas(HASTA, -41), producto: "X", cantidad: 1 }];
  for (let k = 1; k <= 6; k++) ventas.push({ fecha: fechaMas("2026-10-05", -7 * k), producto: "Pan", cantidad: k === 1 ? 60 : 30 });
  const r = P.pronosticar({ ventas, fecha: "2026-10-05" }).find((p) => p.producto === "Pan");
  assert.ok(r.estimado > 30 && r.estimado < 60, `ponderado: ${r.estimado}`);
});

test("ajustes por clima y tendencia acotada", () => {
  const ventas = [];
  for (let i = 0; i < 42; i++) { const f = fechaMas(HASTA, -i); ventas.push({ fecha: f, producto: "Frappé", cantidad: 20 }, { fecha: f, producto: "Latte", cantidad: 20 }); }
  const reglas = { calor: { "Frappé": 1.3 }, lluvia: 0.85 };
  const r = P.pronosticar({ ventas, fecha: "2026-10-05", ajustes: { calor: true, lluvia: true }, reglas });
  assert.equal(r.find((p) => p.producto === "Frappé").estimado, 22.1); // 20 × 1.3 × 0.85
  assert.equal(r.find((p) => p.producto === "Latte").estimado, 17);
  const sube = ventas.map((v) => ({ ...v, cantidad: v.fecha > fechaMas(HASTA, -14) ? 100 : 20 }));
  assert.equal(P.pronosticar({ ventas: sube, fecha: "2026-10-05" })[0].tendencia, 1.25, "la tendencia no se dispara");
});

test("con datos de ejemplo, le gana a 'lo mismo que la semana pasada'", () => {
  const ventas = P.ventasEjemplo(HASTA);
  const ev = P.evaluar({ ventas, dias: 14 });
  assert.ok(ev.error < ev.errorIngenuo, `error ${ev.error} vs ingenuo ${ev.errorIngenuo}`);
  assert.ok(ev.mejora > 0);
});

test("leer CSV", () => {
  const v = P.leerVentas("Fecha,Producto,Cantidad\n2026-10-01,Latte,30\n2026-10-01,Frappé,20\ntotal,,50");
  assert.deepEqual(v, [{ fecha: "2026-10-01", producto: "Latte", cantidad: 30 }, { fecha: "2026-10-01", producto: "Frappé", cantidad: 20 }]);
  assert.throws(() => P.leerVentas("a,b\n1,2"), /fecha, producto y cantidad/);
});
