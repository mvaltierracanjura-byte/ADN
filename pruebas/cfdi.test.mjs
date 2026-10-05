import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../kit/cfdi.js";
import { timbrar } from "../servidor/facturacion.js";

const conDigito = (s) => s + F.digitoRFC(s);

test("RFC: dígito verificador, tipo de persona y genéricos", () => {
  assert.equal(F.digitoRFC("EKU9003173C"), "9", "RFC de prueba publicado por el SAT: EKU9003173C9");
  assert.deepEqual(F.validarRFC("eku9003173c9"), { ok: true, rfc: "EKU9003173C9", tipo: "moral" });
  const fisica = conDigito("VAMM850315AB");
  assert.equal(F.validarRFC(fisica).tipo, "fisica");
  assert.match(F.validarRFC("EKU9003173C8").error, /homoclave/);
  assert.match(F.validarRFC("EKU9013173C9").error, /fecha/);
  assert.match(F.validarRFC("ABC").error, /12 caracteres/);
  assert.equal(F.validarRFC("XAXX010101000").tipo, "generico");
});

test("catálogos según tipo de persona", () => {
  assert.ok(F.regimenesPara("moral").some((r) => r[0] === "601"));
  assert.ok(!F.regimenesPara("fisica").some((r) => r[0] === "601"));
  assert.ok(F.regimenesPara("fisica").some((r) => r[0] === "626") && F.regimenesPara("moral").some((r) => r[0] === "626"));
  assert.ok(!F.usosPara("moral").some((u) => u[0] === "D01"), "deducciones personales solo para personas físicas");
});

test("nombre fiscal sin régimen societario", () => {
  assert.equal(F.nombreFiscal("Escuela Kemper Urgate, S.A. de C.V."), "ESCUELA KEMPER URGATE");
  assert.equal(F.nombreFiscal("Comercializadora del Puerto SA de CV"), "COMERCIALIZADORA DEL PUERTO");
  assert.equal(F.nombreFiscal("Marco  Valtierra"), "MARCO VALTIERRA");
});

test("validar receptor completo", () => {
  const ok = F.validarReceptor({ rfc: "EKU9003173C9", nombre: "Escuela Kemper Urgate SA de CV", cp: "26015", regimen: "601", uso: "G03" });
  assert.equal(ok.ok, true);
  assert.equal(ok.datos.nombre, "ESCUELA KEMPER URGATE");
  const mal = F.validarReceptor({ rfc: "EKU9003173C9", nombre: "", cp: "260", regimen: "612", uso: "D01" });
  assert.deepEqual(Object.keys(mal.errores).sort(), ["cp", "nombre", "regimen", "uso"]);
  const gen = F.validarReceptor({ rfc: "XAXX010101000", nombre: "Público en general", cp: "82000", regimen: "601", uso: "G03" });
  assert.match(gen.errores.regimen, /616/);
  assert.match(gen.errores.uso, /S01/);
});

test("plazo para facturar: mes de la compra + gracia", () => {
  assert.ok(F.enPlazo("2026-10-05", "2026-10-31"));
  assert.ok(F.enPlazo("2026-10-05", "2026-11-03"));
  assert.ok(!F.enPlazo("2026-10-05", "2026-11-04"));
  assert.ok(F.enPlazo("2026-12-20", "2027-01-02"));
});

test("solicitud Facturama: desglose de IVA desde precio con IVA", () => {
  const s = F.solicitudFacturama({ receptor: { rfc: "EKU9003173C9", nombre: "ESCUELA KEMPER URGATE", uso: "G03", regimen: "601", cp: "26015" },
    items: [{ descripcion: "Latte", cantidad: 2, precio: 65 }, { descripcion: "Galleta rellena", cantidad: 1, precio: 45 }], emisor: { cp: "82000" }, folio: 482 });
  assert.equal(s.ExpeditionPlace, "82000");
  assert.equal(s.Receiver.FiscalRegime, "601");
  assert.equal(s.Items[0].Total, 130);
  assert.equal(s.Items[0].Subtotal, 112.07);
  assert.equal(s.Items[0].Taxes[0].Total, 17.93);
  assert.equal(s.Items[0].UnitPrice, 56.04);
  assert.equal(s.Items.reduce((a, i) => a + i.Total, 0), 175);
  assert.equal(s.Folio, "482");
});

test("timbrar: autenticación básica, sandbox y errores legibles", async () => {
  let pet;
  const fetch = async (url, op) => { pet = { url, op }; return { ok: true, json: async () => ({ Id: "abc", Total: 175, Complement: { TaxStamp: { Uuid: "UUID-1" } } }) }; };
  const r = await timbrar({ fetch, usuario: "u", clave: "c", solicitud: { a: 1 } });
  assert.deepEqual(r, { id: "abc", uuid: "UUID-1", total: 175 });
  assert.equal(pet.url, "https://apisandbox.facturama.mx/3/cfdis");
  assert.equal(pet.op.headers.Authorization, "Basic " + Buffer.from("u:c").toString("base64"));
  const malo = async () => ({ ok: false, status: 400, json: async () => ({ ModelState: { "Receiver.Rfc": ["El RFC no está en la lista del SAT"] } }) });
  await assert.rejects(timbrar({ fetch: malo, usuario: "u", clave: "c", solicitud: {} }), /no está en la lista del SAT/);
});
