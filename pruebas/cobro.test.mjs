import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../kit/cobro.js";

test("CLABE: dígito verificador, banco y formato", () => {
  // CLABE de ejemplo armada con el algoritmo oficial (pesos 3-7-1).
  const base = "01218000123456789";
  const clabe = base + C.digitoClabe(base);
  assert.equal(C.validarClabe(clabe).ok, true);
  assert.equal(C.validarClabe(clabe).banco, "BBVA México");
  const mal = base + ((C.digitoClabe(base) + 1) % 10);
  assert.match(C.validarClabe(mal).error, /no es válida/);
  assert.match(C.validarClabe("123").error, /18 dígitos/);
  assert.equal(C.formatoClabe(clabe), "012 180 00123456789 " + clabe[17]);
  assert.equal(C.digitoClabe("03218000011835971"), 9, "ejemplo publicado por Banxico: 032180000118359719");
});

test("referencia con verificador y concepto SPEI", () => {
  const r = C.referencia(482);
  assert.match(r, /^\d{7}$/);
  assert.ok(C.referenciaValida(r));
  assert.ok(!C.referenciaValida(r.slice(0, 6) + ((+r[6] + 1) % 10)));
  assert.equal(C.concepto("Pedido #LM-482 · Café (2 lattes) ñ"), "Pedido LM482 Cafe 2 lattes n");
  assert.ok(C.concepto("x".repeat(80)).length <= 40);
});

test("mensaje de cobro", () => {
  const base = "07218000123456789", clabe = base + C.digitoClabe(base);
  const m = C.mensajeCobro({ negocio: "Café", beneficiario: "Marco V", clabe, monto: 175, conc: "LM482", ref: "0004826", enlace: "https://x", dimo: "669 216 6036" });
  assert.match(m, /pagar \$175\.00 a Café/);
  assert.match(m, /Banorte/);
  assert.match(m, /DiMo al celular: 669 216 6036/);
});

test("conciliar movimientos del banco con cobros", () => {
  const cobros = [{ id: "a", monto: 175, ref: "0004826", conc: "LM482" }, { id: "b", monto: 600, ref: C.referencia(483), conc: "CITA" }, { id: "c", monto: 90, ref: C.referencia(484), conc: "X" }];
  const csv = `Fecha,Descripción,Referencia,Abono\n05/10/2026,SPEI RECIBIDO LM482,0004826,175.00\n05/10/2026,SPEI REF ${cobros[1].ref} PAGO CITA,,"600.00"\n05/10/2026,DEPOSITO,1234567,50.00`;
  const movs = C.leerMovimientos(csv);
  assert.equal(movs.length, 3);
  const r = C.conciliar(movs, cobros);
  assert.deepEqual(r.pagados.map((p) => p.cobro), ["a", "b"]);
  assert.equal(r.sinCobro.length, 1);
  assert.deepEqual(r.pendientes.map((p) => p.id), ["c"]);
  assert.equal(C.conciliar([{ monto: 170, referencia: "0004826" }], cobros).pagados.length, 0, "el monto debe ser exacto");
});
