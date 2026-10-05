import { formatoClabe, bancoDeClabe, validarClabe } from "../kit/cobro.js";
const $ = (s) => document.querySelector(s);
const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
let d = null;
try { d = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))); } catch (e) {}
if (!d || !validarClabe(d.c).ok) {
  $("#monto").textContent = "Este enlace de pago no es válido.";
  $("#pague").hidden = true;
} else {
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
  $("#pague").addEventListener("click", () => { $("#gracias").hidden = false; $("#pague").hidden = true; });
}
