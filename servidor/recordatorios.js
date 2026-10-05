// Recordatorios de citas por WhatsApp (API oficial de Meta). Corre cada hora en el servidor
// (Supabase Edge Function con cron, ver supabase/LEEME.md).
//
//   enviarRecordatorios({ fetch, supabase, whatsapp, enlaceBase, horas, negocio })
//     supabase  { url, llaveServicio }   la llave de servicio salta RLS: solo vive en el servidor
//     whatsapp  { token, telefonoId, plantilla, idioma, version? }
//     enlaceBase "https://tusitio/cita.html#"  (se le pega el token de la cita)
//   → { enviados: [id], fallidos: [{ id, error }] }
//
// WhatsApp exige plantilla aprobada para escribir fuera de la ventana de 24 h. Plantilla sugerida
// (categoría "utilidad", ~MXN 0.16 por mensaje en México desde oct 2026):
//   Hola, {{1}}. Te recordamos tu cita en {{2}}: {{3}}, el {{4}} a las {{5}}.
//   Confirma, cambia o cancela aquí: {{6}}
import { fechaLarga, horaBonita } from "../kit/agenda.js";

export async function enviarRecordatorios({ fetch, supabase, whatsapp, enlaceBase, horas = 24, negocio }) {
  const h = { apikey: supabase.llaveServicio, Authorization: `Bearer ${supabase.llaveServicio}`, "Content-Type": "application/json" };
  const r = await fetch(`${supabase.url}/rest/v1/rpc/citas_por_recordar`, { method: "POST", headers: h, body: JSON.stringify({ horas }) });
  if (!r.ok) throw new Error(`No pude leer las citas (${r.status}).`);
  const citas = await r.json();
  const enviados = [], fallidos = [];
  for (const c of citas) {
    const [fecha, hora] = String(c.inicio).replace(" ", "T").split("T");
    const parametros = [
      c.cliente_nombre.split(" ")[0], negocio, `${c.servicio} con ${c.personal}`,
      fechaLarga(fecha), horaBonita(hora.slice(0, 5)), enlaceBase + c.token,
    ];
    try {
      const w = await fetch(`https://graph.facebook.com/${whatsapp.version || "v23.0"}/${whatsapp.telefonoId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${whatsapp.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: "52" + c.cliente_tel, type: "template",
          template: { name: whatsapp.plantilla, language: { code: whatsapp.idioma || "es_MX" },
            components: [{ type: "body", parameters: parametros.map((text) => ({ type: "text", text })) }] },
        }),
      });
      if (!w.ok) throw new Error(`WhatsApp respondió ${w.status}: ${(await w.text()).slice(0, 200)}`);
      // Se marca solo si WhatsApp lo aceptó: si falla, la siguiente vuelta lo intenta otra vez.
      const m = await fetch(`${supabase.url}/rest/v1/citas?id=eq.${encodeURIComponent(c.id)}`, {
        method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ recordada: true }),
      });
      if (!m.ok) throw new Error(`Enviado, pero no pude marcarlo (${m.status}).`);
      enviados.push(c.id);
    } catch (e) {
      fallidos.push({ id: c.id, error: e.message });
    }
  }
  return { enviados, fallidos };
}
