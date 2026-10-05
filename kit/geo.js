// Aparecer en Google y en las respuestas de la IA (ChatGPT, Gemini, Google AI Overviews).
// Las IA recomiendan negocios con perfil de Google completo, reseñas, datos estructurados y páginas que
// contestan preguntas concretas en texto (no en imágenes).

export const PUNTOS = [
  { id: "perfil", peso: 15, texto: "Perfil de Google Business reclamado y verificado", como: "Reclámalo en business.google.com y verifícalo." },
  { id: "categoria", peso: 6, texto: "Categoría principal y secundarias correctas", como: "Elige la categoría más específica (p. ej. “Cafetería”, no “Restaurante”)." },
  { id: "horario", peso: 8, texto: "Horario al día (incluidos días festivos)", como: "Actualízalo cada vez que cambie y marca los horarios especiales." },
  { id: "fotos", peso: 7, texto: "Más de 10 fotos reales (fachada, interior, productos)", como: "Los perfiles con buenas fotos reciben más solicitudes de ruta y clics." },
  { id: "resenas", peso: 12, texto: "20 reseñas o más", como: "Pide reseña a todos tus clientes con un enlace directo." },
  { id: "responde", peso: 10, texto: "Contestas tus reseñas", como: "Contesta al menos 1 de cada 4, sobre todo las negativas." },
  { id: "sitio", peso: 8, texto: "Página web propia con nombre, dirección y teléfono iguales que en Google", como: "Que los datos coincidan letra por letra en todas partes." },
  { id: "datos", peso: 8, texto: "Datos estructurados (JSON-LD) en tu página", como: "Pégale el código que genera esta herramienta." },
  { id: "texto", peso: 8, texto: "Menú, servicios y precios en texto (no solo en foto)", como: "La IA no lee bien las fotos de menús: pon la lista en texto." },
  { id: "preguntas", peso: 8, texto: "Página de preguntas frecuentes", como: "Contesta en texto lo que más te preguntan: estacionamiento, pagos, envíos, horarios." },
  { id: "directorios", peso: 5, texto: "En directorios y mapas (TripAdvisor, Apple Maps, Facebook)", como: "Mismos datos en todos lados." },
  { id: "ingles", peso: 5, texto: "Información en inglés (si recibes turistas)", como: "Una versión corta en inglés de tu página y de tu perfil." },
];

export function auditoria(marcados) {
  const total = PUNTOS.reduce((s, p) => s + p.peso, 0);
  const tiene = PUNTOS.filter((p) => marcados.includes(p.id));
  const puntaje = Math.round((tiene.reduce((s, p) => s + p.peso, 0) / total) * 100);
  const pendientes = PUNTOS.filter((p) => !marcados.includes(p.id)).sort((a, b) => b.peso - a.peso);
  return { puntaje, pendientes, nivel: puntaje >= 80 ? "Muy bien" : puntaje >= 50 ? "A medias" : "Casi invisible" };
}

// Tipos de schema.org más usados por negocios locales
export const TIPOS = { CafeOrCoffeeShop: "Cafetería", Restaurant: "Restaurante", Dentist: "Dentista", MedicalClinic: "Clínica", BeautySalon: "Salón de belleza",
  HairSalon: "Estética / barbería", HealthClub: "Gimnasio", LodgingBusiness: "Hospedaje", TravelAgency: "Tours / agencia", AutoRepair: "Taller mecánico",
  RealEstateAgent: "Inmobiliaria", Store: "Tienda", LocalBusiness: "Otro" };
const DIAS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// horario: { 0..6: [["09:00","14:00"], …] }
export function jsonLd({ tipo = "LocalBusiness", nombre, url, telefono, calle, colonia, ciudad = "Mazatlán", estado = "Sinaloa", cp, horario = {}, precio, redes = [], descripcion, lat, lng, imagen }) {
  const o = {
    "@context": "https://schema.org", "@type": tipo, name: nombre, ...(descripcion ? { description: descripcion } : {}), ...(url ? { url } : {}),
    ...(imagen ? { image: imagen } : {}), ...(telefono ? { telephone: telefono } : {}), ...(precio ? { priceRange: precio } : {}),
    address: { "@type": "PostalAddress", ...(calle ? { streetAddress: calle } : {}), ...(colonia ? { addressLocality: `${colonia}, ${ciudad}` } : { addressLocality: ciudad }),
      addressRegion: estado, ...(cp ? { postalCode: cp } : {}), addressCountry: "MX" },
  };
  if (lat && lng) o.geo = { "@type": "GeoCoordinates", latitude: +lat, longitude: +lng };
  const esp = [];
  for (const [d, turnos] of Object.entries(horario)) for (const [abre, cierra] of turnos) esp.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIAS[+d], opens: abre, closes: cierra });
  if (esp.length) o.openingHoursSpecification = esp;
  if (redes.length) o.sameAs = redes;
  return o;
}
export const faqLd = (preguntas) => ({ "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: preguntas.filter((p) => p.pregunta && p.respuesta).map((p) => ({ "@type": "Question", name: p.pregunta, acceptedAnswer: { "@type": "Answer", text: p.respuesta } })) });
export const etiquetaScript = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n</script>`;
