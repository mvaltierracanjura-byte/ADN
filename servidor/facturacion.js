// Timbrar con Facturama (proveedor autorizado de certificación). Se usa sandbox hasta tener la cuenta real.
// Revisa la documentación vigente de Facturama antes de producción: https://apisandbox.facturama.mx/guias
//   timbrar({ fetch, usuario, clave, sandbox, solicitud }) → { id, uuid, total }
//   enviarPorCorreo({ fetch, usuario, clave, sandbox, id, correo })
const base = (sandbox) => (sandbox ? "https://apisandbox.facturama.mx" : "https://api.facturama.mx");
const auth = (u, c) => "Basic " + btoa(`${u}:${c}`);

export async function timbrar({ fetch, usuario, clave, sandbox = true, solicitud }) {
  const r = await fetch(`${base(sandbox)}/3/cfdis`, {
    method: "POST", headers: { Authorization: auth(usuario, clave), "Content-Type": "application/json" }, body: JSON.stringify(solicitud),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detalle = d.ModelState ? Object.values(d.ModelState).flat().join(" ") : d.Message || `Error ${r.status}`;
    throw new Error("No se pudo timbrar: " + detalle);
  }
  return { id: d.Id, uuid: d.Complement?.TaxStamp?.Uuid || null, total: d.Total };
}

export async function enviarPorCorreo({ fetch, usuario, clave, sandbox = true, id, correo }) {
  const r = await fetch(`${base(sandbox)}/cfdi?cfdiType=issued&cfdiId=${encodeURIComponent(id)}&email=${encodeURIComponent(correo)}`, {
    method: "POST", headers: { Authorization: auth(usuario, clave) },
  });
  if (!r.ok) throw new Error(`No se pudo enviar el correo (${r.status}).`);
  return true;
}
