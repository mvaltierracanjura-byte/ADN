// ¿El cliente escribe en inglés o en español? Heurística rápida para elegir idioma de plantillas,
// de la voz del teléfono y de la demo. El asistente con IA contesta en el idioma del cliente por sí solo;
// esto es para lo que no pasa por el modelo.
const EN = new Set(("hi hello hey thanks thank you please what when where how much do does is are can could would " +
  "i i'm im my we you your the a an to for of open close closed today tomorrow price prices menu order want need " +
  "book booking appointment reservation available have any english service never again great good bad very was were " +
  "food place staff nice amazing awful terrible love loved best worst friendly slow fast and but not with this that it").split(" "));
const ES = new Set(("hola buenas gracias por favor que qué cuando cuándo donde dónde cuanto cuánto cuesta precio precios " +
  "quiero quisiera necesito tienen hay abren cierran hoy mañana cita reservar pedido para de el la los las un una y " +
  "con sin me mi es son está estan están puedo pueden servicio nunca muy bueno buena malo mala excelente comida lugar " +
  "atencion atención rico rica pésimo pesimo lento rapido rápido amable mejor peor pero no este esta").split(" "));

export function detectarIdioma(texto, porDefecto = "es") {
  const t = String(texto || "").toLowerCase();
  if (/[ñ¿¡áéíóú]/.test(t)) return "es";
  const palabras = t.replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean);
  let en = 0, es = 0;
  for (const p of palabras) { if (EN.has(p)) en++; if (ES.has(p)) es++; }
  if (en === es) return porDefecto;
  return en > es ? "en" : "es";
}
