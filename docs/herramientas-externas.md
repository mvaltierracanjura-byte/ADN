# Herramientas, conectores y repos que ayudan a ADN (7 oct 2026)

Interno. Qué conviene usar para construir más rápido y ofrecer más, y qué no. Revisado con el catálogo de
plugins y conectores de Claude de la cuenta de Marco y con búsquedas en la web.

## 1. Ya conectados en la cuenta de Marco (se pueden usar hoy)

| Conector | Para qué le sirve a ADN |
|---|---|
| **Supabase** | Crear el proyecto de cada cliente, correr `supabase/schema.sql`, publicar las funciones y revisar avisos de seguridad sin salir de Claude. Es lo que más acelera instalar el kit. |
| **Windsor.ai** | Ya trae acciones sobre **Google Business Profile**: contestar reseñas, publicar novedades, cambiar horario y horario especial, servicios, categorías y fotos. Resuelve lo que estaba pendiente en `supabase/LEEME.md` (§4, "Reseñas: requiere la API de Google Business Profile") sin construir OAuth propio. También lee y maneja anuncios de Meta, Google y TikTok, y publica en Instagram. |
| **Canva** | Piezas para redes de cada cliente (el calendario de contenido dice qué publicar; Canva lo arma). |
| **dot.** | Liga para que el cliente deje comentarios sobre su página antes de publicarla. |

Regla: toda acción que publica algo (respuesta a reseña, post, anuncio) se aprueba antes con el dueño.

## 2. Conviene conectar

| Conector | Por qué |
|---|---|
| **Netlify** | Publicar ADN y las páginas de cada cliente desde Claude. Hoy la publicación depende de que Marco conecte el repo a mano. |
| **Stripe** o el de pagos que use el cliente | Solo si un cliente cobra con tarjeta fuera de México. En México seguimos con SPEI/CoDi y Clip. |
| **Calendly** | Para agendar la entrevista de 2 horas con prospectos de ADN (no para clientes: ellos usan nuestra agenda). |

## 3. Plugins del catálogo de Anthropic

- **Small Business** (Anthropic): 44 flujos para pequeños negocios. Los que calzan con lo que vendemos:
  `speed-to-lead` (contestar rápido al prospecto), `review-reputation` (reseñas), `reactivate` (clientes que no
  volvieron), `seo-ai-visibility` (aparecer en Google y en la IA), `proposal-builder` (propuestas), `crm-autopilot`,
  `lead-finder` y `call-list` (buscar negocios para ofrecerles ADN), `social-content-engine`, `content-strategy`,
  `ticket-deflector`. Sirven dos veces: para que ADN consiga clientes y como guion de lo que instalamos.
- **Marketing** (Anthropic, ya disponible en esta sesión): `seo-audit`, `competitive-brief`, `campaign-plan`,
  `email-sequence`. Útil para la página de ADN y para los clientes.
- Descartados por ahora: plugins de agencias de anuncios de terceros (Hyper, Adspirer): duplican Windsor.ai.

## 4. Repos de código abierto

| Repo | Para qué | Decisión |
|---|---|---|
| [Chatwoot](https://github.com/chatwoot/chatwoot) (MIT, ~32k ⭐) | Bandeja omnicanal (WhatsApp Cloud API, Instagram, web, correo) con asignación a personas y un agente de IA. | **Evaluar** como "pantalla del equipo" para clientes con varios agentes humanos. Nuestro asistente (`servidor/asistente.js`) puede contestar y pasar a persona dentro de Chatwoot vía su API. Hay que alojarlo (Docker). |
| [Pipecat](https://github.com/pipecat-ai/pipecat) (BSD, ~13k ⭐) | Agentes de voz en tiempo real; soporta Twilio Media Streams y muchos STT/TTS. | **Siguiente versión** de la recepcionista telefónica: hoy usamos `<Gather>` de Twilio (turnos con pausa). Con Pipecat se puede interrumpir y suena más natural. Es Python y necesita servidor propio, no Edge Functions. |
| [Umami](https://github.com/umami-software/umami) (MIT, ~38k ⭐) | Medición de visitas sin cookies (no necesita aviso de cookies). | **Usar** para ADN y clientes: era "medición de visitas" en pendientes. Cabe en la CSP si se aloja en un dominio propio y se agrega a `script-src`/`connect-src`. |
| [@nodecfdi](https://github.com/nodecfdi) (MIT) | Librerías TypeScript para CFDI 4.0 (inspiradas en CfdiUtils de PHP). | **Usar si** se deja Facturama y se timbra con otro PAC, o para validar/leer XML de CFDI recibidos. Hoy no hace falta: Facturama arma el XML. |
| Baileys / Evolution API (WhatsApp no oficial) | Conectar WhatsApp sin la API de Meta. | **No usar.** Viola los términos de WhatsApp y el número del cliente puede ser bloqueado. Siempre WhatsApp Cloud API. |

## 5. Siguiente paso sugerido

1. Conectar Netlify y publicar ADN (cuando esté el domicilio del aviso).
2. Agregar Umami a la página de ADN para saber cuánta gente entra y cuántos tocan WhatsApp.
3. Para el primer cliente con reseñas: usar Windsor.ai para contestar desde el sistema (con aprobación del dueño).
4. Probar Chatwoot con un negocio que tenga 3+ personas atendiendo WhatsApp.
