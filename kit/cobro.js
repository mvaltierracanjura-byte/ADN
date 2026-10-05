// Cobro por transferencia (SPEI) o DiMo, sin comisión de tarjeta. El cliente paga desde la app de su banco
// con la CLABE (o el celular, si el negocio tiene DiMo) y el concepto o referencia del cobro.
// CoDi con QR lo emite el banco del negocio: se conecta cuando el banco lo ofrezca.

const PESOS = [3, 7, 1];
export function digitoClabe(diecisiete) {
  const s = [...diecisiete].reduce((a, d, i) => a + ((+d * PESOS[i % 3]) % 10), 0);
  return (10 - (s % 10)) % 10;
}
export function validarClabe(clabe) {
  const c = String(clabe || "").replace(/\D/g, "");
  if (c.length !== 18) return { ok: false, error: "La CLABE tiene 18 dígitos." };
  if (digitoClabe(c.slice(0, 17)) !== +c[17]) return { ok: false, error: "La CLABE no es válida: revisa los dígitos." };
  return { ok: true, clabe: c, banco: bancoDeClabe(c) };
}
const BANCOS = { "002": "Banamex", "012": "BBVA México", "014": "Santander", "021": "HSBC", "030": "BanBajío", "036": "Inbursa", "044": "Scotiabank",
  "058": "Banregio", "072": "Banorte", "127": "Banco Azteca", "137": "BanCoppel", "638": "Nu México", "646": "STP", "722": "Mercado Pago" };
export const bancoDeClabe = (c) => BANCOS[String(c).slice(0, 3)] || "Otro banco";
export const formatoClabe = (c) => String(c).replace(/(\d{3})(\d{3})(\d{11})(\d)/, "$1 $2 $3 $4");

// Referencia numérica SPEI (hasta 7 dígitos) a partir de un consecutivo; el último dígito es verificador
// para que un error al teclear no confunda dos cobros.
export function referencia(consecutivo) {
  const base = String(Math.abs(Math.trunc(consecutivo)) % 1000000).padStart(6, "0");
  const dv = [...base].reduce((a, d, i) => a + +d * (i % 2 ? 1 : 2), 0) % 10;
  return base + dv;
}
export const referenciaValida = (r) => /^\d{7}$/.test(r) && referencia(+r.slice(0, 6)) === r;

// Concepto SPEI: máximo 40 caracteres, sin acentos ni símbolos raros.
export const concepto = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

export function mensajeCobro({ negocio, beneficiario, clabe, monto, conc, ref, enlace, dimo = "" }) {
  const m = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto);
  return `Hola, te comparto los datos para pagar ${m} a ${negocio}:\n` +
    `• CLABE: ${formatoClabe(clabe)} (${bancoDeClabe(clabe)})\n• Beneficiario: ${beneficiario}\n` +
    `• Concepto: ${conc}\n• Referencia: ${ref}\n` + (dimo ? `• O por DiMo al celular: ${dimo}\n` : "") +
    (enlace ? `\nAquí puedes copiar los datos y avisarnos cuando pagues: ${enlace}` : "");
}

// Conciliar: cruzar movimientos del banco con los cobros pendientes por referencia (o concepto) y monto exacto.
// movimientos: [{ fecha, monto, referencia?, concepto? }]  cobros: [{ id, monto, ref, conc }]
export function conciliar(movimientos, cobros) {
  const pagados = [], sinCobro = [], usados = new Set();
  for (const mov of movimientos) {
    const monto = Math.round(+mov.monto * 100);
    const c = cobros.find((x) => !usados.has(x.id) && Math.round(x.monto * 100) === monto &&
      ((mov.referencia && String(mov.referencia).padStart(7, "0") === x.ref) || (mov.concepto && concepto(mov.concepto).toUpperCase().includes(x.ref))));
    if (c) { usados.add(c.id); pagados.push({ cobro: c.id, fecha: mov.fecha, monto: mov.monto }); }
    else sinCobro.push(mov);
  }
  return { pagados, sinCobro, pendientes: cobros.filter((c) => !usados.has(c.id)) };
}

// Estado de cuenta en CSV: busca columnas de fecha, monto/abono, referencia y concepto/descripción.
export function leerMovimientos(csv) {
  const filas = String(csv).trim().split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, "")));
  if (filas.length < 2) return [];
  const cab = filas[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const col = (...nombres) => cab.findIndex((h) => nombres.some((n) => h.includes(n)));
  const iF = col("fecha"), iM = col("abono", "deposito", "monto", "importe"), iR = col("referencia", "ref"), iC = col("concepto", "descripcion");
  return filas.slice(1).filter((f) => f.length > 1).map((f) => ({
    fecha: f[iF] || "", monto: parseFloat(String(f[iM] || "0").replace(/[$\s,]/g, "")) || 0,
    referencia: iR >= 0 ? f[iR] : "", concepto: iC >= 0 ? f[iC] : "",
  })).filter((m) => m.monto > 0);
}
