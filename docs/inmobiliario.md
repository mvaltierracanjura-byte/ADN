# Oferta para el giro inmobiliario (7 oct 2026)

Interno, no se publica. Sale de revisar **Perlux**, la plataforma inmobiliaria que Marco está construyendo
(`mvaltierracanjura-byte/Perlux`: Next.js + Supabase). Todo lo de abajo ya existe ahí en alguna medida, así que
para inmobiliarias, asesores y desarrolladoras ADN puede ofrecerlo con base en código propio.

La página de ADN **no menciona a Perlux** (regla: no hablar de trabajos para otros negocios). Solo lista lo que
ofrecemos, en `datos.js → giros` (ids `inmobiliarias` y `desarrolladoras`).

## Inmobiliarias y asesores

| Oferta en la página | Dónde vive en Perlux |
|---|---|
| Respuesta inmediata por WhatsApp, bilingüe | `api/whatsapp/webhook`, `admin/whatsapp-leads`, `api/perla-chat` |
| Búsqueda con IA en lenguaje natural | `api/propiedades/busqueda-ia`, `api/ai/busqueda` |
| CRM de prospectos (etapas, tareas, actividades, WhatsApp, importar) | `crm/`, `api/crm/clientes/*`, `api/crm/metricas` |
| Agenda de visitas y open houses con recordatorio | `api/reuniones` (+ `ics`), `api/visitas`, `asesor/open-houses` |
| Valuación en línea para captar propietarios | `valuar/`, `api/valuar`, `asesor/valuaciones` |
| Comparativo de mercado y descripción con IA | `api/cma/[id]`, `api/ai/descripcion`, `mercado/[ciudad]` |
| Verificación de la propiedad y riesgo de la zona (CENAPRED) | `api/propiedades/[id]/verificacion/*`, `riesgo/`, `api/riesgo` |
| Calculadora de crédito, ofertas y firma digital | `calculadora/`, `precalificar/`, `api/ofertas`, `api/mifiel/documentos` |
| Importar de EasyBroker, publicar en portales, comisiones | `api/importar/easybroker`, `mis-propiedades/[id]/portales`, `api/comisiones` |
| Páginas por zona/tipo (SEO) y alertas de precio | `(landing)/[operacion]/[tipo]/[ciudad]`, `api/alertas`, `api/cron/precios-favoritos` |

Otras piezas de Perlux que también se pueden ofrecer después: análisis de contrato con IA (`analizar-contrato`),
detección de anuncios duplicados, perfil público del asesor con reseñas, referidos, campañas de anuncios, checklist y
guía de compra, comparador de propiedades, API para integraciones.

## Desarrolladoras y preventas

| Oferta en la página | Dónde vive en Perlux |
|---|---|
| Página del proyecto con su marca e inventario por unidad | `desarrolladoras/proyecto/[slug]`, `desarrolladoras/marca/[id]`, `desarrolladoras/unidades/[id]` |
| Asistente que contesta precios, planos y disponibilidad | `api/perla-chat`, `api/v1/proyectos/[id]/unidades` |
| Prospectos repartidos al equipo de ventas | `api/desarrolladoras/proyectos/leads`, `desarrolladoras/equipo` |
| Capacitación del equipo con asistente | `desarrolladoras/capacitacion`, `api/desarrolladoras/capacitacion/chat` |
| Apartado en línea y firma digital | `api/pagos/*`, `api/mifiel/documentos` |
| Avances de obra | `api/desarrolladoras/proyectos/[id]/actualizar` |

## Cuidado al vender

- Perlux tiene sus propios textos de planes con cifras sin respaldo (p. ej. "78% de los asesores Pro duplican sus
  leads"). **No copiarlas** a ADN.
- La verificación de propiedad y el riesgo de zona están diseñados en `docs/superpowers/specs/` de Perlux; antes de
  vender cada pieza, confirmar que esté terminada y probada allá.
