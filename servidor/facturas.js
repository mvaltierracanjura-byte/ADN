// Timbra las solicitudes de autofactura pendientes (tabla `facturas`) con Facturama y las manda por correo.
// Corre cada pocos minutos en el servidor (función `facturas` con cron, ver supabase/LEEME.md).
//
//   timbrarPendientes({ fetch, supabase: { url, llaveServicio }, facturama: { usuario, clave, sandbox }, emisor: { cp, claveProducto? } })
//   → { timbradas: [id], errores: [{ id, error }] }
//
// Antes de timbrar se vuelve a validar al receptor con kit/cfdi.js (dígito del RFC, régimen y uso por tipo):
// la página también lo hace, pero la base acepta lo que le manden. Un dato mal escrito queda en 'error' con
// el motivo para que el negocio le escriba al cliente; un fallo de Facturama se reintenta (hasta 3 veces).
import { validarReceptor, solicitudFacturama } from "../kit/cfdi.js";
import { timbrar, enviarPorCorreo } from "./facturacion.js";

export async function timbrarPendientes({ fetch, supabase, facturama, emisor }) {
  const h = { apikey: supabase.llaveServicio, Authorization: `Bearer ${supabase.llaveServicio}`, "Content-Type": "application/json" };
  const r = await fetch(`${supabase.url}/rest/v1/rpc/facturas_por_timbrar`, { method: "POST", headers: h, body: "{}" });
  if (!r.ok) throw new Error(`No pude leer las solicitudes (${r.status}).`);
  const marcar = async (id, campos) => {
    const m = await fetch(`${supabase.url}/rest/v1/facturas?id=eq.${id}`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(campos) });
    if (!m.ok) throw new Error(`No pude actualizar la factura ${id} (${m.status}).`);
  };
  const timbradas = [], errores = [];
  for (const f of await r.json()) {
    const v = validarReceptor({ rfc: f.rfc, nombre: f.nombre, cp: f.cp, regimen: f.regimen, uso: f.uso });
    if (!v.ok) {
      const error = "Datos fiscales: " + Object.values(v.errores).join(" ");
      await marcar(f.id, { estado: "error", intentos: 3, error });
      errores.push({ id: f.id, error });
      continue;
    }
    try {
      const solicitud = solicitudFacturama({ receptor: v.datos, items: f.items, emisor, formaPago: f.forma_pago, folio: f.folio });
      const t = await timbrar({ fetch, ...facturama, solicitud });
      // Timbrada ya es definitiva: se guarda antes de mandar el correo, para no timbrar dos veces si el correo falla.
      await marcar(f.id, { estado: "timbrada", uuid: t.uuid, facturama_id: t.id, timbrada: new Date().toISOString(), error: null });
      timbradas.push(f.id);
      try { await enviarPorCorreo({ fetch, ...facturama, id: t.id, correo: f.correo }); }
      catch (e) { await marcar(f.id, { error: "Timbrada, pero el correo falló: " + e.message }); }
    } catch (e) {
      const intentos = (f.intentos || 0) + 1;
      await marcar(f.id, { intentos, ...(intentos >= 3 ? { estado: "error" } : {}), error: e.message });
      errores.push({ id: f.id, error: e.message });
    }
  }
  return { timbradas, errores };
}
