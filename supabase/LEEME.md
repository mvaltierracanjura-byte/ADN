# Instalar el kit de ADN para un cliente

Cada negocio tiene **su propio** proyecto de Supabase (sus datos son suyos) y su propio sitio en Netlify.

## 1. Base de datos

1. Crear el proyecto en Supabase (región `us-west-1`, la más cercana a Mazatlán). Desactivar el registro público.
2. SQL Editor → pegar y correr `supabase/schema.sql` (se puede correr varias veces).
3. Ajustes del negocio:
   ```sql
   insert into ajustes (clave, valor) values ('negocio', '{"nombre":"Consultorio Sonrisa","zona":"America/Mazatlan",
     "anticipacionMin":60,"diasAdelante":21,"intervalo":30,
     "horario":{"1":[["09:00","14:00"],["16:00","20:00"]],"6":[["09:00","13:00"]]}}')
   on conflict (clave) do update set valor = excluded.valor;
   ```
4. Personal y servicios (`personal`, `servicios`), igual que en la entrevista (`docs/descubrimiento.md`).
5. Equipo: crear las cuentas en Authentication → Users y agregarlas:
   ```sql
   insert into equipo (user_id, nombre, rol) select id, 'Nombre', 'duena' from auth.users where email = '…';
   ```
   Quien no está en `equipo` no ve nada, aunque tenga sesión.

Pruebas del esquema (sin cuenta): `ADN_DEPS=<carpeta con @electric-sql/pglite> node supabase/test-schema.mjs`.

## 2. Páginas del cliente

En `kit/config.js` poner `SUPABASE = { url, anonKey }` (la llave **anon**, nunca la de servicio) y agregar la URL de
Supabase a `connect-src` en `netlify.toml`. Las herramientas dejan el modo demo solas.

## 3. Funciones del servidor

```bash
node scripts/preparar-funciones.mjs      # copia kit/ y servidor/ a supabase/functions/_adn/
supabase functions deploy whatsapp --no-verify-jwt
supabase functions deploy voz --no-verify-jwt
supabase functions deploy recordatorios --no-verify-jwt
```

Secretos (Supabase → Edge Functions → Secrets). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen.

| Secreto | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | El asistente (Claude). |
| `ADN_MODELO` | Opcional. Por defecto `claude-opus-5-5`; para menor costo, `claude-sonnet-5-5`. |
| `NEGOCIO_JSON` | `{"nombre":"…","giro":"…","conocimiento":"servicios, precios, horario, políticas…","agenda":true}` |
| `SITIO_URL` | `https://<sitio>/herramientas` (para el enlace de la cita) |
| `WA_TOKEN`, `WA_TELEFONO_ID`, `WA_SECRETO_APP`, `WA_VERIFICAR` | WhatsApp Cloud API (Meta). |
| `WA_PLANTILLA_RECORDATORIO` | Nombre de la plantilla aprobada (ver abajo). |
| `CRON_SECRETO` | Clave que manda el cron a `recordatorios`. |
| `TWILIO_AUTH_TOKEN`, `VOZ_URL_BASE`, `TRANSFERIR_A` | Recepcionista telefónica (opcional). |

### WhatsApp (Meta)

- App en developers.facebook.com con el caso de uso WhatsApp, número propio y **token permanente** de usuario del sistema.
- Webhook: `https://<proyecto>.supabase.co/functions/v1/whatsapp`, token de verificación = `WA_VERIFICAR`, suscribir `messages`.
- Plantilla de recordatorio (categoría **utilidad**, español MX), nombre `recordatorio_cita`:
  `Hola, {{1}}. Te recordamos tu cita en {{2}}: {{3}}, el {{4}} a las {{5}}. Confirma, cambia o cancela aquí: {{6}}`
- Costos en México desde el 1 oct 2026: utilidad ≈ MXN 0.16 por mensaje; marketing ≈ MXN 0.73; los primeros 1,000
  mensajes de servicio al mes, gratis.
- Política de 2026: los asistentes de negocio están permitidos (los chatbots de propósito general no).

### Recordatorios cada hora

Supabase → Integrations → Cron: cada hora, petición POST a `/functions/v1/recordatorios` con la cabecera
`x-cron: <CRON_SECRETO>`.

### Teléfono (Twilio)

- Comprar un número mexicano en Twilio (o desviar las llamadas no contestadas del número del negocio a él).
- En el número: *A call comes in* → Webhook POST `https://<proyecto>.supabase.co/functions/v1/voz/telefono`.
- `VOZ_URL_BASE` = `https://<proyecto>.supabase.co/functions/v1/voz` (la firma de Twilio depende de esta URL exacta).
- `TRANSFERIR_A` = número del negocio en formato `+52…` para pasar llamadas a una persona; si no, se avisa al equipo
  y la plática aparece en "Necesita a una persona".

## 4. Pendientes por conectar

- **Facturación**: cuenta de Facturama (u otro PAC). `servidor/facturacion.js` usa el sandbox; revisar su
  documentación vigente antes de producción. Falta la tabla de solicitudes y la función que timbra.
- **CoDi con QR**: depende del banco del negocio. Hoy: SPEI a la CLABE o DiMo al celular.
- **Reseñas**: leer y publicar respuestas requiere la API de Google Business Profile (OAuth del dueño).
  Hoy: invitación con enlace directo y respuestas que el dueño copia.
- **Google Calendar**: sincronizar la agenda con el calendario que el negocio ya usa.
