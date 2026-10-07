# Cómo mejorar la página de ADN — investigación (5 oct 2026)

## Estado (5 oct 2026, segunda ronda)

**Hecho:** todo lo de la etapa 1 y 3, más:
- Kit completo con 11 herramientas probables en el sitio (`herramientas/`), cada una con su lógica probada.
- Portada reposicionada con lo aprendido en videos de 7 idiomas (`INVESTIGACION.md` §6): resultados antes que IA,
  diagnóstico de 2 minutos, entrevista y piloto medido en el método, pregunta honesta sobre el agente gratis de Meta,
  sección de herramientas. Demo de Abi bilingüe.
- Servidor listo para clientes: asistente de WhatsApp con Claude, recepcionista telefónica (Twilio), recordatorios,
  base de datos con seguridad por rol (`supabase/`).
- Tercera ronda: cobros guardados en la base (el enlace de pago lleva solo un token), autofactura conectada a Facturama
  (tickets, solicitudes, timbrado con reintentos y correo), citas en el calendario del teléfono (ICS) y pruebas en
  GitHub Actions en cada push.
- Cuarta ronda (7 oct 2026, pedido de Marco): la página ya no habla de otros negocios (sin caso Osako). Secciones nuevas
  sobre lo que ofrecemos: En qué te ayudamos (hoy contra con ADN), Resultados (qué medimos), Lo que te entregamos,
  ¿Es para ti?, Tus datos y 6 preguntas frecuentes más. En inglés, "What we improve".
- Quinta ronda (7 oct 2026): el asistente se llama Vektor y se adapta a cada negocio con el nombre que el dueño elija.
  Revisión completa: corregidos el dato de llamadas de talleres (no coincidía con su fuente), la base de "Reseñas" en el
  diagnóstico, el pronóstico (ahora es para mañana), el aviso de privacidad (las herramientas guardan datos de ejemplo
  en el navegador), la revisión mensual (va con la mensualidad), el menú de las páginas por giro y una pregunta mal puntuada.
- 296 pruebas automáticas (85 de lógica, 83 de base de datos, 128 de navegador).

**Falta (depende de Marco):** domicilio para el aviso de privacidad, conectar Netlify al repo, dominio y
correo propios, perfil de Google, foto, precios y medición de visitas.

---

Revisé la página actual contra tres cosas: qué hacen las agencias de Mazatlán con las que competimos,
qué dice la evidencia sobre páginas de servicios que convierten, y requisitos técnicos y legales.
Las mejoras van ordenadas por prioridad. Las fuentes están al final.

## Lo que encontré

### 1. La competencia local ya vende "chatbot de WhatsApp con IA"
- **AsociadosWeb** (Mazatlán) ofrece chatbots de WhatsApp con IA, CRM y SEO local. Presume "25 años,
  7,000 proyectos, 500 clientes" y testimonios con cifras ("3x ventas", "ROI en 2 meses"). WhatsApp y
  "consulta gratis" en toda la página.
- **Clientes con Web** (Sinaloa): WordPress, SEO, Google Ads. Sin precios, "consulta gratis".
- **Agencia Digital Cactus** y **Linea02**: redes sociales, diseño y publicidad. Poca prueba de resultados.

**Conclusión:** no podemos ganar en volumen ni en años. Podemos ganar en **prueba en vivo**: nadie más
enseña un sistema funcionando que el visitante pueda abrir y usar (la página de Osako). Además,
construimos a la medida en lugar de instalar WordPress. La página debe gritar eso.

### 2. Lo que más pesa en páginas de servicios (evidencia)
- Para servicios B2B, la prueba social que funciona son **casos con números** y **testimonios con nombre**.
  En agencias, también la historia del fundador, fotos del equipo y un proceso claro. Nuestra página tiene
  proceso y caso, pero **sin números, sin testimonio, sin fotos**.
- Acortar formularios es el cambio con más mejora documentada. En México el canal natural es WhatsApp:
  menos pasos que un formulario.
- Las herramientas interactivas (calculadoras con 2–3 datos) convierten mucho mejor que el contenido pasivo.
- Precios: los estudios no coinciden. Publicar un "desde $X" o el modelo de cobro ayuda a que el cliente
  se filtre solo. Ocultarlo genera más contactos, pero de menor calidad. Para negocios pequeños que temen
  "esto ha de ser carísimo", un precio de entrada quita miedo.

### 3. La IA genera confianza solo si hay una persona detrás
- 8 de cada 10 personas quieren saber si hablan con una IA o con una persona. Cuando hay una forma clara de
  hablar con una persona, 55% confía en que la IA resuelva; sin esa opción, solo 26%.
- Para negocios locales, la mayoría prefiere a una persona.
- **Implicación:** presentar a "Claude, de Anthropic" como cofundador puede jugar en contra con dueños
  tradicionales. Además, usar el nombre de Anthropic puede leerse como que Anthropic nos respalda, y no es
  así. Mejor: Marco al frente (foto, historia, WhatsApp directo) y "trabajamos con inteligencia
  artificial" como método, no como socio. La regla "si Abi no sabe, pasa a una persona" es nuestro mejor
  argumento: ponerla arriba.

### 4. Obligación legal: aviso de privacidad
- La nueva LFPDPPP (en vigor desde el 21 mar 2025) aplica a toda persona con actividad empresarial, sin
  mínimo de tamaño. El aviso es obligatorio **desde que se recaban datos**, y nuestro formulario pide nombre
  y negocio.
- Se necesita un aviso integral (página propia enlazada en el pie) y uno simplificado junto al formulario.
  Contenido mínimo: identidad y domicilio del responsable, datos que se piden, finalidades, cómo limitar su
  uso y cómo ejercer derechos ARCO. La autoridad ahora es la Secretaría Anticorrupción y Buen Gobierno
  (el INAI desapareció).
- Esto también lo vamos a necesitar **para cada cliente** (Osako incluida): es un servicio más que
  podemos ofrecer.

### 5. Técnico: lo que le falta a la página
| Falta | Por qué importa |
|---|---|
| Etiquetas Open Graph (`og:title`, `og:image` 1200×630, < 600 KB) | Sin ellas, al compartir el enlace por WhatsApp no sale vista previa. Es nuestro canal principal. |
| Favicon e ícono para el celular | Pestaña y acceso directo sin marca. |
| Datos para Google (JSON-LD `ProfessionalService`) | Ayuda a aparecer en búsquedas locales. Osako ya lo tiene. |
| `canonical`, `robots.txt`, `sitemap.xml` | Básicos de SEO. |
| Menú en el celular | En pantallas angostas el menú desaparece y no hay cómo navegar. |
| Botón fijo de WhatsApp en el celular | El contacto queda al final de una página larga. |
| La animación de la hélice nunca se detiene | Gasta batería aunque esté fuera de pantalla. Pausarla con `IntersectionObserver`. |
| Contraste de los colores naranja (3.9:1) y ocre (3.5:1) en texto chico | Bajo el mínimo de 4.5:1 en modo claro. Oscurecerlos un poco o usarlos solo en texto grande. |
| Tres familias tipográficas desde Google Fonts | Retrasan la primera pintura. Subirlas al sitio o usar solo dos. |
| Medición | No sabemos cuánta gente entra ni cuántos tocan WhatsApp. Netlify Analytics o Plausible (sin cookies, no necesitan aviso de cookies). |

### 6. SEO local: "ADN" sola es una palabra imposible de posicionar
"ADN" compite con genética, noticias y mil marcas. Nadie busca "ADN" para encontrar una agencia.
La gente busca **"chatbot WhatsApp Mazatlán"**, **"página de pedidos restaurante"**, **"agenda de citas
consultorio"**. Hace falta:
- Un nombre de búsqueda completo y constante: p. ej. "ADN · Estudio digital en Mazatlán" en título y Google.
- **Una página por giro** (`/restaurantes`, `/consultorios`, `/salones`…) con el texto de la ficha
  ampliado. Así Google tiene qué mostrar, y un anuncio de Facebook o Google lleva a una página que habla
  exactamente de ese negocio.
- **Perfil de Google Business** de ADN y un dominio propio (`.mx` o `.com.mx`), con correo del dominio.
  Un correo de Gmail resta seriedad frente a la competencia.

## Plan recomendado

**Etapa 1 — esta semana (solo depende de nosotros)**
1. Open Graph + imagen para WhatsApp, favicon, JSON-LD, canonical, robots y sitemap.
2. Botón fijo "Escríbenos por WhatsApp" en el celular y menú móvil.
3. Hélice que se pausa fuera de pantalla; ajustar contraste de naranja y ocre; dos tipografías.
4. Aviso de privacidad (página + aviso corto con casilla en el formulario). Necesito el domicilio que
   quieras usar como responsable.
5. Reescribir "Quiénes somos": Marco al frente; la IA como herramienta, sin usar la marca Anthropic como
   socio; destacar "siempre hay una persona detrás".

**Etapa 2 — con datos de Marco y de Osako**
6. Números reales de Osako: pedidos por la web por semana, minutos promedio para tomar un pedido, % de
   tickets con sugerencia aceptada. Salen de Supabase y se pueden sacar con permiso de la dueña.
7. Testimonio de la dueña de Osako, con nombre y foto, y su permiso por escrito para el caso.
8. Foto de Marco (y si se puede, de Marco en Osako).
9. Precios de entrada por base ("desde $…") o al menos el modelo: pago por etapa y mensualidad de
   mantenimiento. Lo decide Marco.

**Etapa 3 — crecer**
10. **Demo de Abi en la página**: un chat de ejemplo que contesta como lo haría con un cliente de
    cafetería. Nadie en Mazatlán lo tiene; es la prueba más fuerte.
11. **Calculadora "¿Cuánto pierdes?"**: el visitante pone citas por semana, % que no llega y precio
    promedio, y ve cuánto pierde al mes y cuánto recuperaría con recordatorios (30–50% menos
    inasistencias). Al final, botón a WhatsApp con su resultado ya escrito.
12. Páginas por giro, empezando por consultorios y restaurantes.
13. Versión en inglés: muchos negocios turísticos y dueños extranjeros en la Zona Dorada.
14. Perfil de Google Business de ADN y pedir reseña a cada cliente al cerrar una etapa.

## Fuentes
- Competencia: [AsociadosWeb](https://asociadosweb.com.mx/diseno-web-mazatlan), [Clientes con Web](https://clientesconweb.com/agencia-marketing-digital-sinaloa/), [Agencia Digital Cactus](https://www.agenciadigitalcactus.com/), [Linea02](https://www.linea02.com/)
- Conversión y prueba social: [ZoomInfo — benchmarks 2026](https://pipeline.zoominfo.com/marketing/landing-page-conversion-rates), [Flint — trust signals](https://www.flint.com/blog/landing-page-trust-signal-conversion-statistics), [Linear — trust signals](https://lineardesign.com/blog/trust-signals/), [Best Version Media — negocios locales](https://www.bestversionmedia.com/why-trust-signals-are-the-missing-link-on-most-local-business-websites/)
- Precios: [HockeyStack](https://hockeystack.com/blog/the-state-of-pricing-demo-and-case-study-pages/), [Convert / iProspect](https://www.convert.com/case-studies/iprospect/), [Sotros](https://sotrosinfotech.com/blog/saas-pricing-page-best-practices-design-converts-2026/)
- Calculadoras: [Outgrow](https://outgrow.co/blog/interactive-calculators-lead-generation-conversion)
- WhatsApp vs formulario: [Wati](https://www.wati.io/es/blog/whatsapp-lead-generation/), [Kommo](https://www.kommo.com/es/blog/vincular-whatsapp-a-sitio-web/)
- IA y confianza: [Five9](https://www.five9.com/news/news-releases/new-five9-research-ai-adoption-cx-hits-92-consumer-trust-still-depends-human), [CX Today](https://www.cxtoday.com/?p=75437), [CMM — servicios locales](https://cmmonline.com/news/most-would-rather-speak-to-a-person-when-booking-a-home-service)
- Aviso de privacidad: [Legiscope](https://www.legiscope.com/blog/aviso-privacidad-mexico-lfpdppp.html), [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce), [Texto de la ley](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf)
- Vista previa en WhatsApp: [Meta — link previews](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/), [Screenhance](https://screenhance.com/blog/og-image-size-guide)
- Rendimiento: [corewebvitals.io](https://corewebvitals.io/core-web-vitals), [Shno — estadísticas](https://www.shno.co/marketing-statistics/core-web-vitals-statistics)
