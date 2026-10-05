import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../kit/resenas.js";
import { redactarRespuesta } from "../servidor/resenas.js";

test("enlace e invitación (español e inglés)", () => {
  assert.equal(R.enlaceResena("ChIJN1t_tDeuEmsRUsoyG83frY4"), "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.ok(R.placeIdValido("ChIJN1t_tDeuEmsRUsoyG83frY4"));
  assert.ok(!R.placeIdValido("abc"));
  assert.match(R.invitacion({ nombre: "Laura Méndez", negocio: "Café La Muestra", enlace: "E" }), /^¡Hola, Laura! Gracias por elegir Café La Muestra\..*E$/);
  assert.match(R.invitacion({ nombre: "", negocio: "X", enlace: "E", idioma: "en" }), /^Hi! Thanks/);
});

test("ninguna invitación ni borrador ofrece algo a cambio", () => {
  const textos = [R.invitacion({ negocio: "X", enlace: "E" }), R.invitacion({ negocio: "X", enlace: "E", idioma: "en" }),
    ...[1, 3, 5].flatMap((e) => [R.borrador({ estrellas: e, negocio: "X" }), R.borrador({ estrellas: e, negocio: "X", idioma: "en" })])];
  for (const t of textos) assert.doesNotMatch(t, /descuento|gratis|regalo|cup[oó]n|discount|free|gift/i);
});

test("borradores según estrellas", () => {
  assert.match(R.borrador({ estrellas: 5, nombre: "Ana", negocio: "Sonrisa" }), /^Hola, Ana\. ¡Muchas gracias.*Sonrisa/);
  assert.match(R.borrador({ estrellas: 3, negocio: "S", contacto: "669 216 6036" }), /qué podemos mejorar: escríbenos al 669 216 6036/);
  assert.match(R.borrador({ estrellas: 1, negocio: "S" }), /Lamentamos/);
  assert.match(R.borrador({ estrellas: 2, nombre: "Mike", negocio: "S", idioma: "en" }), /^Hi Mike, we're sorry/);
});

test("métricas: promedio, porcentaje respondido y negativas pendientes", () => {
  const m = R.metricas([{ estrellas: 5, respondida: true }, { estrellas: 4, respondida: false }, { estrellas: 2, respondida: false }, { estrellas: 5, respondida: true }]);
  assert.deepEqual(m, { total: 4, promedio: 4, respondidas: 0.5, sinResponderNegativas: 1 });
  assert.equal(R.metricas([]).promedio, null);
});

test("redactar con IA: reglas en el sistema, respaldo por rechazo y plantilla si no contesta", async () => {
  let pet;
  const ok = { beta: { messages: { create: async (p) => { pet = p; return { stop_reason: "end_turn", content: [{ type: "text", text: "¡Gracias, Ana! El equipo de Sonrisa" }] }; } } } };
  const t = await redactarRespuesta({ anthropic: ok, resena: { estrellas: 5, nombre: "Ana", texto: "Excelente atención" }, negocio: { nombre: "Sonrisa" } });
  assert.equal(t, "¡Gracias, Ana! El equipo de Sonrisa");
  assert.match(pet.system, /Nunca ofrezcas descuentos/);
  assert.equal(pet.fallbacks, "default");
  const no = { beta: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } };
  assert.match(await redactarRespuesta({ anthropic: no, resena: { estrellas: 1, nombre: "Mike", texto: "Terrible service, never again" }, negocio: { nombre: "S" } }), /^Hi Mike, we're sorry/);
});
