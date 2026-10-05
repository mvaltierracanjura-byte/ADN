// Diagnóstico: con 8 respuestas del dueño, estima cuánto se pierde al mes y recomienda por dónde empezar.
// Las estimaciones son conservadoras y usan las cifras publicadas que cita INVESTIGACION.md.
//
// r = { giro, mensajesDia, respondeEn ("minutos"|"horas"|"dia"), citas ("si"|"no"), citasSemana, inasistencia (0-1),
//       ticket, llamadasPerdidasDia, google ("no"|"si_sin_resenas"|"si"), cobro ("efectivo"|"tarjeta"|"transferencia"), factura (bool) }

const PERDIDA_RESPUESTA = { minutos: 0.05, horas: 0.25, dia: 0.5 }; // parte de los que escriben que se va con otro
export function diagnosticar(r) {
  const recs = [];
  const mes = 30;
  const ticket = Math.max(0, +r.ticket || 0);

  // 1. Mensajes que no se contestan a tiempo
  const perdidosChat = (+r.mensajesDia || 0) * (PERDIDA_RESPUESTA[r.respondeEn] ?? 0.25) * 0.3; // 30%: los que sí iban a comprar
  if (perdidosChat * mes * ticket > 0) recs.push({ id: "asistente", base: "A", titulo: "Asistente de WhatsApp que contesta en segundos",
    porque: `Recibes unos ${r.mensajesDia} mensajes al día y contestas en ${r.respondeEn === "minutos" ? "minutos" : r.respondeEn === "horas" ? "horas" : "un día o más"}. Quien no recibe respuesta pronto le escribe a otro.`,
    impacto: perdidosChat * mes * ticket });

  // 2. Citas que no llegan
  if (r.citas === "si" && +r.citasSemana > 0) {
    const perdidaMes = +r.citasSemana * 4.33 * (+r.inasistencia || 0) * ticket;
    recs.push({ id: "agenda", base: "C", titulo: "Agenda con recordatorios por WhatsApp",
      porque: `Con ${Math.round((+r.inasistencia || 0) * 100)}% de citas que no llegan se te van unas ${Math.round(+r.citasSemana * 4.33 * (+r.inasistencia || 0))} citas al mes. Los recordatorios reducen las inasistencias 30–50%.`,
      impacto: perdidaMes * 0.3 });
  }
  // 3. Llamadas perdidas
  if (+r.llamadasPerdidasDia > 0) recs.push({ id: "telefono", base: "A", titulo: "Recepcionista telefónica con IA",
    porque: `Pierdes unas ${r.llamadasPerdidasDia} llamadas al día; la mayoría de quienes caen en buzón llama a otro negocio.`,
    impacto: +r.llamadasPerdidasDia * mes * 0.3 * ticket * 0.6 });
  // 4. Google
  if (r.google !== "si") recs.push({ id: "google", base: "A", titulo: r.google === "no" ? "Perfil de Google y aparecer en las respuestas de la IA" : "Reseñas de Google: pedirlas y contestarlas",
    porque: r.google === "no" ? "Si no estás en Google, no existes para quien busca “cerca de mí” ni para ChatGPT o Gemini." : "Con pocas reseñas o sin contestarlas, Google y la gente prefieren a la competencia.",
    impacto: ticket * (r.google === "no" ? 20 : 8) });
  // 5. Cobro
  if (r.cobro === "tarjeta") recs.push({ id: "cobro", base: "T", titulo: "Cobro por transferencia sin comisión",
    porque: "Cada pago con terminal te cuesta alrededor de 3% más IVA. Por transferencia (SPEI o DiMo) no hay comisión.",
    impacto: ticket * (+r.mensajesDia || 10) * mes * 0.2 * 0.035 });
  if (r.cobro === "efectivo") recs.push({ id: "cobro", base: "T", titulo: "Cobro en línea (transferencia o liga de pago)",
    porque: "Solo efectivo te cierra la puerta a pedidos a domicilio y a clientes que ya no traen efectivo.",
    impacto: ticket * 15 });
  // 6. Factura
  if (r.factura) recs.push({ id: "factura", base: "T", titulo: "Autofactura", porque: "Si capturas facturas a mano, el cliente puede hacerlo solo con su folio.", impacto: 0, ahorroHoras: 6 });
  // 7. Reactivar (siempre aplica si hay clientes)
  recs.push({ id: "reactivar", base: "G", titulo: "Reactivar clientes que no han vuelto",
    porque: "Venderle otra vez a quien ya te compró cuesta mucho menos que conseguir uno nuevo.", impacto: ticket * 10 });

  recs.sort((a, b) => b.impacto - a.impacto);
  const total = recs.reduce((s, x) => s + x.impacto, 0);
  return { recomendaciones: recs, primero: recs[0], perdidaMensual: Math.round(total / 10) * 10 };
}

export function resumenWhatsApp(r, d, negocio) {
  const p = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
  return `Hola, ADN. Hice el diagnóstico${negocio ? ` para ${negocio}` : ""} (${r.giroNombre || r.giro}). ` +
    `Me salen unos ${p(d.perdidaMensual)} al mes en oportunidades. Lo primero que me recomienda: ${d.primero.titulo}. ¿Platicamos?`;
}
