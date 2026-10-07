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
supabase functions deploy facturas --no-verify-jwt      # si contrató autofactura
supabase functions deploy calendario --no-verify-jwt    # si quiere ver las citas en su calendario
```

Secretos (Supabase → Edge Functions → Secrets). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen.

| Secreto | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | El asistente (Claude). |
| `ADN_MODELO` | Opcional. Por defecto `claude-opus-5-5`; para menor costo, `claude-sonnet-5-5`. |
| `NEGOCIO_JSON` | `{"nombre":"…","giro":"…","asistente":"Vektor o el nombre que elija el dueño","conocimiento":"servicios, precios, horario, políticas…","agenda":true}` |
| `SITIO_URL` | `https://<sitio>/herramientas` (para el enlace de la cita) |
| `WA_TOKEN`, `WA_TELEFONO_ID`, `WA_SECRETO_APP`, `WA_VERIFICAR` | WhatsApp Cloud API (Meta). |
| `WA_PLANTILLA_RECORDATORIO` | Nombre de la plantilla aprobada (ver abajo). |
| `CRON_SECRETO` | Clave que manda el cron a `recordatorios`. |
| `TWILIO_AUTH_TOKEN`, `VOZ_URL_BASE`, `TRANSFERIR_A` | Recepcionista telefónica (opcional). |
| `FACTURAMA_USUARIO`, `FACTURAMA_CLAVE`, `FACTURAMA_SANDBOX`, `EMISOR_CP` | Autofactura. `FACTURAMA_SANDBOX=no` solo cuando ya timbró bien en pruebas. |

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

### Cobros por transferencia

1. La dueña guarda la cuenta (la escribe ella, nunca nosotros):
   `insert into ajustes (clave, valor) values ('cobro', '{"clabe":"…18 dígitos…","beneficiario":"…","dimo":""}') on conflict (clave) do update set valor = excluded.valor;`
   Si la CLABE no pasa el dígito de control, no se crean cobros ni se muestran datos de pago.
2. El equipo crea cada cobro con `crear_cobro(monto, concepto, tel)` → `referencia` y `token`.
   El enlace para el cliente es `https://<sitio>/herramientas/pagar.html#t=<token>`: los datos salen de la base,
   el enlace no los trae (así nadie puede mandar un enlace con otra CLABE en el dominio del negocio).
3. "Ya pagué" pasa el cobro a `avisado`. El equipo lo marca `pagado` al ver el dinero (o con la conciliación del
   estado de cuenta en `herramientas/cobro.html`).

### Autofactura

1. Cuenta de Facturama (PAC) con el CSD del negocio cargado. Probar primero en sandbox.
2. El negocio sube sus tickets a la tabla `tickets` (folio, fecha, total, forma de pago SAT, conceptos con IVA incluido).
   Desde su punto de venta, o a mano desde Table Editor.
3. El cliente entra a `herramientas/factura.html`, escribe folio, total y sus datos → `pedir_factura` revisa que el
   ticket exista, que el total coincida y que esté en plazo (mes de la compra + 3 días).
4. Cron cada 10 min: POST a `/functions/v1/facturas` con `x-cron: <CRON_SECRETO>`. Vuelve a validar el RFC con su
   dígito, timbra, guarda el UUID y manda la factura por correo. Si los datos están mal queda en `error` con el motivo;
   si Facturama falla, se reintenta hasta 3 veces. La dueña la regresa con `reintentar_factura(id)`.

### Citas en el calendario del teléfono

1. La dueña crea un enlace (uno por persona, o `null` para todo el negocio):
   `insert into calendarios (personal) values ('ana') returning token;`
2. En Google Calendar → Otros calendarios → Desde URL (o en el iPhone: Ajustes → Calendario → Cuentas → Agregar
   calendario suscrito): `https://<proyecto>.supabase.co/functions/v1/calendario?t=<token>`.
3. Muestra 14 días atrás y 90 adelante, con nombre y WhatsApp del cliente. Google lo refresca cada varias horas;
   el iPhone, según su ajuste. El enlace es secreto: si se filtra, se borra la fila y se crea otro.

## 4. Pendientes por conectar

- **Pantalla del equipo para cobros**: hoy `crear_cobro` se llama desde el servidor o el SQL Editor; falta su botón en
  la barra del negocio.
- **CoDi con QR**: depende del banco del negocio. Hoy: SPEI a la CLABE o DiMo al celular.
- **Reseñas**: leer y publicar respuestas requiere la API de Google Business Profile (OAuth del dueño).
  Hoy: invitación con enlace directo y respuestas que el dueño copia.
- **Google Calendar en dos sentidos** (que un evento del calendario bloquee la agenda): requiere OAuth del negocio.
  Hoy la agenda se ve en el calendario (ICS), pero los bloqueos se ponen en la tabla `bloqueos`.
