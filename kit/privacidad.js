// Generador de aviso de privacidad para negocios (LFPDPPP publicada el 20 de marzo de 2025).
// Es una base: el negocio la revisa y, si trata datos sensibles (salud), conviene que la revise un abogado.

export const DATOS_COMUNES = ["nombre", "teléfono o WhatsApp", "correo electrónico", "dirección de entrega", "datos de facturación (RFC, razón social, código postal, régimen)", "historial de compras o citas"];
export const SENSIBLES = ["estado de salud, padecimientos o tratamientos", "alergias"];

export function generarAviso({ responsable, nombreComercial, domicilio, correo, telefono, datos = [], sensibles = [], finalidades = [], secundarias = [], comparte = [], fecha }) {
  const lista = (xs) => xs.map((x) => `- ${x}`).join("\n");
  const nc = nombreComercial ? `, que opera con el nombre comercial ${nombreComercial},` : "";
  const partes = [
    `AVISO DE PRIVACIDAD INTEGRAL\nÚltima actualización: ${fecha}`,
    `1. Responsable\n${responsable}${nc} con domicilio en ${domicilio}, es responsable del uso y protección de tus datos personales. Contacto: ${correo}${telefono ? ` · ${telefono}` : ""}.`,
    `2. Datos que usamos\n${lista(datos)}${sensibles.length ? `\n\nDatos sensibles (requieren tu consentimiento expreso):\n${lista(sensibles)}` : ""}`,
    `3. Para qué los usamos\nFinalidades necesarias para darte el servicio:\n${lista(finalidades)}${secundarias.length ? `\n\nFinalidades adicionales (puedes negarte sin que afecte el servicio, escribiendo a ${correo}):\n${lista(secundarias)}` : ""}`,
    `4. Con quién los compartimos\n${comparte.length ? lista(comparte) + "\nEstos proveedores tratan tus datos solo para prestarnos su servicio." : "No compartimos tus datos con terceros, salvo que la ley lo exija."}`,
    `5. Tus derechos (ARCO)\nPuedes acceder, rectificar, cancelar u oponerte al uso de tus datos, revocar tu consentimiento o limitar su uso escribiendo a ${correo} con tu nombre, el derecho que quieres ejercer y una identificación. Respondemos en máximo 20 días hábiles.`,
    `6. Cambios\nPublicaremos cualquier cambio a este aviso en nuestros medios de contacto y en nuestra página, con su fecha.`,
    `7. Autoridad\nSi consideras que tus derechos no fueron atendidos, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno.`,
  ];
  return partes.join("\n\n");
}

export function avisoCorto({ responsable, finalidades = [], enlace }) {
  return `${responsable} usará tus datos para ${finalidades.slice(0, 2).join(" y ").toLowerCase() || "atenderte"}. Consulta el aviso de privacidad completo en ${enlace}.`;
}
