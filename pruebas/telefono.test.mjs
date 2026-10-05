import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { crearTelefono, firmaTwilio, escXml } from "../servidor/telefono.js";

const urlBase = "https://x.supabase.co/functions/v1/voz";
const authToken = "secreto-twilio";
// Firma calculada con node:crypto, para comparar contra la implementación con crypto.subtle.
const firmar = (ruta, params) => createHmac("sha1", authToken).update(urlBase + ruta + Object.keys(params).sort().map((k) => k + params[k]).join("")).digest("base64");
const claude = (...respuestas) => { const c = { peticiones: [] }; c.beta = { messages: { create: async (p) => { c.peticiones.push(p); return respuestas.shift(); } } }; return c; };
const texto = (t) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }], usage: {} });
const negocio = { nombre: "Taller Hernández", conocimiento: "Afinación $1,200." };
const ahora = () => ({ fecha: "2026-10-05", hora: "11:00" });
const llamar = async (tel, ruta, params) => tel.atender({ ruta, params, firma: firmar(ruta, params) });

test("la firma coincide con la de Twilio y una firma falsa se rechaza", async () => {
  const p = { CallSid: "CA1", From: "+526691234567" };
  assert.equal(await firmaTwilio(authToken, urlBase + "/telefono", p), firmar("/telefono", p));
  const tel = crearTelefono({ anthropic: claude(), negocio, authToken, urlBase, ahora });
  assert.equal((await tel.atender({ ruta: "/telefono", params: p, firma: "falsa" })).status, 403);
  assert.equal((await tel.atender({ ruta: "/telefono", params: { ...p, From: "+520000000000" }, firma: firmar("/telefono", p) })).status, 403, "parámetros alterados");
});

test("al entrar la llamada saluda en español y escucha", async () => {
  const tel = crearTelefono({ anthropic: claude(), negocio, authToken, urlBase, ahora });
  const r = await llamar(tel, "/telefono", { CallSid: "CA1", From: "+526691234567" });
  assert.equal(r.status, 200);
  assert.match(r.xml, /^<\?xml/);
  assert.match(r.xml, /<Gather input="speech" language="es-MX"[^>]*action="https:\/\/x\.supabase\.co\/functions\/v1\/voz\/telefono\/turno"/);
  assert.match(r.xml, /gracias por llamar a Taller Hernández\. Soy la asistente virtual/);
});

test("un turno: manda lo dicho al asistente por canal teléfono y lee la respuesta", async () => {
  const c = claude(texto("Claro, la afinación cuesta mil doscientos pesos."));
  const tel = crearTelefono({ anthropic: c, negocio, authToken, urlBase, ahora });
  await llamar(tel, "/telefono", { CallSid: "CA2", From: "+526691234567" });
  const r = await llamar(tel, "/telefono/turno", { CallSid: "CA2", From: "+526691234567", SpeechResult: "¿Cuánto cuesta la afinación?" });
  assert.match(r.xml, /<Say language="es-MX" voice="Polly.Mia-Neural">Claro, la afinación cuesta mil doscientos pesos\.<\/Say>/);
  assert.match(c.peticiones[0].system[0].text, /por teléfono/);
});

test("si el cliente habla en inglés, la siguiente respuesta y escucha van en inglés", async () => {
  const tel = crearTelefono({ anthropic: claude(texto("Sure! A tune-up is 1,200 pesos.")), negocio, authToken, urlBase, ahora });
  await llamar(tel, "/telefono", { CallSid: "CA3", From: "+16195550100" });
  const r = await llamar(tel, "/telefono/turno", { CallSid: "CA3", SpeechResult: "Hi, how much is a tune up please?" });
  assert.match(r.xml, /<Gather input="speech" language="en-US"/);
  assert.match(r.xml, /voice="Polly.Joanna-Neural">Sure!/);
});

test("pasar a persona: transfiere si hay número, si no promete devolver la llamada y avisa al equipo", async () => {
  const persona = { stop_reason: "tool_use", content: [{ type: "tool_use", id: "p", name: "pasar_a_persona", input: { motivo: "quiere hablar con el dueño" } }], usage: {} };
  const avisos = [];
  let tel = crearTelefono({ anthropic: claude(persona), negocio, authToken, urlBase, ahora, transferirA: "+526699876543", alPasarAPersona: async (a) => avisos.push(a) });
  await llamar(tel, "/telefono", { CallSid: "CA4", From: "+526691234567" });
  let r = await llamar(tel, "/telefono/turno", { CallSid: "CA4", SpeechResult: "Quiero hablar con el dueño" });
  assert.match(r.xml, /<Dial>\+526699876543<\/Dial>/);
  assert.equal(avisos[0].tel, "6691234567");
  assert.equal(avisos[0].motivo, "quiere hablar con el dueño");
  tel = crearTelefono({ anthropic: claude({ ...persona }), negocio, authToken, urlBase, ahora });
  await llamar(tel, "/telefono", { CallSid: "CA5", From: "+526691234567" });
  r = await llamar(tel, "/telefono/turno", { CallSid: "CA5", SpeechResult: "Tengo una queja" });
  assert.match(r.xml, /te devolvemos la llamada pronto.*<Hangup\/>/);
});

test("silencio: pregunta una vez y a la segunda cuelga con despedida", async () => {
  const tel = crearTelefono({ anthropic: claude(), negocio, authToken, urlBase, ahora });
  await llamar(tel, "/telefono", { CallSid: "CA6", From: "+526691234567" });
  let r = await llamar(tel, "/telefono/turno", { CallSid: "CA6" });
  assert.match(r.xml, /Sigues ahí/);
  r = await llamar(tel, "/telefono/turno", { CallSid: "CA6" });
  assert.match(r.xml, /No te escuché.*<Hangup\/>/);
});

test("si el sistema falla, no deja al cliente colgado: avisa y pasa a persona", async () => {
  const roto = { beta: { messages: { create: async () => { throw new Error("sin conexión"); } } } };
  const avisos = [];
  const tel = crearTelefono({ anthropic: roto, negocio, authToken, urlBase, ahora, alPasarAPersona: async (a) => avisos.push(a) });
  await llamar(tel, "/telefono", { CallSid: "CA7", From: "+526691234567" });
  const r = await llamar(tel, "/telefono/turno", { CallSid: "CA7", SpeechResult: "hola" });
  assert.match(r.xml, /tuve un problema/);
  assert.match(avisos[0].motivo, /sin conexión/);
});

test("escapa XML en lo que se lee", () => {
  assert.equal(escXml(`<b> & "x" 'y'`), "&lt;b&gt; &amp; &quot;x&quot; &apos;y&apos;");
});
