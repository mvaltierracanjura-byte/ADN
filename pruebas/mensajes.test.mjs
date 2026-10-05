import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificar, ruta } from "../kit/mensajes.js";
import { plan, segmento, esBaja } from "../kit/reactivacion.js";
import { clasificarIA } from "../servidor/clasificar.js";

test("clasificar por reglas: intención, urgencia, persona y número de pedido", () => {
  const c1 = clasificar("¿Dónde está mi pedido #4823?");
  assert.deepEqual([c1.intencion, c1.pedido, ruta(c1)], ["estado_pedido", "4823", "responder"]);
  assert.equal(ruta(clasificar("¿ya viene mi pedido?")), "preguntar", "sin número hay que preguntarlo");
  assert.equal(clasificar("¿ya viene mi pedido?").urgencia, "normal", "\"ya\" no es urgencia");
  assert.equal(clasificar("Es urgente, tengo mucho dolor").urgencia, "alta");
  const q = clasificar("Mi pedido llegó incompleto, faltó una galleta");
  assert.deepEqual([q.intencion, q.urgencia, q.persona, ruta(q)], ["queja", "alta", true, "persona"]);
  assert.equal(clasificar("¿Cuánto cuesta la limpieza?").intencion, "precio");
  assert.equal(clasificar("¿A qué hora abren?").intencion, "horario");
  assert.equal(clasificar("Quiero agendar una cita para mañana").intencion, "cita");
  assert.equal(clasificar("¿Me pasan la CLABE para la transferencia?").intencion, "pago");
  assert.equal(clasificar("Necesito factura, mi RFC es…").intencion, "factura");
  assert.equal(ruta(clasificar("Gracias!")), "seguimiento");
  assert.equal(clasificar("Quiero hablar con el encargado").persona, true);
  assert.equal(clasificar("How much is the cleaning?").intencion, "precio");
});

test("reactivación: segmentos por historial de compras", () => {
  const hoy = "2026-10-05";
  assert.equal(segmento({ compras: ["2026-09-20"] }, hoy), "segunda");
  assert.equal(segmento({ compras: ["2026-10-01"] }, hoy), null, "compró hace poco");
  assert.equal(segmento({ compras: ["2026-07-01"] }, hoy), "perdido");
  assert.equal(segmento({ compras: ["2026-08-01", "2026-08-20"] }, hoy), "dormido");
  assert.equal(segmento({ compras: ["2026-09-01", "2026-09-05", "2026-09-09", "2026-09-13"] }, hoy), "riesgo", "venía cada 4 días y ya van 22");
  assert.equal(segmento({ compras: [] }, hoy), null);
});

test("plan: respeta bajas y tope de frecuencia, arma mensajes y calcula costo", () => {
  const clientes = [
    { tel: "1", nombre: "Laura Méndez", compras: ["2026-09-20"] },
    { tel: "2", nombre: "Jorge", compras: ["2026-06-01"], baja: true },
    { tel: "3", nombre: "Sofía", compras: ["2026-08-01"], ultimoMensaje: "2026-10-01" },
    { tel: "4", nombre: "Raúl", compras: ["2026-08-01"] },
  ];
  const p = plan({ clientes, hoy: "2026-10-05", negocio: "Café La Muestra", oferta: "un postre gratis con tu bebida" });
  assert.equal(p.total, 2);
  assert.equal(p.costo, 1.46);
  const seg = p.grupos.find((g) => g.segmento === "segunda").clientes[0];
  assert.match(seg.mensaje, /^Hola, Laura\. Gracias por tu primera visita a Café La Muestra.*un postre gratis.*BAJA/);
  assert.equal(p.grupos.find((g) => g.segmento === "dormido").clientes[0].tel, "4");
  assert.equal(p.siguiente, "2026-10-19");
});

test("bajas", () => {
  assert.ok(esBaja("BAJA")); assert.ok(esBaja("stop")); assert.ok(esBaja("ya no me manden mensajes"));
  assert.ok(!esBaja("bajaron los precios?"));
});

test("clasificar con IA: salida estructurada, sin forzar herramientas", async () => {
  let pet;
  const anthropic = { messages: { create: async (p) => { pet = p; return { stop_reason: "end_turn", content: [{ type: "text", text: '{"intencion":"queja","urgencia":"alta","persona":true,"pedido":"4823","motivo":"Llegó incompleto"}' }] }; } } };
  const r = await clasificarIA({ anthropic, texto: "llegó incompleto el 4823" });
  assert.deepEqual(r, { intencion: "queja", urgencia: "alta", persona: true, pedido: "4823", motivo: "Llegó incompleto" });
  assert.equal(pet.output_config.format.type, "json_schema");
  assert.equal(pet.output_config.format.schema.additionalProperties, false);
  assert.ok(!pet.tool_choice);
  const neg = { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } };
  assert.equal((await clasificarIA({ anthropic: neg, texto: "x" })).persona, true);
});
