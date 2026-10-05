// Edge Function: recepcionista telefónica (Twilio). Configura en Twilio el número con
// "A call comes in" → POST https://<proyecto>.supabase.co/functions/v1/voz/telefono
// Secretos: ANTHROPIC_API_KEY, TWILIO_AUTH_TOKEN, VOZ_URL_BASE (= https://<proyecto>.supabase.co/functions/v1/voz),
// TRANSFERIR_A (opcional, +52…), NEGOCIO_JSON, SITIO_URL, ADN_MODELO (opcional)
import Anthropic from "npm:@anthropic-ai/sdk";
import { crearTelefono } from "../_adn/servidor/telefono.js";
import { dbSupabase } from "../_adn/servidor/db-supabase.js";
import { DEFINICIONES, ejecutorAgenda } from "../_adn/servidor/herramientas-agenda.js";
import { almacenAgenda } from "../_adn/kit/almacen-agenda.js";
import { ahoraLocal } from "../_adn/kit/agenda.js";

const env = (k) => Deno.env.get(k) || "";
const db = dbSupabase({ url: env("SUPABASE_URL"), llaveServicio: env("SUPABASE_SERVICE_ROLE_KEY"), fetch });
const negocio = JSON.parse(env("NEGOCIO_JSON") || "{}");
const almacen = almacenAgenda({ supabase: { url: env("SUPABASE_URL"), anonKey: env("SUPABASE_SERVICE_ROLE_KEY") } });
const tel = crearTelefono({
  anthropic: new Anthropic(), negocio, authToken: env("TWILIO_AUTH_TOKEN"), urlBase: env("VOZ_URL_BASE"),
  transferirA: env("TRANSFERIR_A") || null, sesiones: db.llamadas, ahora: () => ahoraLocal(), modelo: env("ADN_MODELO") || undefined,
  herramientas: negocio.agenda ? DEFINICIONES : [],
  ejecutorPara: (t) => ejecutorAgenda({ almacen, tel: t, enlaceBase: env("SITIO_URL") + "/cita.html#" }),
  alPasarAPersona: async ({ tel: t, motivo, historial }) => {
    if (!t) return;
    for (const m of historial) await db.whatsapp.guardar(t, m.autor === "cliente" ? "cliente" : "asistente", "[llamada] " + m.texto);
    await db.whatsapp.pasarAPersona(t, "Llamada: " + motivo);
  },
});

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const ruta = u.pathname.replace(/^.*\/voz/, "") || "/telefono";
  const params = Object.fromEntries(new URLSearchParams(await req.text()));
  const r = await tel.atender({ ruta, params, firma: req.headers.get("x-twilio-signature") || "" });
  return new Response(r.xml, { status: r.status, headers: { "Content-Type": "text/xml" } });
});
