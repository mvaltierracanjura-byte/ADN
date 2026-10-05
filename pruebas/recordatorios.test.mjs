import { test } from "node:test";
import assert from "node:assert/strict";
import { enviarRecordatorios } from "../servidor/recordatorios.js";

function falso({ citas, fallaWhatsApp = new Set() }) {
  const llamadas = [];
  const fetch = async (url, op) => {
    llamadas.push({ url, op, body: op.body ? JSON.parse(op.body) : null });
    if (url.endsWith("/rpc/citas_por_recordar")) return { ok: true, json: async () => citas };
    if (url.includes("graph.facebook.com")) {
      const to = JSON.parse(op.body).to;
      return fallaWhatsApp.has(to) ? { ok: false, status: 400, text: async () => "plantilla no aprobada" } : { ok: true, json: async () => ({}) };
    }
    if (url.includes("/rest/v1/citas?id=eq.")) return { ok: true };
    throw new Error("URL inesperada " + url);
  };
  return { fetch, llamadas };
}
const base = {
  supabase: { url: "https://x.supabase.co", llaveServicio: "srv" },
  whatsapp: { token: "wa", telefonoId: "123", plantilla: "recordatorio_cita" },
  enlaceBase: "https://adn.mx/cita.html#", negocio: "Consultorio Sonrisa",
};

test("manda la plantilla con los 6 datos y marca la cita como recordada", async () => {
  const { fetch, llamadas } = falso({ citas: [{ id: "c1", token: "tok1", cliente_nombre: "María López", cliente_tel: "6691234567", servicio: "Limpieza", personal: "Dra. Ana", inicio: "2026-10-06T16:30:00" }] });
  const r = await enviarRecordatorios({ fetch, ...base });
  assert.deepEqual(r, { enviados: ["c1"], fallidos: [] });
  const wa = llamadas.find((l) => l.url.includes("graph.facebook.com"));
  assert.equal(wa.url, "https://graph.facebook.com/v23.0/123/messages");
  assert.equal(wa.op.headers.Authorization, "Bearer wa");
  assert.equal(wa.body.to, "526691234567");
  assert.equal(wa.body.template.name, "recordatorio_cita");
  assert.equal(wa.body.template.language.code, "es_MX");
  assert.deepEqual(wa.body.template.components[0].parameters.map((p) => p.text),
    ["María", "Consultorio Sonrisa", "Limpieza con Dra. Ana", "martes 6 de octubre", "4:30 p. m.", "https://adn.mx/cita.html#tok1"]);
  const marca = llamadas.find((l) => l.op.method === "PATCH");
  assert.equal(marca.url, "https://x.supabase.co/rest/v1/citas?id=eq.c1");
  assert.deepEqual(marca.body, { recordada: true });
  assert.equal(llamadas[0].body.horas, 24);
});

test("si WhatsApp falla no la marca (se reintenta en la siguiente vuelta) y sigue con las demás", async () => {
  const citas = [
    { id: "c1", token: "a", cliente_nombre: "Uno", cliente_tel: "6690000001", servicio: "S", personal: "P", inicio: "2026-10-06 09:00:00" },
    { id: "c2", token: "b", cliente_nombre: "Dos", cliente_tel: "6690000002", servicio: "S", personal: "P", inicio: "2026-10-06 10:00:00" },
  ];
  const { fetch, llamadas } = falso({ citas, fallaWhatsApp: new Set(["526690000001"]) });
  const r = await enviarRecordatorios({ fetch, ...base });
  assert.deepEqual(r.enviados, ["c2"]);
  assert.equal(r.fallidos[0].id, "c1");
  assert.match(r.fallidos[0].error, /400/);
  assert.equal(llamadas.filter((l) => l.op.method === "PATCH").length, 1);
});

test("si no puede leer las citas, avisa con error", async () => {
  await assert.rejects(enviarRecordatorios({ fetch: async () => ({ ok: false, status: 401 }), ...base }), /401/);
});
