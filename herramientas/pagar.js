// Página de pago que ve el cliente.
// - Negocio conectado (kit/config.js → SUPABASE): el enlace trae solo #t=<token>; CLABE, beneficiario y monto
//   salen de la base (cobro_por_token), así nadie puede armar un enlace con otra CLABE en este dominio.
// - Sitio de ADN (demo): los datos vienen en el enlace, con aviso de que es un ejemplo.
import { formatoClabe, bancoDeClabe, validarClabe } from "../kit/cobro.js";
import { SUPABASE } from "../kit/config.js";
const $ = (s) => document.querySelector(s);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const rpc = async (fn, args) => {
  const r = await fetch(`${SUPABASE.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error("No pudimos conectar.");
  return r.json();
};

async function leer() {
  if (SUPABASE) {
    $("#aviso-demo").hidden = true;
    const t = new URLSearchParams(location.hash.slice(1)).get("t") || "";
    if (!/^[0-9a-f]{24}$/.test(t)) return null;
    const [c] = await rpc("cobro_por_token", { t });
    return c ? { n: c.negocio, b: c.beneficiario, c: c.clabe, m: +c.monto, k: c.concepto, r: c.referencia, d: c.dimo, estado: c.estado, t } : null;
  }
  try { return JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))); } catch (e) { return null; }
}

function invalido(texto) { $("#monto").textContent = texto; $("#pague").hidden = true; }

const d = await leer().catch(() => null);
if (!d || !validarClabe(d.c).ok) invalido("Este enlace de pago no es válido.");
else if (d.estado === "cancelado") { $("#negocio").textContent = d.n; invalido("Este cobro fue cancelado."); }
else {
  $("#negocio").textContent = d.n;
  $("#monto").textContent = pesos(d.m);
  const filas = [["CLABE", formatoClabe(d.c), d.c], ["Banco", bancoDeClabe(d.c)], ["Beneficiario", d.b], ["Concepto", d.k, d.k], ["Referencia", d.r, d.r]];
  if (d.d) filas.push(["DiMo (celular)", d.d, d.d.replace(/\D/g, "")]);
  const cont = $("#datos");
  for (const [et, val, copiar] of filas) {
    const p = document.createElement("div");
    p.className = "quien"; p.style.cssText = "justify-content:space-between;border-bottom:1px solid var(--line);padding:10px 0";
    p.innerHTML = `<span><span class="sub"></span><br><b></b></span>`;
    p.querySelector(".sub").textContent = et; p.querySelector("b").textContent = val;
    if (copiar) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "boton claro"; b.style.cssText = "padding:6px 12px;font-size:.85rem"; b.textContent = "Copiar";
      b.addEventListener("click", () => navigator.clipboard.writeText(copiar).then(() => { b.textContent = "Copiado"; }, () => { b.textContent = "Selecciónalo"; }));
      p.appendChild(b);
    }
    cont.appendChild(p);
  }
  const gracias = () => { $("#gracias").hidden = false; $("#pague").hidden = true; };
  if (d.estado === "pagado") { gracias(); $("#gracias").querySelector("span").textContent = "Este cobro ya está pagado."; }
  else if (d.estado === "avisado") gracias();
  $("#pague").addEventListener("click", async () => {
    if (d.t) { try { await rpc("avisar_pago", { t: d.t }); } catch (e) { $("#pague").textContent = "No pudimos avisar. Intenta otra vez"; return; } }
    gracias();
  });
}
