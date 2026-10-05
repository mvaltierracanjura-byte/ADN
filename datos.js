// Datos de ADN: contacto, servicios (las cuatro bases) y giros.
// Fuente única: la página, las páginas por giro (scripts/giros.mjs) y las pruebas leen de aquí.
(function (raiz) {
  const ADN = {
    contacto: {
      whatsapp: "526692166036", // 52 + 10 dígitos
      whatsappTexto: "669 216 6036",
      correo: "mvaltierracanjura@gmail.com",
      sitio: "https://adn-mazatlan.netlify.app", // cambiar al dominio definitivo (también en sitemap.xml, robots.txt y las etiquetas og:)
    },

    // Las cuatro bases. `nuevo: true` = servicio que salió de la investigación (INVESTIGACION.md).
    bases: [
      { letra: "A", nombre: "Atender", frase: "Que ningún cliente se quede sin respuesta, a cualquier hora.", servicios: [
        { t: "Asistente de WhatsApp e Instagram con IA", d: "Contesta precios y horarios, toma pedidos y citas. Si no sabe, pasa a una persona." },
        { t: "Recepcionista telefónica con IA", d: "Contesta las llamadas que hoy se pierden en hora pico o fuera de horario.", nuevo: true },
        { t: "Página web y menú en línea", d: "Rápida en el celular, con tu marca y en español e inglés." },
        { t: "Aparecer en Google y en las respuestas de IA", d: "Perfil de Google, datos para buscadores y contenido que ChatGPT y Gemini pueden citar.", nuevo: true },
      ]},
      { letra: "T", nombre: "Tomar pedidos y cobrar", frase: "Del “me interesa” al pago, sin vueltas.", servicios: [
        { t: "Pedidos, reservas y citas en línea", d: "Con folio y seguimiento para el cliente." },
        { t: "Cobro con tarjeta, transferencia o CoDi", d: "Liga de pago, revisión de comprobantes y cobro por QR desde el celular.", nuevo: true },
        { t: "Facturación automática", d: "Tu cliente se factura solo con su RFC; tú no capturas nada.", nuevo: true },
        { t: "Envío calculado por colonia", d: "Cotiza el costo de reparto antes de cobrar." },
      ]},
      { letra: "C", nombre: "Controlar la operación", frase: "Que el equipo sepa qué sigue, sin papelitos.", servicios: [
        { t: "Tablero de pedidos y CRM", d: "Fila, estados, tiempos y alertas por retraso." },
        { t: "Agenda con recordatorios", d: "Confirmar o cambiar la cita por WhatsApp, sin llamar." },
        { t: "Cuánto preparar mañana", d: "Pronóstico con tus ventas, el día y el clima para tirar menos producto.", nuevo: true },
        { t: "Aviso de privacidad y permisos por rol", d: "Cumplir la ley de datos personales; cada quien ve solo lo suyo.", nuevo: true },
      ]},
      { letra: "G", nombre: "Ganar clientes que regresan", frase: "Vender otra vez a quien ya te compró.", servicios: [
        { t: "Tarjeta de sellos digital", d: "Sin app: un enlace y un QR en el celular." },
        { t: "Reseñas de Google", d: "Pedir reseña en el momento justo y contestar cada una.", nuevo: true },
        { t: "Contenido para redes", d: "Ideas, textos y calendario de publicaciones con tu menú y tus fotos.", nuevo: true },
        { t: "Sugerencias, combos y reportes", d: "Subir el ticket promedio y saber qué se vende." },
      ]},
    ],

    // Giros. `hace`: [base, texto]. `fuente`: respaldo del dato, si lo hay.
    giros: [
      { id: "restaurantes", nombre: "Cafeterías y restaurantes", corto: "Restaurantes",
        dolor: "Los pedidos llegan por WhatsApp, Instagram, teléfono y mostrador a la vez, y en hora pico se pierden o se atrasan.",
        hace: [["T","Menú en línea con pedidos para recoger o a domicilio, y cobro por adelantado."],["C","Pantalla de barra o cocina con la fila, tiempos y alerta de pedidos atrasados."],["A","Asistente que contesta el menú y el horario y arma el pedido por WhatsApp o por teléfono."],["C","Pronóstico de cuánto preparar para tirar menos."],["G","Tarjeta de sellos, sugerencias que suben el ticket y reseñas de Google."]],
        dato: "Un restaurante típico deja de contestar cerca del 32% de las llamadas entre 5 y 8 de la noche.",
        fuente: ["Loman", "https://loman.ai/blog/restaurant-ai-phone-receptionist-revenue"],
        caso: true },
      { id: "consultorios", nombre: "Consultorios y clínicas", corto: "Consultorios",
        dolor: "Pacientes que no llegan a su cita y una recepción que pasa el día contestando lo mismo.",
        hace: [["C","Agenda en línea por médico o consultorio, con horarios reales y bloqueos."],["A","Recordatorio por WhatsApp un día antes, con botón para confirmar o cambiar la cita."],["T","Anticipo para apartar la cita, con tarjeta, transferencia o CoDi."],["A","Recepcionista telefónica con IA para las llamadas fuera de horario."],["C","Aviso de privacidad y permisos: los datos de salud son sensibles."],["G","Aviso de seguimiento: control, limpieza o revisión anual."]],
        dato: "Los recordatorios por WhatsApp reducen entre 30% y 50% las inasistencias.",
        fuente: ["Aurora Inbox", "https://www.aurorainbox.com/2026/03/08/configurar-recordatorios-citas-whatsapp/"] },
      { id: "salones", nombre: "Salones, barberías y spas", corto: "Salones",
        dolor: "La agenda vive en una libreta o en el chat, con huecos por citas que se cancelan sin aviso.",
        hace: [["C","Reservas por servicio y por estilista, con la duración real de cada servicio."],["A","Asistente que muestra horarios libres y agenda por WhatsApp o Instagram."],["T","Anticipo para apartar en horarios de alta demanda."],["G","Tarjeta de lealtad, recordatorio del siguiente corte y contenido para Instagram."]],
        dato: "Los mismos recordatorios que funcionan en consultorios aplican a citas de belleza.",
        fuente: ["AgendaPro", "https://agendapro.com/blog/como-automatizar-recordatorios/"] },
      { id: "turismo", nombre: "Hoteles, tours y actividades", corto: "Turismo",
        dolor: "Mensajes en inglés y español a toda hora, y reservas que dependen de plataformas con comisión.",
        hace: [["A","Asistente bilingüe que responde disponibilidad, precios y cómo llegar, las 24 horas."],["T","Reserva directa con anticipo en tu página, sin comisión de terceros."],["C","Calendario de salidas u ocupación y lista de pendientes del equipo."],["G","Mensaje después de la visita pidiendo reseña en Google y TripAdvisor."]],
        dato: "Mazatlán recibió 359 mil cruceristas de enero a septiembre de 2026, 29% más que el año anterior.",
        fuente: ["Gobierno de Sinaloa", "https://sinaloa.gob.mx/suma-mazatlan-mas-de-359-mil-cruceristas-en-los-primeros-nueve-meses-de-2026/"] },
      { id: "rentas", nombre: "Rentas vacacionales", corto: "Rentas",
        dolor: "Huéspedes que preguntan lo mismo a las 2 de la mañana y comisiones de Airbnb que se comen la ganancia.",
        hace: [["A","Respuestas al huésped en segundos: llegada, wifi, estacionamiento, playa."],["T","Página de reserva directa para huéspedes que regresan, sin comisión."],["C","Calendario de limpiezas y aviso al equipo en cada salida."],["G","Lista de huéspedes para ofrecerles volver en la siguiente temporada."]],
        dato: "Los huéspedes que no reciben respuesta en 30 minutos suelen reservar en otro lado.",
        fuente: ["RedAwning", "https://www.redawning.com/pm/post/ai-guest-communication-vacation-rentals-2026"] },
      { id: "tiendas", nombre: "Tiendas y comercio", corto: "Tiendas",
        dolor: "Clientes que preguntan “¿lo tienes?” y “¿cuánto cuesta?” todo el día, y nada de venta en línea.",
        hace: [["T","Catálogo en línea con existencias, apartado y cobro con liga o CoDi."],["A","Asistente que contesta precio y existencia con el inventario real."],["T","Factura automática para el cliente que la pide."],["G","Lista de clientes para avisar de llegadas y promociones."]],
        dato: "Solo 22% de las microempresas informales paga a sus proveedores por transferencia: el efectivo sigue mandando.",
        fuente: ["El Financiero", "https://www.elfinanciero.com.mx/opinion/colaborador-invitado/2026/04/21/2026-podria-ser-el-ano-en-que-codi-y-dimo-comiencen-a-escalar/"] },
      { id: "inmobiliarias", nombre: "Inmobiliarias", corto: "Inmobiliarias",
        dolor: "Interesados que escriben y se enfrían porque nadie les respondió a tiempo.",
        hace: [["A","Respuesta inmediata a cada interesado con fotos, precio y ubicación de la propiedad."],["C","Seguimiento de prospectos: en qué etapa va cada uno y quién lo atiende."],["C","Agenda de visitas con recordatorio al cliente y al asesor."],["A","Atención en inglés para compradores extranjeros."]],
        dato: "Quien contesta primero suele quedarse con el cliente.",
        fuente: null },
      { id: "gimnasios", nombre: "Gimnasios, estudios y escuelas", corto: "Gimnasios",
        dolor: "Mensualidades vencidas sin cobrar y clases con cupo que se llenan por chat.",
        hace: [["C","Registro de alumnos, mensualidades y asistencia."],["T","Cobro recurrente y recordatorio de pago por WhatsApp."],["A","Reserva de clase con cupo y lista de espera."],["G","Aviso a quien dejó de venir para invitarlo de vuelta."]],
        dato: "Un recordatorio a tiempo evita meses sin cobrar.",
        fuente: null },
      { id: "talleres", nombre: "Talleres y servicios a domicilio", corto: "Talleres",
        dolor: "Cotizaciones a mano y clientes que preguntan “¿ya está mi carro?” o “¿a qué hora llegan?”.",
        hace: [["T","Cotización rápida desde el celular con tus precios, enviada por WhatsApp."],["C","Órdenes de trabajo con estado: recibido, en proceso, listo."],["A","Enlace de seguimiento para que el cliente vea el avance sin llamar."],["G","Recordatorio de servicio: afinación, mantenimiento, fumigación."]],
        dato: "62% de las llamadas a pequeños negocios de servicios no se contesta, y 85% de esas personas no vuelve a llamar.",
        fuente: ["Beancount", "https://beancount.io/blog/2026/08/16/ai-receptionist-small-business-missed-call-revenue-bookkeeping-guide"] },
    ],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = ADN;
  else raiz.ADN = ADN;
})(typeof window !== "undefined" ? window : globalThis);
