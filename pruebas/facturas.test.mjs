import { test } from "node:test";
import assert from "node:assert/strict";
import { timbrarPendientes } from "../servidor/facturas.js";

const solicitud = (o = {}) => ({ id: 1, folio: "LM482", rfc: "EKU9003173C9", nombre: "ESCUELA KEMPER URGATE", cp: "42501", regimen: "601", uso: "G03",
  correo: "c@ejemplo.mx", forma_pago: "03", items: [{ descripcion: "Latte", cantidad: 2, precio: 65 }], intentos: 0, ...o });

function falso({ filas, facturama = "ok", correo = "ok" }) {
  const llamadas = [];
  const fetch = async (url, op = {}) => {
    llamadas.push({ url, op, body: op.body && op.body !== "{}" ? JSON.parse(op.body) : null });
    if (url.endsWith("/rpc/facturas_por_timbrar")) return { ok: true, json: async () => filas };
    if (url.includes("/rest/v1/facturas?id=eq.")) return { ok: true };
    if (url.endsWith("/3/cfdis")) return facturama === "ok"
      ? { ok: true, json: async () => ({ Id: "fx1", Total: 130, Complement: { TaxStamp: { Uuid: "UUID-1" } } }) }
      : { ok: false, status: 400, json: async () => ({ Message: "El RFC no está en la lista del SAT" }) };
    if (url.includes("/cfdi?cfdiType=issued")) return { ok: correo === "ok", status: correo === "ok" ? 200 : 500 };
    throw new Error("URL inesperada " + url);
  };
  return { fetch, llamadas, parches: () => llamadas.filter((l) => l.op.method === "PATCH").map((l) => l.body) };
}
const base = { supabase: { url: "https://x.supabase.co", llaveServicio: "srv" }, facturama: { usuario: "u", clave: "c", sandbox: true }, emisor: { cp: "82000" } };

test("timbra, guarda el UUID y manda el correo", async () => {
  const f = falso({ filas: [solicitud()] });
  const r = await timbrarPendientes({ fetch: f.fetch, ...base });
  assert.deepEqual(r, { timbradas: [1], errores: [] });
  const cfdi = f.llamadas.find((l) => l.url.endsWith("/3/cfdis"));
  assert.equal(cfdi.url, "https://apisandbox.facturama.mx/3/cfdis");
  assert.equal(cfdi.body.Receiver.Rfc, "EKU9003173C9");
  assert.equal(cfdi.body.ExpeditionPlace, "82000");
  assert.equal(cfdi.body.Items[0].Total, 130);
  assert.equal(f.parches()[0].estado, "timbrada");
  assert.equal(f.parches()[0].uuid, "UUID-1");
  assert.ok(f.llamadas.some((l) => l.url.includes("email=c%40ejemplo.mx")));
});

test("RFC con dígito verificador malo: no llama a Facturama y queda en error", async () => {
  const f = falso({ filas: [solicitud({ rfc: "EKU9003173C8" })] });
  const r = await timbrarPendientes({ fetch: f.fetch, ...base });
  assert.equal(r.errores.length, 1);
  assert.ok(!f.llamadas.some((l) => l.url.endsWith("/3/cfdis")));
  assert.equal(f.parches()[0].estado, "error");
  assert.match(f.parches()[0].error, /Datos fiscales/);
});

test("Facturama rechaza: suma un intento; al tercero queda en error", async () => {
  let f = falso({ filas: [solicitud()], facturama: "mal" });
  await timbrarPendientes({ fetch: f.fetch, ...base });
  assert.deepEqual(f.parches()[0], { intentos: 1, error: "No se pudo timbrar: El RFC no está en la lista del SAT" });
  f = falso({ filas: [solicitud({ intentos: 2 })], facturama: "mal" });
  await timbrarPendientes({ fetch: f.fetch, ...base });
  assert.equal(f.parches()[0].estado, "error");
});

test("si el correo falla, la factura sigue timbrada (no se vuelve a timbrar)", async () => {
  const f = falso({ filas: [solicitud()], correo: "mal" });
  const r = await timbrarPendientes({ fetch: f.fetch, ...base });
  assert.deepEqual(r.timbradas, [1]);
  assert.equal(f.parches().length, 2);
  assert.equal(f.parches()[1].estado, undefined);
  assert.match(f.parches()[1].error, /correo falló/);
});
