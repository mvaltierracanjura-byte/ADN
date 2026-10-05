# ADN

Estudio de sistemas digitales e inteligencia artificial para negocios locales de Mazatlán, de Marco Valtierra.

Este repo tiene:
- **La página de ADN**: quiénes somos, las cuatro bases (Atender, Tomar y cobrar, Controlar, Ganar clientes), demo
  bilingüe de la asistente Abi, calculadora, diagnóstico, nueve páginas por giro, versión en inglés y aviso de privacidad.
- **El kit para clientes**, con 11 herramientas que se pueden probar en el sitio: agenda con recordatorios,
  asistente de WhatsApp y recepcionista telefónica con IA, bandeja inteligente y reactivación de clientes, reseñas
  de Google, cobro por transferencia sin comisión, autofactura CFDI 4.0, pronóstico de producción, calendario de
  contenido, aparecer en Google y en la IA, y generador de aviso de privacidad. Las citas también se ven en el
  calendario del teléfono (Google, iPhone, Outlook).

Sitio estático (HTML, CSS y JS sin build). Servidor en Supabase Edge Functions.

- Ver el sitio: `python3 -m http.server 5511` → http://localhost:5511
- Publicar: `npx netlify-cli deploy --prod --dir .`
- Instalar a un cliente: `supabase/LEEME.md`
- Trabajar en el repo: `AGENTS.md`
- Investigación de mercado: `INVESTIGACION.md` · Estado de la página: `MEJORAS.md` · Entrevista con clientes: `docs/descubrimiento.md`
