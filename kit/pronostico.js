// ¿Cuánto preparar mañana? Pronóstico simple y explicable por producto:
//   base = promedio ponderado del mismo día de la semana (últimas 6 semanas, más peso a las recientes)
//   × tendencia (últimos 14 días contra los 14 anteriores, acotada)  × ajustes (lluvia, calor, evento)
//   preparar = redondear hacia arriba(base × (1 + colchón))
// ventas: [{ fecha: "AAAA-MM-DD", producto, cantidad }]  (un renglón por producto y día; los días sin venta cuentan 0)
import { fechaMas, diaSemana } from "./agenda.js";

const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const cuantil = (xs, q) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const a = Math.floor(i); return s[a] + (s[Math.ceil(i)] - s[a]) * (i - a); };

export function porProducto(ventas) {
  const m = new Map();
  for (const v of ventas) {
    if (!m.has(v.producto)) m.set(v.producto, new Map());
    const d = m.get(v.producto);
    d.set(v.fecha, (d.get(v.fecha) || 0) + (+v.cantidad || 0));
  }
  return m;
}

// Días con historial: del primer al último día con cualquier venta (para contar ceros reales).
function rango(ventas) {
  const fechas = ventas.map((v) => v.fecha).sort();
  return { desde: fechas[0], hasta: fechas[fechas.length - 1] };
}

export function pronosticar({ ventas, fecha, semanas = 6, ajustes = {}, reglas = {}, colchon = 0.1, cerrados = [] }) {
  const { desde, hasta } = rango(ventas);
  const datos = porProducto(ventas);
  const dow = diaSemana(fecha);
  const salida = [];
  for (const [producto, dias] of datos) {
    const q = (f) => (f < desde || f > hasta || cerrados.includes(diaSemana(f)) ? null : dias.get(f) || 0);
    // Mismo día de la semana hacia atrás
    const mismos = [];
    for (let k = 1; mismos.length < semanas && k <= semanas * 2; k++) {
      const f = fechaMas(fecha, -7 * k);
      if (f < desde) break;
      const v = q(f);
      if (v != null) mismos.push(v);
    }
    let base;
    if (mismos.length >= 2) {
      const pesos = mismos.map((_, i) => mismos.length - i); // la más reciente pesa más
      base = mismos.reduce((a, v, i) => a + v * pesos[i], 0) / pesos.reduce((a, b) => a + b, 0);
    } else {
      const todos = [...dias.values()];
      base = prom(todos);
    }
    // Tendencia: últimos 14 días contra los 14 anteriores, acotada a ±25%
    const ventana = (ini, fin) => { const xs = []; for (let i = ini; i < fin; i++) { const v = q(fechaMas(hasta, -i)); if (v != null) xs.push(v); } return prom(xs); };
    const reciente = ventana(0, 14), anterior = ventana(14, 28);
    const tendencia = anterior > 0 ? Math.min(1.25, Math.max(0.8, reciente / anterior)) : 1;
    // Ajustes del día (configurables por producto): p. ej. { lluvia: 0.85, calor: { "Frappé": 1.3 } }
    let factor = 1;
    for (const [clave, activo] of Object.entries(ajustes)) {
      if (!activo) continue;
      const r = reglas[clave];
      const f = typeof r === "number" ? r : r && (r[producto] ?? r["*"]);
      if (f) factor *= f;
    }
    const estimado = base * tendencia * factor;
    const col = typeof colchon === "number" ? colchon : (colchon[producto] ?? colchon["*"] ?? 0.1);
    salida.push({
      producto, estimado: Math.round(estimado * 10) / 10,
      bajo: Math.round(cuantil(mismos, 0.2) * tendencia * factor), alto: Math.round(cuantil(mismos, 0.8) * tendencia * factor),
      preparar: estimado > 0 ? Math.ceil(Math.round(estimado * (1 + col) * 1000) / 1000) : 0, tendencia: Math.round(tendencia * 100) / 100, historial: mismos.length,
      diaSemana: dow,
    });
  }
  return salida.sort((a, b) => b.estimado - a.estimado);
}

// Prueba honesta: ¿pronosticar le gana a "lo mismo que el mismo día de la semana pasada"?
// Error porcentual medio (MAPE ponderado por volumen) en los últimos `dias` días.
export function evaluar({ ventas, dias = 14, ...op }) {
  const { hasta } = rango(ventas);
  const datos = porProducto(ventas);
  let errM = 0, errS = 0, total = 0;
  for (let i = dias - 1; i >= 0; i--) {
    const f = fechaMas(hasta, -i);
    const previas = ventas.filter((v) => v.fecha < f);
    if (!previas.length) continue;
    const pron = pronosticar({ ventas: previas, fecha: f, ...op });
    for (const p of pron) {
      const real = datos.get(p.producto)?.get(f) || 0;
      const semana = datos.get(p.producto)?.get(fechaMas(f, -7)) || 0;
      errM += Math.abs(p.estimado - real); errS += Math.abs(semana - real); total += real;
    }
  }
  if (!total) return null;
  return { error: errM / total, errorIngenuo: errS / total, mejora: errS ? 1 - errM / errS : 0 };
}

export function leerVentas(csv) {
  const filas = String(csv).trim().split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, "")));
  if (filas.length < 2) return [];
  const cab = filas[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const iF = cab.findIndex((h) => h.includes("fecha")), iP = cab.findIndex((h) => h.includes("producto")), iC = cab.findIndex((h) => h.includes("cantidad") || h.includes("piezas") || h.includes("vendid"));
  if (iF < 0 || iP < 0 || iC < 0) throw new Error("El archivo necesita columnas fecha, producto y cantidad.");
  return filas.slice(1).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f[iF])).map((f) => ({ fecha: f[iF], producto: f[iP], cantidad: +f[iC] || 0 }));
}

// Datos de ejemplo reproducibles (cafetería): patrón por día de la semana + ruido.
export function ventasEjemplo(hasta, semanas = 10) {
  let s = 42; const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const productos = { Latte: [30, 22, 24, 25, 28, 40, 45], "Frappé": [25, 15, 16, 18, 20, 32, 38], "Galleta rellena": [40, 28, 30, 30, 35, 55, 60], "Matcha latte": [14, 9, 10, 10, 12, 18, 20] };
  const out = [];
  for (let i = semanas * 7 - 1; i >= 0; i--) {
    const f = fechaMas(hasta, -i), d = diaSemana(f), crec = 1 + (semanas * 7 - i) * 0.002;
    for (const [p, patron] of Object.entries(productos)) out.push({ fecha: f, producto: p, cantidad: Math.max(0, Math.round(patron[d] * crec * (0.85 + azar() * 0.3))) });
  }
  return out;
}
