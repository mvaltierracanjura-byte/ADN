// Reseñas de Google: pedirlas a todos (Google prohíbe pedirlas solo a los contentos y ofrecer algo a cambio)
// y contestar cada una. Los negocios que contestan al menos 1 de cada 4 reseñas ganan 35% más (Womply, 200 mil negocios).

export const enlaceResena = (placeId) => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(String(placeId || "").trim())}`;
export const placeIdValido = (p) => /^[A-Za-z0-9_-]{20,}$/.test(String(p || "").trim());

// Cuándo pedirla: cuando la experiencia está fresca.
export const MOMENTO = {
  restaurante: { horas: 2, texto: "2 horas después de entregar el pedido" },
  cita: { horas: 3, texto: "3 horas después de la cita" },
  hospedaje: { horas: 24, texto: "al día siguiente del check-out" },
  servicio: { horas: 24, texto: "un día después de terminar el trabajo" },
};

export function invitacion({ nombre, negocio, enlace, idioma = "es" }) {
  const n = (nombre || "").trim().split(" ")[0];
  return idioma === "en"
    ? `Hi${n ? ` ${n}` : ""}! Thanks for choosing ${negocio}. Would you take 30 seconds to tell others about your experience? It helps us a lot: ${enlace}`
    : `¡Hola${n ? `, ${n}` : ""}! Gracias por elegir ${negocio}. ¿Nos regalas 30 segundos para contar cómo te fue? Nos ayuda muchísimo: ${enlace}`;
}

// Borrador de respuesta según estrellas. El dueño lo revisa antes de publicar.
export function borrador({ estrellas, nombre, negocio, contacto = "", idioma = "es" }) {
  const n = (nombre || "").trim().split(" ")[0];
  const hola = idioma === "en" ? `Hi ${n || "there"},` : `Hola${n ? `, ${n}` : ""}.`;
  if (idioma === "en") {
    if (estrellas >= 4) return `${hola} thank you so much for your review! We're really glad you enjoyed it, and we hope to see you again soon at ${negocio}.`;
    if (estrellas === 3) return `${hola} thanks for your honest feedback. We'd love to know what we could do better${contacto ? ` — write to us at ${contacto}` : ""}. We hope to give you a 5-star visit next time.`;
    return `${hola} we're sorry your experience wasn't what you expected. We want to make it right${contacto ? `: please write to us at ${contacto} so we can help you directly` : ""}. Thank you for letting us know.`;
  }
  if (estrellas >= 4) return `${hola} ¡Muchas gracias por tu reseña! Nos da mucho gusto que te haya gustado. Te esperamos pronto en ${negocio}.`;
  if (estrellas === 3) return `${hola} Gracias por tu opinión sincera. Nos encantaría saber qué podemos mejorar${contacto ? `: escríbenos al ${contacto}` : ""}. Queremos que tu próxima visita sea de 5 estrellas.`;
  return `${hola} Lamentamos mucho que tu experiencia no fuera la que esperabas. Queremos arreglarlo${contacto ? `: escríbenos al ${contacto} y lo vemos directamente contigo` : ""}. Gracias por decírnoslo.`;
}

// resenas: [{ estrellas, fecha, respondida: boolean }]
export function metricas(resenas) {
  const n = resenas.length;
  if (!n) return { total: 0, promedio: null, respondidas: null, sinResponderNegativas: 0 };
  return {
    total: n,
    promedio: Math.round((resenas.reduce((s, r) => s + r.estrellas, 0) / n) * 10) / 10,
    respondidas: resenas.filter((r) => r.respondida).length / n,
    sinResponderNegativas: resenas.filter((r) => !r.respondida && r.estrellas <= 3).length,
  };
}
