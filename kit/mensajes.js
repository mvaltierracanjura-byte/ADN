// Clasificar cada mensaje y decidir la ruta, como en el caso de la tienda que bajó de 50 a 7 pedidos:
// el problema no era vender, eran 73 mensajes al día sin orden. "Automatizar bien es saber cuándo NO contestar."
// Versión por reglas (rápida, sin costo, sirve para la bandeja y la demo). En el servidor, servidor/clasificar.js
// hace lo mismo con IA y devuelve la misma forma.
//
// clasificar(texto) → { intencion, urgencia: "alta"|"normal"|"baja", persona: boolean, pedido: string|null, motivo }
// ruta(c)           → "responder" | "preguntar" | "persona" | "seguimiento"

export const INTENCIONES = ["queja", "estado_pedido", "pedido", "cita", "precio", "horario", "ubicacion", "pago", "factura", "saludo", "gracias", "otro"];

const sin = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const REGLAS = [
  ["queja", /(queja|mal servicio|pesimo|horrible|enojad|molest|reclam|devolu|reembolso|refund|no llego|nunca llego|llego (frio|incompleto|mal|tarde)|incomplet|me cobraron (doble|de mas)|estafa|terrible|worst|complain)/],
  ["estado_pedido", /(donde (esta|viene)|mi pedido|ya (salio|viene)|cuanto (falta|tarda)|status|where is my order|seguimiento)/],
  ["factura", /(factura|rfc|cfdi|invoice)/],
  ["pago", /(transferencia|clabe|deposito|pago|pagar|tarjeta|comprobante|liga de pago|payment)/],
  ["cita", /(cita|agendar|reservar|reservacion|turno|disponibilidad|appointment|book|booking)/],
  ["pedido", /(quiero (pedir|ordenar)|me (das|da|pones|manda)|para llevar|a domicilio|ordenar|pedido para|order)/],
  ["precio", /(precio|cuanto (cuesta|sale|es)|costo|how much|price)/],
  ["horario", /(horario|a que hora|abren|cierran|abierto|open|close)/],
  ["ubicacion", /(donde (estan|quedan)|direccion|ubicacion|como llego|location|address)/],
  ["gracias", /^(gracias|muchas gracias|ok gracias|thanks|thank you)[!. ]*$/],
  ["saludo", /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hi|hello|hey)[!. ]*$/],
];
const URGENTE = /\b(urgente|urge|ahorita|ahora mismo|hoy mismo|asap|emergencia|dolor|sangr\w*)\b/;

export function clasificar(texto) {
  const t = sin(texto).trim();
  const intencion = (REGLAS.find(([, re]) => re.test(t)) || ["otro"])[0];
  const pedido = (t.match(/(?:pedido|orden|folio|order)\s*(?:#|no\.?|numero)?\s*([a-z]{0,3}-?\d{3,})/) || [])[1] || null;
  const urgencia = intencion === "queja" || URGENTE.test(t) ? "alta" : ["gracias", "saludo"].includes(intencion) ? "baja" : "normal";
  const persona = intencion === "queja" || /(persona|humano|encargad|gerente|dueno|duena|human|manager)/.test(t);
  const motivo = persona ? (intencion === "queja" ? "Queja o problema con un pedido o cobro" : "Pidió hablar con una persona") : "";
  return { intencion, urgencia, persona, pedido: pedido ? pedido.toUpperCase() : null, motivo };
}

export function ruta(c) {
  if (c.persona) return "persona";
  if (c.intencion === "estado_pedido" && !c.pedido) return "preguntar";
  if (c.intencion === "gracias") return "seguimiento";
  if (c.intencion === "otro") return "preguntar";
  return "responder";
}

export const RUTAS = {
  responder: "La asistente contesta con los datos del negocio",
  preguntar: "Falta un dato: la asistente pregunta",
  persona: "Pasa a una persona del equipo",
  seguimiento: "No requiere respuesta: agendar seguimiento",
};
