# AGENTS.md — ADN

**ADN** es el estudio de Marco Valtierra: sistemas digitales e IA para negocios locales de Mazatlán.
Este repo tiene dos cosas:
1. **La página de ADN** (estática, sin build): quiénes somos, servicios, demo, giros, herramientas.
2. **El kit** que se instala a cada cliente: lógica (`kit/`), servidor (`servidor/`), base de datos (`supabase/`)
   y herramientas (`herramientas/`), que en el sitio de ADN corren en modo demo.

Español primero; `en/` es una versión corta en inglés.

```
index.html, en/, privacidad.html, 404.html     # páginas del sitio
giros/*.html                                   # GENERADAS: node scripts/giros.mjs (también sitemap.xml y robots.txt)
datos.js                                       # contacto, bases (servicios) y giros (window.ADN; también lo lee Node)
adn.js                                         # módulo: menú, hélice, bases, giros, demo bilingüe de Abi, calculadora, formulario
estilos.css, fuentes/, img/                    # diseño (tokens claro/oscuro), tipografías locales, ícono e imagen para compartir
herramientas/                                  # demos: agenda (+ cita.html), bandeja, reseñas, cobro (+ pagar.html), factura,
  src/*.html → *.html                          #   pronóstico, contenido, google, aviso, diagnóstico. GENERADAS con
                                               #   node scripts/herramientas.mjs (salvo index, agenda, cita, pagar: a mano)
kit/                                           # lógica pura ESM (navegador, Deno y Node). config.js = conexión del cliente
servidor/                                      # funciones del servidor (clientes externos inyectados: Claude, fetch)
supabase/schema.sql, test-schema.mjs, LEEME.md # base de datos por cliente; LEEME = cómo instalar a un cliente
supabase/functions/{whatsapp,voz,recordatorios,  # Edge Functions (Deno); antes de publicar: node scripts/preparar-funciones.mjs
  facturas,calendario}
.github/workflows/pruebas.yml                  # CI: las tres suites en cada push
pruebas/                                       # *.test.mjs (node --test) y sitio.mjs (Playwright)
docs/descubrimiento.md                         # guía de entrevista, piloto y propuesta
INVESTIGACION.md, MEJORAS.md                   # mercado (incluye videos en 7 idiomas) y estado de la página
```

## Qué hace cada pieza del kit

| Pieza | Lógica | Servidor | Base | Demo |
|---|---|---|---|---|
| Agenda con recordatorios | `kit/agenda.js`, `kit/almacen-agenda.js` | `servidor/recordatorios.js` | sección 2 | `herramientas/agenda.html`, `cita.html` |
| Citas en el calendario (ICS) | `kit/ics.js` | función `calendario` | sección 6 | — |
| Asistente WhatsApp (es/en) | `kit/idioma.js` | `servidor/asistente.js`, `herramientas-agenda.js`, `whatsapp.js`, `db-supabase.js` | sección 3 | demo de Abi en la portada |
| Recepcionista telefónica | — | `servidor/telefono.js` (Twilio) | `llamadas` | — |
| Bandeja y reactivación | `kit/mensajes.js`, `kit/reactivacion.js` | `servidor/clasificar.js` | — | `bandeja.html` |
| Reseñas de Google | `kit/resenas.js` | `servidor/resenas.js` | — | `resenas.html` |
| Cobro SPEI/DiMo | `kit/cobro.js` | — | sección 4 | `cobro.html`, `pagar.html` (con base: `#t=<token>`) |
| Autofactura CFDI 4.0 | `kit/cfdi.js` | `servidor/facturacion.js`, `facturas.js` (Facturama) | sección 5 | `factura.html` |
| Pronóstico de producción | `kit/pronostico.js` | — | — | `pronostico.html` |
| Contenido para redes | `kit/contenido.js` | `servidor/contenido.js` | — | `contenido.html` |
| Google y la IA (GEO) | `kit/geo.js` | — | — | `google.html` |
| Aviso de privacidad | `kit/privacidad.js` | — | — | `aviso.html` |
| Diagnóstico | `kit/diagnostico.js` | — | — | `diagnostico.html` |

## Reglas

- **No inventar datos de negocios ni de clientes.** Cifras públicas siempre con fuente. Precios de ADN, testimonios
  solo cuando Marco los dé.
- **Hablar de resultados, no de IA.** La IA no se presenta como socia ni se usa la marca Anthropic como respaldo.
  Marco va al frente. "Siempre hay una persona detrás" es promesa central. Los asistentes dicen que son asistentes.
- **La página habla de lo que ADN ofrece, ayuda y mejora; no de trabajos para otros negocios** (decisión de Marco,
  7 oct 2026). Nada de casos, logos ni nombres de clientes. Las demos usan **negocios de ejemplo** (Café La Muestra,
  Consultorio Dental Sonrisa). Una prueba de `sitio.mjs` revisa que no aparezca Osako.
- **Claude** (servidor): SDK oficial `@anthropic-ai/sdk`, cliente inyectado (las pruebas usan uno simulado).
  Modelo por defecto `claude-opus-5-5` (`ADN_MODELO` para cambiarlo), `fallbacks: "default"` con la beta
  `server-side-fallback-2026-07-01`, instrucciones fijas en caché y la fecha como mensaje de sistema al final,
  herramientas con `strict: true`, sin `tool_choice` forzado (Opus 5.5 lo rechaza). Si el modelo se niega, se corta o
  no termina: pasa a persona.
- **Enlaces de pago con base conectada: solo token** (`#t=`). Nunca CLABE ni monto en el enlace: serviría para phishing.
- **Seguridad**: la llave de servicio solo vive en el servidor. El teléfono del cliente lo pone el sistema, nunca el
  modelo. Firmas de Meta (sha256) y Twilio (sha1) se validan antes de todo. RLS: equipo = fila en `equipo`.
- Fechas y horas de la agenda en hora local (Mazatlán, UTC−7 todo el año) como texto; nunca `new Date()` local del
  navegador para calcular horarios.
- Contacto (WhatsApp 669 216 6036, correo) vive en `datos.js → contacto`; copias en `data-tel`, `data-correo` y JSON-LD.
- Dominio provisional `https://adn-mazatlan.netlify.app`: al tener el definitivo, cambiarlo en `datos.js`, en las
  etiquetas `canonical`/`og:` de las páginas hechas a mano y en `herramientas/src/_cabeza.html`, y regenerar.
- CSP estricta (`netlify.toml`): solo archivos propios; nada de scripts en línea (el JSON-LD sí).
- Colores: texto chico en naranja u ocre debe pasar 4.5:1 en ambos temas.

## Pruebas

```bash
node --test pruebas/*.test.mjs                                     # lógica y servidor (84)
ADN_DEPS=~/adn-deps node supabase/test-schema.mjs                   # base de datos en Postgres real (83)
NODE_PATH=$(npm root -g) node pruebas/sitio.mjs [carpeta-capturas]  # navegador: páginas, herramientas y modo conectado (128)
```

## Pendientes de Marco

- Domicilio del responsable en `privacidad.html` (marcado en amarillo). **No publicar sin eso.**
- Conectar Netlify al repo (publica solo en cada push), dominio y correo propios, perfil de Google Business de ADN, foto, precios.
- Para clientes: llaves de Anthropic, Meta (WhatsApp), Twilio, Facturama, según lo que contraten.
