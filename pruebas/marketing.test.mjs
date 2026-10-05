import { test } from "node:test";
import assert from "node:assert/strict";
import * as K from "../kit/contenido.js";
import * as G from "../kit/geo.js";
import * as V from "../kit/privacidad.js";
import { redactarTextos } from "../servidor/contenido.js";

test("Pascua y Carnaval de Mazatlán", () => {
  assert.equal(K.pascua(2026), "2026-04-05");
  assert.equal(K.pascua(2027), "2027-03-28");
  const f = new Map(K.fechasEspeciales(2027).map(([d, n]) => [n, d]));
  assert.equal(f.get("Martes de Carnaval"), "2027-02-09");
  assert.equal(f.get("Día del Padre"), "2027-06-20");
});

test("calendario: fechas especiales del mes y tres publicaciones por semana", () => {
  const c = K.calendario({ anio: 2026, mes: 11, productos: ["Latte", "Frappé", "Galleta rellena"], negocio: "Café La Muestra" });
  assert.equal(c[0].fecha, "2026-11-01");
  assert.equal(c[0].especial, "Día de Muertos");
  assert.ok(c.length >= 12 && c.length <= 15, `${c.length} publicaciones`);
  assert.ok(c.every((p) => p.fecha.startsWith("2026-11")));
  assert.ok(c.some((p) => /Latte/.test(p.idea)) && c.some((p) => /Frappé/.test(p.idea)));
});

test("auditoría de Google: puntaje y pendientes ordenados por impacto", () => {
  const a = G.auditoria(["perfil", "horario", "fotos"]);
  assert.equal(a.puntaje, 30);
  assert.equal(a.nivel, "Casi invisible");
  assert.equal(a.pendientes[0].id, "resenas");
  assert.equal(G.auditoria(G.PUNTOS.map((p) => p.id)).puntaje, 100);
});

test("JSON-LD de negocio local con horario y FAQ", () => {
  const o = G.jsonLd({ tipo: "CafeOrCoffeeShop", nombre: "Café La Muestra", telefono: "+52 669 000 0000", cp: "82000", horario: { 1: [["08:00", "21:00"]], 0: [["09:00", "14:00"]] }, redes: ["https://instagram.com/x"] });
  assert.equal(o["@type"], "CafeOrCoffeeShop");
  assert.equal(o.address.addressCountry, "MX");
  assert.deepEqual(o.openingHoursSpecification.map((h) => h.dayOfWeek).sort(), ["Monday", "Sunday"]);
  const s = G.etiquetaScript(G.faqLd([{ pregunta: "¿Hay estacionamiento?", respuesta: "Sí, <gratis>." }]));
  assert.match(s, /FAQPage/);
  assert.doesNotMatch(s, /<gratis>/, "escapa < para no romper el script");
});

test("aviso de privacidad generado con lo obligatorio", () => {
  const t = V.generarAviso({ responsable: "Ana López", nombreComercial: "Consultorio Sonrisa", domicilio: "Av. Del Mar 100, Mazatlán", correo: "a@b.mx",
    datos: ["nombre"], sensibles: [V.SENSIBLES[0]], finalidades: ["Agendar tus citas"], secundarias: ["Promociones"], comparte: ["Proveedor de facturación"], fecha: "5 de octubre de 2026" });
  for (const r of [/Responsable/, /Ana López, que opera con el nombre comercial Consultorio Sonrisa/, /Datos sensibles/, /ARCO/, /puedes negarte/, /Secretaría Anticorrupción/]) assert.match(t, r);
});

test("redactar textos con IA: salida estructurada y reglas", async () => {
  let pet;
  const anthropic = { messages: { create: async (p) => { pet = p; return { stop_reason: "end_turn", content: [{ type: "text", text: '{"textos":[{"fecha":"2026-11-01","texto":"Hola"}]}' }] }; } } };
  const r = await redactarTextos({ anthropic, negocio: { nombre: "Café" }, posts: [{ fecha: "2026-11-01", formato: "Reel", tipo: "x", idea: "y" }] });
  assert.deepEqual(r, [{ fecha: "2026-11-01", texto: "Hola" }]);
  assert.match(pet.system, /Solo usa precios, productos y promociones/);
  assert.equal(pet.output_config.format.type, "json_schema");
});
