// Reactivar clientes que no han vuelto: seguimiento diario por segmentos, con tope de frecuencia y bajas.
// clientes: [{ tel, nombre, compras: ["AAAA-MM-DD", …], total?, baja?, ultimoMensaje? }]
// plan({ clientes, hoy, negocio, oferta?, topeDias?, costoMensaje? }) → { grupos: [{ segmento, titulo, clientes: [{ …, mensaje }] }], total, costo }
import { fechaMas } from "./agenda.js";

const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export const SEGMENTOS = [
  { id: "segunda", titulo: "Compraron una vez y no han vuelto (7+ días)",
    mensaje: (c, n, o) => `Hola, ${c}. Gracias por tu primera visita a ${n}. ¿Qué tal te pareció?${o ? ` Te dejamos esto para tu próxima vez: ${o}.` : ""} Si no quieres recibir mensajes, responde BAJA.` },
  { id: "riesgo", titulo: "Clientes frecuentes que ya tardaron más de lo normal",
    mensaje: (c, n, o) => `Hola, ${c}. Te extrañamos en ${n}.${o ? ` ${o[0].toUpperCase() + o.slice(1)}, solo para ti esta semana.` : " ¿Te apartamos lo de siempre?"} Si no quieres recibir mensajes, responde BAJA.` },
  { id: "dormido", titulo: "Sin comprar en 30 a 89 días",
    mensaje: (c, n, o) => `Hola, ${c}. Hace tiempo que no te vemos en ${n}.${o ? ` Esta semana: ${o}.` : " Tenemos cosas nuevas que te pueden gustar."} Si no quieres recibir mensajes, responde BAJA.` },
  { id: "perdido", titulo: "Sin comprar en 90 días o más",
    mensaje: (c, n, o) => `Hola, ${c}. Somos ${n}. Nos encantaría volver a atenderte.${o ? ` Para tu regreso: ${o}.` : ""} Si no quieres recibir mensajes, responde BAJA.` },
];

export function segmento(cliente, hoy) {
  const compras = [...(cliente.compras || [])].sort();
  if (!compras.length) return null;
  const ultima = compras[compras.length - 1], hace = dias(ultima, hoy);
  if (compras.length >= 3) {
    const intervalos = compras.slice(1).map((f, i) => dias(compras[i], f));
    const promedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    if (hace > Math.max(7, promedio * 2) && hace < 90) return "riesgo";
  }
  if (compras.length === 1 && hace >= 7 && hace < 30) return "segunda";
  if (hace >= 30 && hace < 90) return "dormido";
  if (hace >= 90) return "perdido";
  return null;
}

export function plan({ clientes, hoy, negocio, oferta = "", topeDias = 14, costoMensaje = 0.73 }) {
  const grupos = SEGMENTOS.map((s) => ({ segmento: s.id, titulo: s.titulo, clientes: [] }));
  for (const c of clientes) {
    if (c.baja) continue;
    if (c.ultimoMensaje && dias(c.ultimoMensaje, hoy) < topeDias) continue; // no cansar al cliente
    const seg = segmento(c, hoy);
    if (!seg) continue;
    const def = SEGMENTOS.find((s) => s.id === seg);
    const nombre = (c.nombre || "").trim().split(" ")[0] || "hola";
    grupos.find((g) => g.segmento === seg).clientes.push({ ...c, mensaje: def.mensaje(nombre, negocio, oferta.trim()) });
  }
  const total = grupos.reduce((s, g) => s + g.clientes.length, 0);
  return { grupos, total, costo: Math.round(total * costoMensaje * 100) / 100, siguiente: fechaMas(hoy, topeDias) };
}

// "BAJA", "STOP", "ya no me manden"… → el cliente no quiere más mensajes.
export const esBaja = (texto) => /^\s*(baja|stop|alto|cancelar suscripcion|unsubscribe)\s*[.!]*\s*$|ya no (me )?(manden|envien|escriban)/i.test(String(texto || ""));
