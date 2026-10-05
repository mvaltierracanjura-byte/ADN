// Edge Function: avisos de WhatsApp (Meta) → asistente. Antes de publicar: node scripts/preparar-funciones.mjs
// Secretos: ANTHROPIC_API_KEY, WA_TOKEN, WA_TELEFONO_ID, WA_SECRETO_APP, WA_VERIFICAR, NEGOCIO_JSON, SITIO_URL, ADN_MODELO (opcional)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase.
import Anthropic from "npm:@anthropic-ai/sdk";
import { verificarFirma, extraerMensajes, atenderMensaje, enviarTexto } from "../_adn/servidor/whatsapp.js";
import { dbSupabase } from "../_adn/servidor/db-supabase.js";
import { DEFINICIONES, ejecutorAgenda } from "../_adn/servidor/herramientas-agenda.js";
import { almacenAgenda } from "../_adn/kit/almacen-agenda.js";
import { ahoraLocal } from "../_adn/kit/agenda.js";

const env = (k) => Deno.env.get(k) || "";
const anthropic = new Anthropic();
const db = dbSupabase({ url: env("SUPABASE_URL"), llaveServicio: env("SUPABASE_SERVICE_ROLE_KEY"), fetch });
const wa = { token: env("WA_TOKEN"), telefonoId: env("WA_TELEFONO_ID"), fetch };
const negocio = JSON.parse(env("NEGOCIO_JSON") || "{}"); // { nombre, giro, conocimiento, agenda: true|false }
const almacen = almacenAgenda({ supabase: { url: env("SUPABASE_URL"), anonKey: env("SUPABASE_SERVICE_ROLE_KEY") } });

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET") { // verificación del webhook en Meta
    return u.searchParams.get("hub.verify_token") === env("WA_VERIFICAR") ? new Response(u.searchParams.get("hub.challenge")) : new Response("no", { status: 403 });
  }
  const cuerpo = await req.text();
  if (!(await verificarFirma(env("WA_SECRETO_APP"), cuerpo, req.headers.get("x-hub-signature-256")))) return new Response("firma", { status: 401 });
  for (const mensaje of extraerMensajes(JSON.parse(cuerpo))) {
    try {
      await atenderMensaje({ anthropic, db: db.whatsapp, wa, negocio, mensaje, ahora: () => ahoraLocal(), modelo: env("ADN_MODELO") || undefined,
        herramientas: negocio.agenda ? DEFINICIONES : [],
        ejecutorPara: (tel) => ejecutorAgenda({ almacen, tel, enlaceBase: env("SITIO_URL") + "/cita.html#" }) });
    } catch (e) { console.error("mensaje", mensaje.id, e.message); }
  }
  // De paso, manda lo que el equipo escribió desde el panel.
  for (const m of await db.porEnviar()) {
    try { await enviarTexto(wa, m.tel, m.texto); await db.marcarEnviado(m.id); } catch (e) { console.error("equipo", m.id, e.message); }
  }
  return new Response("ok"); // Meta reintenta si no recibe 200
});
