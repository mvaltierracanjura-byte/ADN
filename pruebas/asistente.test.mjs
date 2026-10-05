import { test } from "node:test";
import assert from "node:assert/strict";
import { conversar, instrucciones, MODELO_POR_DEFECTO } from "../servidor/asistente.js";
import { DEFINICIONES, ejecutorAgenda } from "../servidor/herramientas-agenda.js";
import { almacenAgenda } from "../kit/almacen-agenda.js";
import * as A from "../kit/agenda.js";

// Claude simulado: devuelve las respuestas en orden y guarda cada petición.
function claudeFalso(respuestas) {
  const peticiones = [];
  return {
    peticiones,
    beta: { messages: { create: async (p) => { peticiones.push(structuredClone(p)); const r = respuestas.shift(); if (!r) throw new Error("sin respuesta"); return { usage: { input_tokens: 100, output_tokens: 20 }, ...r }; } } },
  };
}
const negocio = { nombre: "Consultorio Sonrisa", giro: "consultorio dental", conocimiento: "Servicios: limpieza ($700, 60 min). Horario: lunes a sábado." };
const ahora = { fecha: "2026-10-05", hora: "10:00" };
const texto = (t) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });

test("petición: modelo, respaldo por rechazo, caché, herramientas estrictas y fecha al final", async () => {
  const c = claudeFalso([texto("¡Hola! ¿En qué te ayudo?")]);
  const r = await conversar({ anthropic: c, negocio, historial: [{ autor: "cliente", texto: "Hola" }], herramientas: DEFINICIONES, ahora });
  assert.equal(r.texto, "¡Hola! ¿En qué te ayudo?");
  assert.equal(r.accion, null);
  const p = c.peticiones[0];
  assert.equal(p.model, MODELO_POR_DEFECTO);
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.cache_control, { type: "ephemeral" });
  assert.equal(p.output_config.effort, "low");
  assert.ok(!("thinking" in p), "no se manda thinking (Opus 5.5 siempre piensa)");
  assert.ok(!("tool_choice" in p), "sin tool_choice forzado");
  assert.ok(p.tools.every((t) => t.strict === true));
  assert.ok(p.tools.some((t) => t.name === "pasar_a_persona"));
  assert.ok(!/2026-10-05/.test(p.system[0].text), "las instrucciones no llevan la fecha (para no romper la caché)");
  const ultimo = p.messages[p.messages.length - 1];
  assert.equal(ultimo.role, "system");
  assert.match(ultimo.content, /2026-10-05.*10:00/);
  assert.equal(r.uso.entrada, 100);
});

test("las instrucciones son idénticas entre llamadas (caché) y cambian por canal", () => {
  assert.equal(instrucciones(negocio), instrucciones(negocio));
  assert.match(instrucciones(negocio, "telefono"), /por teléfono/);
  assert.match(instrucciones(negocio), /español de México o inglés/);
  assert.match(instrucciones(negocio), /asistente virtual/);
});

test("ciclo con herramienta: consulta horarios y contesta con lo que devolvió", async () => {
  const c = claudeFalso([
    { stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "tool_use", id: "t1", name: "ver_horarios_libres", input: { servicio_id: "limpieza", fecha: "2026-10-06", persona_id: null } }] },
    texto("Mañana tengo libre a las 9:00 y 10:00."),
  ]);
  const llamadas = [];
  const r = await conversar({ anthropic: c, negocio, historial: [{ autor: "cliente", texto: "¿Tienen limpieza mañana?" }], herramientas: DEFINICIONES, ahora,
    ejecutar: async (n, i) => { llamadas.push([n, i]); return { horarios: ["09:00", "10:00"] }; } });
  assert.equal(r.texto, "Mañana tengo libre a las 9:00 y 10:00.");
  assert.deepEqual(r.herramientas, ["ver_horarios_libres"]);
  assert.equal(llamadas[0][0], "ver_horarios_libres");
  const seg = c.peticiones[1].messages;
  assert.equal(seg[seg.length - 2].role, "assistant");
  assert.equal(seg[seg.length - 2].content[0].type, "thinking", "el bloque de pensamiento se reenvía sin tocar");
  assert.equal(seg[seg.length - 1].content[0].type, "tool_result");
  assert.equal(seg[seg.length - 1].content[0].tool_use_id, "t1");
});

test("error de una herramienta se devuelve como is_error y la plática sigue", async () => {
  const c = claudeFalso([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "apartar_cita", input: {} }] },
    texto("Ese horario ya se ocupó, ¿te late otro?"),
  ]);
  const r = await conversar({ anthropic: c, negocio, historial: [{ autor: "cliente", texto: "a las 9" }], ahora, herramientas: DEFINICIONES,
    ejecutar: async () => { throw new Error("Ese horario ya no está disponible."); } });
  assert.match(r.texto, /otro/);
  const res = c.peticiones[1].messages.at(-1).content[0];
  assert.equal(res.is_error, true);
  assert.match(res.content, /no está disponible/);
});

test("pasa a persona: por herramienta, por rechazo, por corte y por no terminar", async () => {
  let r = await conversar({ anthropic: claudeFalso([{ stop_reason: "tool_use", content: [{ type: "text", text: "Te paso con alguien." }, { type: "tool_use", id: "p", name: "pasar_a_persona", input: { motivo: "queja por cobro" } }] }]),
    negocio, historial: [{ autor: "cliente", texto: "me cobraron doble" }], ahora });
  assert.deepEqual([r.accion, r.motivo, r.texto], ["persona", "queja por cobro", "Te paso con alguien."]);
  r = await conversar({ anthropic: claudeFalso([{ stop_reason: "refusal", content: [] }]), negocio, historial: [{ autor: "cliente", texto: "x" }], ahora });
  assert.equal(r.accion, "persona");
  r = await conversar({ anthropic: claudeFalso([{ stop_reason: "max_tokens", content: [{ type: "text", text: "Bla" }] }]), negocio, historial: [{ autor: "cliente", texto: "x" }], ahora });
  assert.equal(r.accion, "persona");
  const vueltas = Array.from({ length: 3 }, (_, i) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t" + i, name: "ver_servicios", input: {} }] }));
  r = await conversar({ anthropic: claudeFalso(vueltas), negocio, historial: [{ autor: "cliente", texto: "x" }], ahora, maxVueltas: 3 });
  assert.equal(r.accion, "persona");
  assert.match(r.motivo, /no terminó/);
});

test("historial: une turnos seguidos, marca respuestas del equipo y exige terminar en el cliente", async () => {
  const c = claudeFalso([texto("ok")]);
  await conversar({ anthropic: c, negocio, ahora, historial: [
    { autor: "asistente", texto: "Hola" }, { autor: "cliente", texto: "Quiero cita" }, { autor: "cliente", texto: "para mañana" },
    { autor: "equipo", texto: "Claro, te ayudamos" }, { autor: "cliente", texto: "gracias" }] });
  const m = c.peticiones[0].messages;
  assert.deepEqual(m.map((x) => x.role), ["user", "assistant", "user", "assistant", "user", "system"]);
  assert.equal(m[2].content, "Quiero cita\npara mañana");
  assert.match(m[3].content, /\[Respuesta de una persona del equipo\]/);
  await assert.rejects(conversar({ anthropic: claudeFalso([]), negocio, ahora, historial: [{ autor: "asistente", texto: "hola" }] }), /terminar con un mensaje del cliente/);
});

test("tras un cambio de modelo por rechazo, solo se reenvía lo que va después del bloque fallback (y texto)", async () => {
  const c = claudeFalso([
    { stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "a" }, { type: "text", text: "Déjame ver" }, { type: "fallback", from: { model: "x" }, to: { model: "y" } }, { type: "tool_use", id: "t1", name: "ver_servicios", input: {} }] },
    texto("Listo"),
  ]);
  await conversar({ anthropic: c, negocio, ahora, historial: [{ autor: "cliente", texto: "x" }], ejecutar: async () => [] });
  const enviado = c.peticiones[1].messages.at(-2).content.map((b) => b.type);
  assert.deepEqual(enviado, ["text", "tool_use"]);
});

// ───── Herramientas de agenda contra la agenda en modo demo ─────
test("herramientas de agenda: servicios, horarios, apartar, mis citas, cambiar y cancelar solo las propias", async () => {
  const hoy = { fecha: "2026-10-05", hora: "08:00" }; // lunes
  const almacen = almacenAgenda({ demo: "prueba-" + Math.random(), ahora: () => hoy });
  const ej = ejecutorAgenda({ almacen, tel: "+52 669 777 8888", enlaceBase: "https://x/cita.html#" });
  const servicios = await ej("ver_servicios", {});
  assert.ok(servicios.find((s) => s.id === "limpieza" && s.personas.length === 2));
  const libres = await ej("ver_horarios_libres", { servicio_id: "limpieza", fecha: "2026-10-07", persona_id: null });
  assert.ok(libres.horarios.includes("09:00"));
  assert.equal(libres.dia, "miércoles 7 de octubre");
  const ap = await ej("apartar_cita", { servicio_id: "limpieza", fecha: "2026-10-07", hora: "09:00", nombre: "Rosa Pérez", persona_id: null });
  assert.equal(ap.ok, true);
  assert.match(ap.enlace, /^https:\/\/x\/cita\.html#/);
  const mias = await ej("mis_citas", {});
  assert.equal(mias.length, 1);
  assert.equal(mias[0].servicio, "Limpieza dental");
  const cambio = await ej("cambiar_cita", { cita_id: mias[0].id, fecha: "2026-10-08", hora: "10:00" });
  assert.equal(cambio.hora, "10:00 a. m.");
  const otro = ejecutorAgenda({ almacen, tel: "6690000000" });
  await assert.rejects(otro("cancelar_cita", { cita_id: mias[0].id }), /entre las de este cliente/);
  assert.deepEqual(await ej("cancelar_cita", { cita_id: mias[0].id }), { ok: true });
  assert.equal((await ej("mis_citas", {})).length, 0);
});

test("definiciones: esquemas estrictos válidos (todo requerido, sin propiedades extra)", () => {
  for (const d of DEFINICIONES) {
    assert.equal(d.input_schema.additionalProperties, false, d.name);
    assert.deepEqual(d.input_schema.required.sort(), Object.keys(d.input_schema.properties).sort(), d.name);
  }
  assert.ok(A.fechaLarga);
});
