// Redactar los textos (captions) del calendario con IA, en el tono del negocio, sin inventar precios ni promociones.
//   redactarTextos({ anthropic, negocio: { nombre, giro, tono, conocimiento }, posts, modelo? }) → [{ fecha, texto }]
import { MODELO_POR_DEFECTO } from "./asistente.js";

const ESQUEMA = {
  type: "object",
  properties: { textos: { type: "array", items: { type: "object", properties: { fecha: { type: "string" }, texto: { type: "string" } }, required: ["fecha", "texto"], additionalProperties: false } } },
  required: ["textos"], additionalProperties: false,
};

export async function redactarTextos({ anthropic, negocio, posts, modelo = MODELO_POR_DEFECTO }) {
  const r = await anthropic.messages.create({
    model: modelo,
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    system: `Escribes los textos de publicaciones de Instagram y Facebook para ${negocio.nombre}${negocio.giro ? ` (${negocio.giro})` : ""}.
- Español de México, ${negocio.tono || "cálido y cercano"}. 2 a 4 frases, una llamada a la acción y 3 a 5 hashtags al final.
- Solo usa precios, productos y promociones que aparezcan en el conocimiento del negocio. Si no hay, no los menciones.
- No prometas resultados de salud ni uses afirmaciones que no se puedan comprobar.
Conocimiento del negocio:
${negocio.conocimiento || "(sin datos adicionales)"}`,
    messages: [{ role: "user", content: "Escribe un texto para cada publicación:\n" + posts.map((p) => `- ${p.fecha} · ${p.formato} · ${p.tipo}: ${p.idea}`).join("\n") }],
  });
  if (r.stop_reason !== "end_turn") throw new Error("No se pudieron redactar los textos.");
  return JSON.parse(r.content.filter((b) => b.type === "text").map((b) => b.text).join("")).textos;
}
