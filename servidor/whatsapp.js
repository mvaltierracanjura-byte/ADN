// Recibe los avisos de WhatsApp (API oficial de Meta), contesta con el asistente y guarda todo.
//
//   verificarFirma(secretoApp, cuerpoCrudo, cabecera "x-hub-signature-256")  → boolean
//   extraerMensajes(payload)  → [{ id, tel, nombre, texto, tipo }]   (ignora estados de entrega)
//   atenderMensaje({ anthropic, db, wa, negocio, herramientas, ejecutorPara, ahora, mensaje })
//     db  { yaProcesado(id), historial(tel, n), guardar(tel, autor, texto, idMeta?), enPersona(tel), pasarAPersona(tel, motivo) }
//     wa  { token, telefonoId, version? , fetch }
//   → { respondido: boolean, accion }
import { conversar } from "./asistente.js";
import { detectarIdioma } from "../kit/idioma.js";
import { limpiarTel } from "../kit/agenda.js";

export async function verificarFirma(secretoApp, cuerpo, cabecera) {
  if (!secretoApp || !cabecera || !cabecera.startsWith("sha256=")) return false;
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretoApp), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(cuerpo)));
  const esperada = "sha256=" + [...firma].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (esperada.length !== cabecera.length) return false;
  let d = 0;
  for (let i = 0; i < esperada.length; i++) d |= esperada.charCodeAt(i) ^ cabecera.charCodeAt(i);
  return d === 0;
}

export function extraerMensajes(payload) {
  const salida = [];
  for (const e of payload?.entry || []) for (const c of e.changes || []) {
    const v = c.value || {};
    const nombres = Object.fromEntries((v.contacts || []).map((k) => [k.wa_id, k.profile?.name || ""]));
    for (const m of v.messages || []) {
      let texto = null;
      if (m.type === "text") texto = m.text?.body;
      else if (m.type === "button") texto = m.button?.text;
      else if (m.type === "interactive") texto = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title;
      salida.push({ id: m.id, tel: limpiarTel(m.from), nombre: nombres[m.from] || "", texto: texto ?? null, tipo: m.type });
    }
  }
  return salida;
}

const AVISO_PERSONA = {
  es: "Gracias por escribir. Una persona del equipo te contesta en cuanto pueda.",
  en: "Thanks for your message. Someone from the team will reply as soon as possible.",
};
const SOLO_TEXTO = {
  es: "Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?",
  en: "For now I can only read text messages. Could you type it, please?",
};

export async function enviarTexto(wa, tel, texto) {
  const r = await wa.fetch(`https://graph.facebook.com/${wa.version || "v23.0"}/${wa.telefonoId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${wa.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: "52" + tel, type: "text", text: { body: texto } }),
  });
  if (!r.ok) throw new Error(`WhatsApp respondió ${r.status}`);
}

export async function atenderMensaje({ anthropic, db, wa, negocio, herramientas = [], ejecutorPara = () => async () => ({}), ahora, mensaje, modelo }) {
  if (!mensaje.tel) return { respondido: false, accion: "ignorado" };
  if (await db.yaProcesado(mensaje.id)) return { respondido: false, accion: "repetido" }; // Meta reintenta avisos
  const previo = await db.historial(mensaje.tel, 30);
  const idioma = detectarIdioma(mensaje.texto || "", detectarIdioma(previo.filter((m) => m.autor === "cliente").map((m) => m.texto).join(" ")));
  await db.guardar(mensaje.tel, "cliente", mensaje.texto ?? `[${mensaje.tipo}]`, mensaje.id);

  // Si una persona ya tomó la plática, el asistente no se mete.
  if (await db.enPersona(mensaje.tel)) return { respondido: false, accion: "persona" };
  if (!mensaje.texto) {
    await enviarTexto(wa, mensaje.tel, SOLO_TEXTO[idioma]);
    await db.guardar(mensaje.tel, "asistente", SOLO_TEXTO[idioma]);
    return { respondido: true, accion: null };
  }
  const historial = [...previo, { autor: "cliente", texto: mensaje.texto }];
  let r;
  try {
    r = await conversar({ anthropic, negocio, historial, herramientas, ejecutar: ejecutorPara(mensaje.tel), ahora: ahora(), canal: "whatsapp", ...(modelo ? { modelo } : {}) });
  } catch (e) {
    r = { texto: null, accion: "persona", motivo: "Error del sistema: " + e.message };
  }
  if (r.accion === "persona") {
    await db.pasarAPersona(mensaje.tel, r.motivo || "");
    const texto = r.texto ? `${r.texto}\n\n${AVISO_PERSONA[idioma]}` : AVISO_PERSONA[idioma];
    await enviarTexto(wa, mensaje.tel, texto);
    await db.guardar(mensaje.tel, "asistente", texto);
    return { respondido: true, accion: "persona" };
  }
  await enviarTexto(wa, mensaje.tel, r.texto);
  await db.guardar(mensaje.tel, "asistente", r.texto);
  return { respondido: true, accion: null };
}
