// Adaptador del servidor a Supabase (PostgREST con la llave de servicio). Solo vive en el servidor.
//   const db = dbSupabase({ url, llaveServicio, fetch })
//   db.whatsapp      → la interfaz que pide servidor/whatsapp.js
//   db.llamadas      → { obtener, guardar } para servidor/telefono.js
//   db.porEnviar()   → respuestas del equipo pendientes de mandar; db.marcarEnviado(id)
export function dbSupabase({ url, llaveServicio, fetch }) {
  const h = { apikey: llaveServicio, Authorization: `Bearer ${llaveServicio}`, "Content-Type": "application/json" };
  const pedir = async (ruta, op = {}) => {
    const r = await fetch(url + "/rest/v1" + ruta, { ...op, headers: { ...h, ...(op.headers || {}) } });
    const t = await r.text();
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
  const asegurar = (tel) => pedir(`/conversaciones?on_conflict=tel`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ tel }) });
  return {
    whatsapp: {
      async yaProcesado(id) { return id ? (await pedir(`/mensajes?id_meta=eq.${encodeURIComponent(id)}&select=id`)).length > 0 : false; },
      async historial(tel, n = 30) {
        const filas = await pedir(`/mensajes?tel=eq.${tel}&select=autor,texto&order=creado.desc&limit=${n}`);
        return filas.reverse();
      },
      async guardar(tel, autor, texto, idMeta = null) {
        await asegurar(tel);
        await pedir(`/mensajes`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ tel, autor, texto, id_meta: idMeta }) });
        await pedir(`/conversaciones?tel=eq.${tel}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ actualizado: new Date().toISOString() }) });
      },
      async enPersona(tel) { return (await pedir(`/conversaciones?tel=eq.${tel}&select=estado`))[0]?.estado === "persona"; },
      async pasarAPersona(tel, motivo) {
        await asegurar(tel);
        await pedir(`/conversaciones?tel=eq.${tel}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ estado: "persona", motivo, actualizado: new Date().toISOString() }) });
      },
    },
    llamadas: {
      async obtener(sid) { return (await pedir(`/llamadas?call_sid=eq.${encodeURIComponent(sid)}&select=datos`))[0]?.datos || null; },
      async guardar(sid, datos) {
        await pedir(`/llamadas?on_conflict=call_sid`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ call_sid: sid, datos, actualizado: new Date().toISOString() }) });
      },
    },
    async porEnviar() { return pedir(`/mensajes?autor=eq.equipo&enviado=eq.false&select=id,tel,texto&order=creado`); },
    async marcarEnviado(id) { await pedir(`/mensajes?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ enviado: true }) }); },
  };
}
