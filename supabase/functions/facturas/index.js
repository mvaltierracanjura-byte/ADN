// Edge Function: timbra las autofacturas pendientes con Facturama. Programarla cada 5–10 min (Supabase → Cron)
// con la cabecera "x-cron: <CRON_SECRETO>".
// Secretos: FACTURAMA_USUARIO, FACTURAMA_CLAVE, FACTURAMA_SANDBOX ("no" = producción), EMISOR_CP, CRON_SECRETO
import { timbrarPendientes } from "../_adn/servidor/facturas.js";

const env = (k) => Deno.env.get(k) || "";
Deno.serve(async (req) => {
  if (!env("CRON_SECRETO") || req.headers.get("x-cron") !== env("CRON_SECRETO")) return new Response("no", { status: 401 });
  const r = await timbrarPendientes({
    fetch,
    supabase: { url: env("SUPABASE_URL"), llaveServicio: env("SUPABASE_SERVICE_ROLE_KEY") },
    facturama: { usuario: env("FACTURAMA_USUARIO"), clave: env("FACTURAMA_CLAVE"), sandbox: env("FACTURAMA_SANDBOX") !== "no" },
    emisor: { cp: env("EMISOR_CP") },
  });
  return Response.json(r);
});
