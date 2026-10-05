// Autofactura CFDI 4.0: validar los datos fiscales del cliente antes de timbrar.
// Los datos deben coincidir EXACTAMENTE con la Constancia de Situación Fiscal (nombre, CP y régimen).

const VAL = "0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ";
export const GENERICOS = { XAXX010101000: "Público en general", XEXX010101000: "Residente en el extranjero" };

export function digitoRFC(rfcSinDigito) {
  const s = rfcSinDigito.length === 11 ? " " + rfcSinDigito : rfcSinDigito; // 12 caracteres
  let suma = 0;
  for (let i = 0; i < 12; i++) suma += VAL.indexOf(s[i]) * (13 - i);
  const dv = 11 - (suma % 11);
  return dv === 11 ? "0" : dv === 10 ? "A" : String(dv);
}

export function validarRFC(rfc) {
  const r = String(rfc || "").toUpperCase().replace(/[\s-]/g, "");
  if (GENERICOS[r]) return { ok: true, rfc: r, tipo: r === "XAXX010101000" ? "generico" : "extranjero" };
  const m = r.match(/^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z\d]{2})([A\d])$/);
  if (!m) return { ok: false, error: "El RFC tiene 12 caracteres (empresa) o 13 (persona física)." };
  const mes = +m[3], dia = +m[4];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return { ok: false, error: "La fecha dentro del RFC no es válida." };
  if (digitoRFC(r.slice(0, -1)) !== r.slice(-1)) return { ok: false, error: "El RFC no es válido: revisa la homoclave." };
  return { ok: true, rfc: r, tipo: m[1].length === 3 ? "moral" : "fisica" };
}

// c_RegimenFiscal (CFDI 4.0): [clave, descripción, física, moral]
export const REGIMENES = [
  ["601", "General de Ley Personas Morales", false, true], ["603", "Personas Morales con Fines no Lucrativos", false, true],
  ["605", "Sueldos y Salarios e Ingresos Asimilados a Salarios", true, false], ["606", "Arrendamiento", true, false],
  ["607", "Régimen de Enajenación o Adquisición de Bienes", true, false], ["608", "Demás ingresos", true, false],
  ["610", "Residentes en el Extranjero sin Establecimiento Permanente en México", true, true], ["611", "Ingresos por Dividendos (socios y accionistas)", true, false],
  ["612", "Personas Físicas con Actividades Empresariales y Profesionales", true, false], ["614", "Ingresos por intereses", true, false],
  ["615", "Régimen de los ingresos por obtención de premios", true, false], ["616", "Sin obligaciones fiscales", true, false],
  ["620", "Sociedades Cooperativas de Producción que optan por diferir sus ingresos", false, true], ["621", "Incorporación Fiscal", true, false],
  ["622", "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras", false, true], ["623", "Opcional para Grupos de Sociedades", false, true],
  ["624", "Coordinados", false, true], ["625", "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas", true, false],
  ["626", "Régimen Simplificado de Confianza", true, true],
];
// c_UsoCFDI más comunes en negocios locales: [clave, descripción, física, moral]
export const USOS = [
  ["G01", "Adquisición de mercancías", true, true], ["G03", "Gastos en general", true, true],
  ["D01", "Honorarios médicos, dentales y gastos hospitalarios", true, false], ["D02", "Gastos médicos por incapacidad o discapacidad", true, false],
  ["D10", "Pagos por servicios educativos (colegiaturas)", true, false], ["S01", "Sin efectos fiscales", true, true], ["CP01", "Pagos", true, true],
];
const aplica = (fila, tipo) => (tipo === "moral" ? fila[3] : fila[2]);
export const regimenesPara = (tipo) => REGIMENES.filter((r) => aplica(r, tipo));
export const usosPara = (tipo) => USOS.filter((u) => aplica(u, tipo));

// CFDI 4.0: el nombre va como en la constancia, en mayúsculas y SIN el régimen societario.
export function nombreFiscal(nombre) {
  return String(nombre || "").toUpperCase().normalize("NFC").replace(/[,.]?\s+(S\.?\s?A\.?\s?P\.?\s?I\.?|S\.?\s?A\.?|S\.?\s?DE\s?R\.?\s?L\.?|S\.?\s?C\.?|A\.?\s?C\.?|S\.?\s?A\.?\s?S\.?)(\s+DE\s+C\.?\s?V\.?)?\.?\s*$/, "").replace(/\s+/g, " ").trim();
}

// Revisa todo junto: devuelve { ok, errores: { campo: mensaje }, datos }
export function validarReceptor({ rfc, nombre, cp, regimen, uso }) {
  const errores = {};
  const v = validarRFC(rfc);
  if (!v.ok) errores.rfc = v.error;
  const tipo = v.ok ? (v.tipo === "generico" || v.tipo === "extranjero" ? "fisica" : v.tipo) : null;
  const nom = nombreFiscal(nombre);
  if (!nom) errores.nombre = "Escribe el nombre como aparece en tu constancia.";
  if (!/^\d{5}$/.test(String(cp || ""))) errores.cp = "El código postal tiene 5 dígitos (el de tu constancia).";
  if (v.ok && v.tipo === "generico") {
    if (regimen !== "616") errores.regimen = "Para público en general el régimen es 616.";
    if (uso !== "S01") errores.uso = "Para público en general el uso es S01.";
  } else if (tipo) {
    if (!regimenesPara(tipo).some((r) => r[0] === regimen)) errores.regimen = `Ese régimen no aplica a ${tipo === "moral" ? "empresas" : "personas físicas"}.`;
    if (!usosPara(tipo).some((u) => u[0] === uso)) errores.uso = `Ese uso no aplica a ${tipo === "moral" ? "empresas" : "personas físicas"}.`;
  }
  return { ok: !Object.keys(errores).length, errores, datos: { rfc: v.rfc, nombre: nom, cp: String(cp || ""), regimen, uso, tipo } };
}

// ¿Todavía se puede facturar este ticket? Por defecto, dentro del mes de la compra (+ días de gracia).
export function enPlazo(fechaCompra, hoy, diasGracia = 3) {
  const [a, m] = fechaCompra.split("-").map(Number);
  const limite = new Date(Date.UTC(a, m, 1 + diasGracia)); // día 1 del mes siguiente + gracia
  return Date.parse(hoy) < limite.getTime();
}

const r2 = (n) => Math.round(n * 100) / 100;
// Solicitud para Facturama (API REST CFDI 4.0). Precios con IVA incluido, como en el mostrador.
// items: [{ descripcion, cantidad, precio (con IVA), clave? (c_ClaveProdServ), unidad? (c_ClaveUnidad) }]
export function solicitudFacturama({ receptor, items, emisor, formaPago = "03", serie = "A", folio }) {
  return {
    Serie: serie, Folio: folio != null ? String(folio) : undefined, Currency: "MXN", CfdiType: "I", PaymentMethod: "PUE",
    PaymentForm: formaPago, ExpeditionPlace: emisor.cp,
    Receiver: { Rfc: receptor.rfc, Name: receptor.nombre, CfdiUse: receptor.uso, FiscalRegime: receptor.regimen, TaxZipCode: receptor.cp },
    Items: items.map((it) => {
      const total = r2(it.precio * it.cantidad), base = r2(total / 1.16), iva = r2(total - base);
      return {
        ProductCode: it.clave || emisor.claveProducto || "01010101", Description: it.descripcion, Unit: it.unidadNombre || "Pieza",
        UnitCode: it.unidad || "H87", Quantity: it.cantidad, UnitPrice: r2(base / it.cantidad), Subtotal: base, TaxObject: "02",
        Taxes: [{ Name: "IVA", Rate: 0.16, Base: base, Total: iva, IsRetention: false }], Total: total,
      };
    }),
  };
}
// Formas de pago SAT más usadas
export const FORMAS_PAGO = { "01": "Efectivo", "03": "Transferencia", "04": "Tarjeta de crédito", "28": "Tarjeta de débito" };
