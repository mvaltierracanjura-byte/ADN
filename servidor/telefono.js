// Recepcionista telefónica con IA (Twilio Voice). Twilio convierte la voz del cliente en texto (<Gather speech>),
// el asistente (servidor/asistente.js) contesta y Twilio lo lee en voz alta (<Say>). Mismo cerebro que WhatsApp.
//
//   const tel = crearTelefono({ anthropic, negocio, herramientas, ejecutorPara, authToken, urlBase, transferirA?,
//                               sesiones?, ahora, alPasarAPersona?, modelo? })
//   await tel.atender({ ruta: "/telefono" | "/telefono/turno", params, firma })  → { status, xml }
//
// Twilio llama a POST {urlBase}/telefono al entrar la llamada y a {urlBase}/telefono/turno con lo que dijo el cliente.
// Cada petición trae X-Twilio-Signature: se valida con el authToken antes de hacer nada.
import { conversar } from "./asistente.js";
import { detectarIdioma } from "../kit/idioma.js";
import { limpiarTel } from "../kit/agenda.js";

const VOZ = { es: { language: "es-MX", voice: "Polly.Mia-Neural" }, en: { language: "en-US", voice: "Polly.Joanna-Neural" } };
const FRASES = {
  es: {
    saludo: (n) => `Hola, gracias por llamar a ${n}. Soy la asistente virtual. ¿En qué te puedo ayudar?`,
    silencio: "¿Sigues ahí? Dime en qué te ayudo.",
    adios: "No te escuché. Puedes volver a llamar o escribirnos por WhatsApp. ¡Hasta luego!",
    transferir: "Te comunico con alguien del equipo, un momento por favor.",
    devolver: "Le paso tu mensaje al equipo y te devolvemos la llamada pronto. ¡Gracias!",
    error: "Perdón, tuve un problema. Te devolvemos la llamada pronto.",
  },
  en: {
    saludo: (n) => `Hi, thanks for calling ${n}. I'm the virtual assistant. How can I help you?`,
    silencio: "Are you still there? Tell me how I can help.",
    adios: "I couldn't hear you. Feel free to call again or message us on WhatsApp. Goodbye!",
    transferir: "Let me connect you with someone on the team, one moment please.",
    devolver: "I'll pass your message to the team and we'll call you back soon. Thank you!",
    error: "Sorry, something went wrong. We'll call you back soon.",
  },
};

export const escXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

// Firma de Twilio: HMAC-SHA1(authToken, url + cada parámetro (llave+valor) en orden alfabético), en base64.
export async function firmaTwilio(authToken, url, params) {
  const datos = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(datos)));
  return btoa(String.fromCharCode(...firma));
}
function igualesSeguro(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function memoria() {
  const m = new Map();
  return { obtener: async (k) => m.get(k) || null, guardar: async (k, v) => { m.set(k, v); } };
}

export function crearTelefono({ anthropic, negocio, herramientas = [], ejecutorPara = () => async () => ({}), authToken, urlBase,
  transferirA = null, sesiones = memoria(), ahora, alPasarAPersona = async () => {}, modelo }) {
  const decir = (idioma, texto) => `<Say language="${VOZ[idioma].language}" voice="${VOZ[idioma].voice}">${escXml(texto)}</Say>`;
  const escuchar = (idioma, texto) =>
    `<Gather input="speech" language="${VOZ[idioma].language}" speechTimeout="auto" action="${escXml(urlBase)}/telefono/turno" method="POST">${decir(idioma, texto)}</Gather>` +
    `<Redirect method="POST">${escXml(urlBase)}/telefono/turno</Redirect>`;
  const respuesta = (cuerpo) => ({ status: 200, xml: `<?xml version="1.0" encoding="UTF-8"?><Response>${cuerpo}</Response>` });

  async function aPersona(s, idioma, motivo, texto) {
    await alPasarAPersona({ tel: s.tel, motivo, historial: s.historial });
    const previo = texto ? decir(idioma, texto) : "";
    return transferirA
      ? respuesta(previo + decir(idioma, FRASES[idioma].transferir) + `<Dial>${escXml(transferirA)}</Dial>`)
      : respuesta(previo + decir(idioma, FRASES[idioma].devolver) + "<Hangup/>");
  }

  return {
    async atender({ ruta, params, firma }) {
      const url = urlBase + ruta;
      if (!authToken || !igualesSeguro(firma, await firmaTwilio(authToken, url, params))) return { status: 403, xml: "" };
      const id = params.CallSid;
      if (ruta === "/telefono") {
        const s = { tel: limpiarTel(params.From || ""), idioma: "es", historial: [], silencios: 0 };
        await sesiones.guardar(id, s);
        return respuesta(escuchar("es", FRASES.es.saludo(negocio.nombre)));
      }
      if (ruta !== "/telefono/turno") return { status: 404, xml: "" };
      const s = (await sesiones.obtener(id)) || { tel: limpiarTel(params.From || ""), idioma: "es", historial: [], silencios: 0 };
      const dicho = (params.SpeechResult || "").trim();
      if (!dicho) {
        s.silencios++;
        await sesiones.guardar(id, s);
        return s.silencios >= 2 ? respuesta(decir(s.idioma, FRASES[s.idioma].adios) + "<Hangup/>") : respuesta(escuchar(s.idioma, FRASES[s.idioma].silencio));
      }
      s.silencios = 0;
      s.idioma = detectarIdioma(dicho, s.idioma);
      s.historial.push({ autor: "cliente", texto: dicho });
      try {
        const r = await conversar({ anthropic, negocio, historial: s.historial, herramientas, ejecutar: ejecutorPara(s.tel), ahora: ahora(), canal: "telefono", ...(modelo ? { modelo } : {}) });
        if (r.texto) s.historial.push({ autor: "asistente", texto: r.texto });
        await sesiones.guardar(id, s);
        if (r.accion === "persona") return aPersona(s, s.idioma, r.motivo, r.texto);
        return respuesta(escuchar(s.idioma, r.texto));
      } catch (e) {
        await sesiones.guardar(id, s);
        return aPersona(s, s.idioma, "Error del sistema: " + e.message, FRASES[s.idioma].error);
      }
    },
  };
}
