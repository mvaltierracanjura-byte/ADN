// Edge Function: calendario de citas en formato ICS para suscribirse desde Google Calendar, iPhone u Outlook.
//   https://<proyecto>.supabase.co/functions/v1/calendario?t=<token de la tabla calendarios>
// Publicar con --no-verify-jwt (el calendario del teléfono no manda sesión; el token secreto es la llave).
// Secretos: NEGOCIO_JSON (para el nombre del calendario)
import { calendarioIcs } from "../_adn/kit/ics.js";

const env = (k) => Deno.env.get(k) || "";
Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{32}$/.test(t)) return new Response("no", { status: 404 });
  const llave = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/citas_calendario`, {
    method: "POST", headers: { apikey: llave, Authorization: `Bearer ${llave}`, "Content-Type": "application/json" }, body: JSON.stringify({ t }),
  });
  if (!r.ok) return new Response("error", { status: 502 });
  const citas = await r.json();
  const nombre = JSON.parse(env("NEGOCIO_JSON") || "{}").nombre || "Citas";
  return new Response(calendarioIcs({ nombre: `${nombre} · citas`, citas }), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
});
