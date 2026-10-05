import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verificarFirma, extraerMensajes, atenderMensaje } from "../servidor/whatsapp.js";

const aviso = (mensajes) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ value: {
  contacts: [{ wa_id: "5216691234567", profile: { name: "María" } }], messages: mensajes } }] }] });

test("firma de Meta (sha256) válida e inválida", async () => {
  const cuerpo = JSON.stringify({ a: 1 });
  const buena = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
  assert.equal(await verificarFirma("secreto", cuerpo, buena), true);
  assert.equal(await verificarFirma("secreto", cuerpo + " ", buena), false);
  assert.equal(await verificarFirma("secreto", cuerpo, "sha256=abc"), false);
  assert.equal(await verificarFirma("secreto", cuerpo, null), false);
});

test("extraer mensajes: texto, botones, audio; ignora avisos de entrega", () => {
  const m = extraerMensajes(aviso([
    { id: "w1", from: "5216691234567", type: "text", text: { body: "Hola" } },
    { id: "w2", from: "5216691234567", type: "interactive", interactive: { button_reply: { title: "Confirmar" } } },
    { id: "w3", from: "5216691234567", type: "audio", audio: { id: "x" } },
  ]));
  assert.deepEqual(m.map((x) => [x.id, x.tel, x.nombre, x.texto]), [["w1", "6691234567", "María", "Hola"], ["w2", "6691234567", "María", "Confirmar"], ["w3", "6691234567", "María", null]]);
  assert.deepEqual(extraerMensajes({ entry: [{ changes: [{ value: { statuses: [{ id: "s" }] } }] }] }), []);
});

function dbFalsa({ enPersona = false } = {}) {
  const guardados = [], procesados = new Set(), personas = [];
  return {
    guardados, personas,
    yaProcesado: async (id) => procesados.has(id),
    historial: async () => guardados.map(([, autor, texto]) => ({ autor, texto })),
    guardar: async (tel, autor, texto, id) => { guardados.push([tel, autor, texto]); if (id) procesados.add(id); },
    enPersona: async () => enPersona,
    pasarAPersona: async (tel, motivo) => personas.push({ tel, motivo }),
  };
}
function waFalso() {
  const enviados = [];
  return { enviados, token: "t", telefonoId: "1", fetch: async (url, op) => { enviados.push(JSON.parse(op.body)); return { ok: true }; } };
}
const claude = (...r) => ({ beta: { messages: { create: async () => ({ usage: {}, ...r.shift() }) } } });
const base = { negocio: { nombre: "Café", conocimiento: "x" }, ahora: () => ({ fecha: "2026-10-05", hora: "10:00" }) };

test("contesta con el asistente y guarda ambos mensajes", async () => {
  const db = dbFalsa(), wa = waFalso();
  const r = await atenderMensaje({ ...base, db, wa, anthropic: claude({ stop_reason: "end_turn", content: [{ type: "text", text: "¡Hola! ¿Qué te sirvo?" }] }),
    mensaje: { id: "w1", tel: "6691234567", texto: "Hola", tipo: "text" } });
  assert.deepEqual(r, { respondido: true, accion: null });
  assert.equal(wa.enviados[0].to, "526691234567");
  assert.equal(wa.enviados[0].text.body, "¡Hola! ¿Qué te sirvo?");
  assert.deepEqual(db.guardados.map((g) => g[1]), ["cliente", "asistente"]);
});

test("aviso repetido de Meta no se contesta dos veces", async () => {
  const db = dbFalsa(), wa = waFalso();
  const m = { id: "w1", tel: "6691234567", texto: "Hola", tipo: "text" };
  await atenderMensaje({ ...base, db, wa, anthropic: claude({ stop_reason: "end_turn", content: [{ type: "text", text: "Hola" }] }), mensaje: m });
  const r = await atenderMensaje({ ...base, db, wa, anthropic: claude(), mensaje: m });
  assert.equal(r.accion, "repetido");
  assert.equal(wa.enviados.length, 1);
});

test("si una persona ya tomó la plática, el asistente se queda callado", async () => {
  const db = dbFalsa({ enPersona: true }), wa = waFalso();
  const r = await atenderMensaje({ ...base, db, wa, anthropic: claude(), mensaje: { id: "w9", tel: "6691234567", texto: "¿y entonces?", tipo: "text" } });
  assert.equal(r.accion, "persona");
  assert.equal(wa.enviados.length, 0);
  assert.equal(db.guardados.length, 1, "el mensaje del cliente sí se guarda para el equipo");
});

test("pasar a persona: marca la plática y avisa al cliente en su idioma", async () => {
  const db = dbFalsa(), wa = waFalso();
  const r = await atenderMensaje({ ...base, db, wa,
    anthropic: claude({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "p", name: "pasar_a_persona", input: { motivo: "refund" } }] }),
    mensaje: { id: "w2", tel: "6691234567", texto: "I want a refund please", tipo: "text" } });
  assert.equal(r.accion, "persona");
  assert.deepEqual(db.personas, [{ tel: "6691234567", motivo: "refund" }]);
  assert.match(wa.enviados[0].text.body, /Someone from the team/);
});

test("audio o foto: pide que lo escriba", async () => {
  const db = dbFalsa(), wa = waFalso();
  await atenderMensaje({ ...base, db, wa, anthropic: claude(), mensaje: { id: "w3", tel: "6691234567", texto: null, tipo: "audio" } });
  assert.match(wa.enviados[0].text.body, /solo puedo leer mensajes de texto/);
});

test("si Claude falla, pasa a persona en vez de dejar al cliente sin respuesta", async () => {
  const db = dbFalsa(), wa = waFalso();
  const roto = { beta: { messages: { create: async () => { throw new Error("caído"); } } } };
  const r = await atenderMensaje({ ...base, db, wa, anthropic: roto, mensaje: { id: "w4", tel: "6691234567", texto: "Hola", tipo: "text" } });
  assert.equal(r.accion, "persona");
  assert.match(db.personas[0].motivo, /caído/);
  assert.match(wa.enviados[0].text.body, /Una persona del equipo/);
});
