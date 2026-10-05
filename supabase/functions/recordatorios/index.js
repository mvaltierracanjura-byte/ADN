// Edge Function: manda los recordatorios de citas. Programarla cada hora (Supabase → Cron, o pg_cron + pg_net)
// con la cabecera "x-cron: <CRON_SECRETO>".
// Secretos: WA_TOKEN, WA_TELEFONO_ID, WA_PLANTILLA_RECORDATORIO, CRON_SECRETO, NEGOCIO_JSON, SITIO_URL
import { enviarRecordatorios } from "../_adn/servidor/recordatorios.js";

const env = (k) => Deno.env.get(k) || "";
Deno.serve(async (req) => {
  if (!env("CRON_SECRETO") || req.headers.get("x-cron") !== env("CRON_SECRETO")) return new Response("no", { status: 401 });
  const r = await enviarRecordatorios({
    fetch,
    supabase: { url: env("SUPABASE_URL"), llaveServicio: env("SUPABASE_SERVICE_ROLE_KEY") },
    whatsapp: { token: env("WA_TOKEN"), telefonoId: env("WA_TELEFONO_ID"), plantilla: env("WA_PLANTILLA_RECORDATORIO") || "recordatorio_cita" },
    enlaceBase: env("SITIO_URL") + "/cita.html#",
    negocio: JSON.parse(env("NEGOCIO_JSON") || "{}").nombre || "",
  });
  return Response.json(r);
});
