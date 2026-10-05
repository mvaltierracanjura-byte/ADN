// Calendario de contenido para redes: un mes de ideas con los productos reales del negocio y las fechas
// que importan en México (y en Mazatlán). Los textos finales los afina la IA (servidor/contenido.js) o el dueño.
import { fechaMas, diaSemana } from "./agenda.js";

// Domingo de Pascua (algoritmo gregoriano anónimo)
export function pascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
const nDomingo = (anio, mes, n) => { let f = `${anio}-${String(mes).padStart(2, "0")}-01`; while (diaSemana(f) !== 0) f = fechaMas(f, 1); return fechaMas(f, 7 * (n - 1)); };

export function fechasEspeciales(anio) {
  const p = pascua(anio), d = (m, dd) => `${anio}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return [
    [d(1, 6), "Día de Reyes"], [d(2, 2), "Día de la Candelaria"], [d(2, 14), "Día del Amor y la Amistad"],
    [fechaMas(p, -52), "Inicia el Carnaval de Mazatlán"], [fechaMas(p, -47), "Martes de Carnaval"],
    [d(3, 8), "Día Internacional de la Mujer"], [d(3, 21), "Inicio de la primavera"], [fechaMas(p, -7), "Domingo de Ramos: inicia Semana Santa"],
    [d(4, 30), "Día del Niño"], [d(5, 10), "Día de las Madres"], [d(5, 15), "Día del Maestro"], [nDomingo(anio, 6, 3), "Día del Padre"],
    [d(7, 15), "Vacaciones de verano"], [d(9, 15), "Noche Mexicana"], [d(10, 1), "Día Internacional del Café"],
    [d(11, 1), "Día de Muertos"], [d(12, 12), "Día de la Virgen de Guadalupe"], [d(12, 24), "Nochebuena"], [d(12, 31), "Fin de año"],
  ].sort((a, b) => a[0].localeCompare(b[0]));
}

const TIPOS = [
  { tipo: "Producto estrella", formato: "Reel", idea: (p) => `Muestra cómo se prepara ${p} en 15 segundos, de cerca y con sonido real.` },
  { tipo: "Detrás de cámaras", formato: "Historia", idea: () => "El equipo abriendo el local: quién llega primero y qué es lo primero que preparan." },
  { tipo: "Cliente", formato: "Foto", idea: () => "Comparte (con permiso) la foto o reseña de un cliente y dale las gracias por nombre." },
  { tipo: "Producto estrella", formato: "Carrusel", idea: (p) => `${p}: 3 fotos — cómo se ve, de qué está hecho y con qué combina.` },
  { tipo: "Útil", formato: "Carrusel", idea: () => "Una pregunta que te hacen seguido por WhatsApp, contestada en 3 láminas." },
  { tipo: "Encuesta", formato: "Historia", idea: (p, q) => `Encuesta: ¿${p} o ${q}? Usa el resultado para el especial del fin de semana.` },
];

// productos: ["Latte", "Frappé", …]  diasPublicar: [1, 3, 5] (lun, mié, vie)
export function calendario({ anio, mes, productos, negocio, diasPublicar = [1, 3, 5] }) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const especiales = new Map(fechasEspeciales(anio).filter(([f]) => f.startsWith(inicio.slice(0, 7))));
  const posts = [];
  let i = 0, j = 0; // i: tipo de publicación; j: producto destacado
  for (let f = inicio; f.slice(0, 7) === inicio.slice(0, 7); f = fechaMas(f, 1)) {
    const esp = especiales.get(f);
    if (esp) {
      posts.push({ fecha: f, tipo: "Fecha especial", formato: "Reel", idea: `${esp}: ¿qué tiene ${negocio} para celebrarlo? Muestra el producto que mejor combina con la fecha.`, especial: esp });
      continue;
    }
    if (!diasPublicar.includes(diaSemana(f))) continue;
    const t = TIPOS[i % TIPOS.length];
    const k = j + Math.floor(i / TIPOS.length); // se recorre un lugar en cada ciclo para no repetir combinaciones
    const p = productos[k % productos.length], q = productos[(k + 1) % productos.length];
    posts.push({ fecha: f, tipo: t.tipo, formato: t.formato, idea: t.idea(p, q) });
    if (t.idea.length > 0) j++;
    i++;
  }
  return posts;
}

export const HASHTAGS = (ciudad = "Mazatlán") => [`#${ciudad.replace(/\s/g, "")}`, `#${ciudad.replace(/\s/g, "")}Sinaloa`, "#HechoEnMéxico", "#ApoyaLoLocal"];
