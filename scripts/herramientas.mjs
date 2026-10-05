// Arma herramientas/<archivo>.html = src/_cabeza.html + src/<archivo>.html + src/_pie.html.
// Correr después de editar algo en herramientas/src/:  node scripts/herramientas.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, "herramientas");
export const PAGINAS = [
  { archivo: "bandeja.html", js: "bandeja.js", titulo: "Bandeja inteligente", titulo_min: "la bandeja inteligente",
    desc: "Clasifica cada mensaje (queja, pedido, cita, precio…), decide si contesta la IA o una persona, y reactiva a los clientes que no han vuelto." },
  { archivo: "resenas.html", js: "resenas.js", titulo: "Reseñas de Google", titulo_min: "las reseñas de Google",
    desc: "Pide reseña en el momento justo con tu enlace de Google y prepara respuestas para cada reseña." },
  { archivo: "cobro.html", js: "cobro.js", titulo: "Cobro por transferencia", titulo_min: "el cobro por transferencia",
    desc: "Crea ligas de cobro por SPEI o CoDi sin comisión de tarjeta, con referencia para identificar cada pago." },
  { archivo: "factura.html", js: "factura.js", titulo: "Autofactura", titulo_min: "la autofactura",
    desc: "Tu cliente se factura solo: valida RFC, régimen fiscal, código postal y uso de CFDI antes de timbrar." },
  { archivo: "pronostico.html", js: "pronostico.js", titulo: "Cuánto preparar mañana", titulo_min: "el pronóstico de producción",
    desc: "Calcula cuánto preparar de cada producto según tus ventas por día de la semana, la tendencia y el clima." },
  { archivo: "contenido.html", js: "contenido.js", titulo: "Calendario de contenido", titulo_min: "el calendario de contenido",
    desc: "Un mes de publicaciones para Instagram y Facebook con tus productos y las fechas que importan en México." },
  { archivo: "google.html", js: "google.js", titulo: "Aparece en Google y en la IA", titulo_min: "la herramienta de Google",
    desc: "Revisa qué le falta a tu negocio para que Google, ChatGPT y Gemini lo recomienden, y genera tus datos estructurados." },
  { archivo: "aviso.html", js: "aviso.js", titulo: "Aviso de privacidad", titulo_min: "el generador de aviso de privacidad",
    desc: "Genera el aviso de privacidad de tu negocio según la ley de datos personales de 2025." },
  { archivo: "diagnostico.html", js: "diagnostico.js", titulo: "Diagnóstico de tu negocio", titulo_min: "el diagnóstico",
    desc: "Contesta 8 preguntas y te decimos por dónde empezar, con números de tu propio negocio." },
];
const cabeza = readFileSync(join(dir, "src/_cabeza.html"), "utf8"), pie = readFileSync(join(dir, "src/_pie.html"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
let n = 0;
for (const p of PAGINAS) {
  let cuerpo;
  try { cuerpo = readFileSync(join(dir, "src", p.archivo), "utf8"); } catch { continue; }
  const llenar = (t) => t.replaceAll("{{TITULO}}", esc(p.titulo)).replaceAll("{{TITULO_MIN}}", esc(p.titulo_min)).replaceAll("{{DESC}}", esc(p.desc))
    .replaceAll("{{ARCHIVO}}", p.archivo).replaceAll("{{JS}}", p.js);
  writeFileSync(join(dir, p.archivo), llenar(cabeza).replace("<head>", "<head>\n<!-- Generado por scripts/herramientas.mjs. Edita herramientas/src/. -->") + cuerpo + llenar(pie));
  n++;
}
console.log(`${n} herramientas armadas.`);
