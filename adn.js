// ADN — comportamiento compartido (módulo). Cada parte revisa si su sección existe en la página.
import { detectarIdioma } from "./kit/idioma.js";

(function () {
  const ADN = window.ADN;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const COLOR = { A: "var(--a)", T: "var(--t)", C: "var(--c)", G: "var(--g)" };
  const raiz = document.body.dataset.raiz || ""; // "../" en páginas dentro de carpetas
  const waUrl = (texto) => `https://wa.me/${ADN.contacto.whatsapp}?text=${encodeURIComponent(texto)}`;
  const pesos = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // Enlaces de WhatsApp y correo
  $$("a[data-wa]").forEach((a) => { a.href = waUrl(a.dataset.wa || "Hola, ADN."); a.target = "_blank"; a.rel = "noopener"; });
  $$("[data-correo]").forEach((el) => { el.textContent = ADN.contacto.correo; });
  $$("[data-tel]").forEach((el) => { el.textContent = ADN.contacto.whatsappTexto; });

  // Menú del celular
  const btnMenu = $(".abrir-menu"), menu = $(".menu");
  if (btnMenu && menu) {
    btnMenu.addEventListener("click", () => {
      const abierto = menu.classList.toggle("abierto");
      btnMenu.setAttribute("aria-expanded", abierto);
      btnMenu.textContent = abierto ? "✕" : "☰";
    });
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) { menu.classList.remove("abierto"); btnMenu.setAttribute("aria-expanded", false); btnMenu.textContent = "☰"; }
    });
  }

  // Las cuatro bases
  const bases = $("#bases");
  if (bases) {
    bases.innerHTML = ADN.bases.map((b) => `
      <div class="base-col" style="--col:${COLOR[b.letra]}">
        <span class="letra" aria-hidden="true">${b.letra}</span>
        <h3>${esc(b.nombre)}</h3>
        <p>${esc(b.frase)}</p>
        <ul>${b.servicios.map((s) => `<li>${esc(s.t)}${s.nuevo ? '<span class="nuevo" style="display:inline-block">nuevo</span>' : ""}<span>${esc(s.d)}</span></li>`).join("")}</ul>
      </div>`).join("");
  }

  // Giros (pestañas en la portada)
  const lista = $("#lista-giros"), ficha = $("#ficha");
  if (lista && ficha) {
    const mostrar = (id) => {
      const g = ADN.giros.find((x) => x.id === id) || ADN.giros[0];
      $$("button", lista).forEach((b) => { const sel = b.dataset.giro === g.id; b.setAttribute("aria-selected", sel); b.tabIndex = sel ? 0 : -1; });
      ficha.setAttribute("aria-labelledby", "tab-" + g.id);
      ficha.innerHTML =
        `<h3 style="font-size:1.35rem">${esc(g.nombre)}</h3>` +
        `<p class="dolor">${esc(g.dolor)}</p>` +
        `<div style="display:grid;gap:10px"><p class="ceja">Lo que construiríamos</p><ul>` +
        g.hace.map(([b, t]) => `<li><span class="chip" style="--col:${COLOR[b]}">${b}</span><span>${esc(t)}</span></li>`).join("") +
        `</ul></div>` +
        `<p class="dato">${esc(g.dato)}${g.fuente ? ` Fuente: <a href="${g.fuente[1]}" target="_blank" rel="noopener">${esc(g.fuente[0])}</a>.` : ""}</p>` +
        `<div class="acciones" style="margin-top:0"><a class="boton claro" href="${raiz}giros/${g.id}.html">Ver todo para ${esc(g.corto.toLowerCase())}</a></div>`;
      guardar("adn-giro", g.id);
    };
    ADN.giros.forEach((g) => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.id = "tab-" + g.id; b.dataset.giro = g.id;
      b.setAttribute("aria-controls", "ficha"); b.textContent = g.nombre;
      b.addEventListener("click", () => mostrar(g.id));
      lista.appendChild(b);
    });
    lista.addEventListener("keydown", (e) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const bs = $$("button", lista), i = bs.indexOf(document.activeElement);
      const sig = bs[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length];
      sig.focus(); mostrar(sig.dataset.giro);
    });
    mostrar(leer("adn-giro") || ADN.giros[0].id);
  }

  // Demo de Vektor con un negocio de ejemplo (respuestas fijas, sin inteligencia artificial real).
  const chat = $("#chat");
  if (chat) {
    const NEGOCIO = {
      productos: [
        { id: "matcha", nombre: "Matcha latte", precio: 75, claves: ["matcha"] },
        { id: "frappe", nombre: "Frappé de caramelo", precio: 80, claves: ["frappe"] },
        { id: "americano", nombre: "Americano", precio: 50, claves: ["americano"] },
        { id: "latte", nombre: "Latte", precio: 65, claves: ["latte", "lattes"] },
        { id: "galleta", nombre: "Galleta rellena", precio: 45, claves: ["galleta", "galletas"] },
      ],
    };
    const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!.,]/g, " ");
    const NOMBRE_EN = { matcha: "Matcha latte", frappe: "Caramel frappé", americano: "Americano", latte: "Latte", galleta: "Stuffed cookie" };
    let pedido = {}, entregaPreguntada = false, idioma = "es";
    const T = (es, en) => (idioma === "en" ? en : es);
    const nombreDe = (p) => (idioma === "en" ? NOMBRE_EN[p.id] : p.nombre);
    const decir = (texto, quien = "asistente") => {
      const b = document.createElement("div");
      b.className = "burbuja " + quien; b.textContent = texto;
      chat.appendChild(b); chat.scrollTop = chat.scrollHeight;
    };
    const total = () => Object.entries(pedido).reduce((s, [id, n]) => s + NEGOCIO.productos.find((p) => p.id === id).precio * n, 0);
    const resumen = () => Object.entries(pedido).map(([id, n]) => { const p = NEGOCIO.productos.find((x) => x.id === id); return `${n} × ${nombreDe(p)}: ${pesos(p.precio * n)}`; }).join("\n");
    const persona = (motivo) => {
      decir(motivo);
      setTimeout(() => decir(T("En la vida real, aquí la plática pasa a la pantalla del equipo como “Necesita a una persona”, y alguien te contesta.",
        "In real life, this chat now shows up on the team's screen as “Needs a person”, and someone answers you."), "sistema"), 500);
    };
    function responder(texto) {
      idioma = detectarIdioma(texto, idioma);
      const t = " " + norm(texto) + " ";
      const palabras = t.trim().split(/\s+/);
      const agregados = [];
      palabras.forEach((w, i) => {
        if (/^matcha$/.test(w) && /^lattes?$/.test(palabras[i + 1] || "")) palabras[i + 1] = "_";
        const claves = { cookie: "galleta", cookies: "galleta", coffee: "americano", frappes: "frappe" };
        const p = NEGOCIO.productos.find((x) => x.claves.includes(claves[w] || w));
        if (!p) return;
        let n = 1;
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          if (/^\d+$/.test(palabras[j])) { n = +palabras[j]; break; }
          if (NUM[palabras[j]]) { n = NUM[palabras[j]]; break; }
        }
        n = Math.min(n, 20);
        pedido[p.id] = (pedido[p.id] || 0) + n;
        agregados.push(`${n} × ${nombreDe(p)}`);
      });
      if (agregados.length) {
        return decir(T(`Listo, anoté: ${agregados.join(", ")}.\nLlevas ${pesos(total())}. ¿Algo más? Si es todo, dime “eso es todo”.`,
          `Got it: ${agregados.join(", ")}.\nYour total so far is ${pesos(total())}. Anything else? If that's all, just say “that's all”.`));
      }
      if (/ (persona|humano|alguien|encargad|gerente|dueno|duena|human|person|someone|manager|owner) /.test(t)) return persona(T("Claro, te comunico con una persona del equipo. En un momento te escriben.", "Sure, I'm passing you to someone on the team. They'll write to you in a moment."));
      if (/ (que (tienen|hay|venden)|menu|carta|precios?|what do you have|prices?) /.test(t)) {
        return decir(T("Esto tenemos hoy:\n", "Here's what we have today:\n") + NEGOCIO.productos.map((p) => `• ${nombreDe(p)}: ${pesos(p.precio)}`).join("\n") + T("\n¿Qué se te antoja?", "\nWhat would you like?"));
      }
      if (/ (hora|horario|abren|cierran|abierto|open|close|closed|hours) /.test(t)) return decir(T("Abrimos de lunes a sábado de 8:00 a 21:00, y domingo de 9:00 a 14:00.", "We're open Monday to Saturday, 8 am to 9 pm, and Sunday 9 am to 2 pm."));
      if (/ (envio|envios|domicilio|mandan|llevan|entregan|delivery|deliver) /.test(t)) return decir(T("Sí, enviamos a domicilio. El costo depende de tu colonia: dime cuál es y te lo cotizo antes de cobrar.", "Yes, we deliver. The fee depends on your neighborhood: tell me which one and I'll quote it before you pay."));
      if (/ (eso es todo|es todo|seria todo|nada mas|ya es todo|listo|that's all|thats all|that is all|that's it|thats it) /.test(t)) {
        if (!Object.keys(pedido).length) return decir(T("Todavía no tienes nada en tu pedido. ¿Qué te sirvo?", "Your order is empty so far. What can I get you?"));
        entregaPreguntada = true;
        return decir(T(`Tu pedido:\n${resumen()}\nTotal: ${pesos(total())}\n\n¿Pasas por él o te lo enviamos?`, `Your order:\n${resumen()}\nTotal: ${pesos(total())}\n\nWill you pick it up or should we deliver it?`));
      }
      if (entregaPreguntada && / (paso|recoger|recojo|voy|enviar|envien|envialo|domicilio|pick|pickup|deliver|delivery) /.test(t)) {
        entregaPreguntada = false;
        const folio = "LM-" + String(Math.floor(100 + Math.random() * 900));
        decir(T(`Perfecto. Tu folio es ${folio}.\nAquí está tu liga de pago (de ejemplo): pago.ejemplo/${folio}\nEn cuanto se acredite, tu pedido entra a la barra y te aviso cuando esté listo.`,
          `Perfect. Your order number is ${folio}.\nHere's your payment link (example): pago.ejemplo/${folio}\nAs soon as it's paid, your order goes to the bar and I'll let you know when it's ready.`));
        pedido = {};
        return;
      }
      if (/ (hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hi|hello|hey) /.test(t)) return decir(T("¡Hola! Soy Vektor, el asistente de Café La Muestra. Te puedo pasar el menú, el horario o tomar tu pedido.", "Hi! I'm Vektor, Café La Muestra's assistant. I can share the menu, our hours, or take your order."));
      if (/ (gracias|thanks|thank you) /.test(t)) return decir(T("¡A ti! Aquí estoy si necesitas algo más.", "You're welcome! I'm here if you need anything else."));
      persona(T("Esa no la sé con certeza y no quiero inventarte. Te paso con una persona del equipo para que te confirme.", "I'm not sure about that and I don't want to guess. I'm passing you to someone on the team who can confirm."));
    }
    const enviar = (texto) => { if (!texto.trim()) return; decir(texto, "cliente"); setTimeout(() => responder(texto), 450); };
    decir("Café La Muestra es un negocio de ejemplo. Las respuestas son de demostración.", "sistema");
    decir("¡Hola! Soy Vektor, el asistente de Café La Muestra. ¿Qué te sirvo hoy?");
    $$("#sugeridas button").forEach((b) => b.addEventListener("click", () => enviar(b.textContent)));
    const forma = $("#escribir");
    forma.addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chat-texto"); enviar(i.value); i.value = ""; });
  }

  // Calculadora "¿Cuánto pierdes?"
  const calc = $("#calc");
  if (calc) {
    let modo = "citas";
    const ver = (id) => $("#" + id);
    const pintar = () => {
      $$(".campos", calc).forEach((c) => { c.hidden = c.dataset.modo !== modo; });
      let perdida, texto;
      if (modo === "citas") {
        const citas = +ver("c-citas").value, pct = +ver("c-pct").value, valor = +ver("c-valor").value;
        ver("o-citas").value = citas; ver("o-pct").value = pct + "%"; ver("o-valor").value = pesos(valor);
        perdida = citas * 4.33 * (pct / 100) * valor;
        ver("r-recupera").textContent = `${pesos(perdida * 0.3)} – ${pesos(perdida * 0.5)}`;
        ver("r-recupera-txt").hidden = false;
        texto = `${citas} citas por semana, ${pct}% no llega, ${pesos(valor)} por cita`;
      } else {
        const n = +ver("m-n").value, k = +ver("m-k").value, ticket = +ver("m-ticket").value;
        ver("o-n").value = n; ver("o-k").value = k + " de 10"; ver("o-ticket").value = pesos(ticket);
        perdida = n * 30 * (k / 10) * ticket;
        ver("r-recupera-txt").hidden = true;
        texto = `${n} mensajes o llamadas sin contestar a tiempo al día, ${k} de cada 10 habrían comprado, ${pesos(ticket)} por compra`;
      }
      ver("r-perdida").textContent = pesos(perdida);
      const wa = ver("r-wa");
      wa.href = waUrl(`Hola, ADN. Usé su calculadora: ${texto}. Me salen ${pesos(perdida)} al mes que se pierden. Quiero ver cómo recuperarlos.`);
    };
    $$(".pestanas button", calc).forEach((b) => b.addEventListener("click", () => {
      modo = b.dataset.modo;
      $$(".pestanas button", calc).forEach((x) => x.setAttribute("aria-selected", x === b));
      pintar();
    }));
    $$("input", calc).forEach((i) => i.addEventListener("input", pintar));
    pintar();
  }

  // Formulario de contacto
  const forma = $("#forma");
  if (forma) {
    const sel = $("#giro");
    sel.innerHTML = ADN.giros.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join("") + `<option value="otro">Otro</option>`;
    if (document.body.dataset.giro) sel.value = document.body.dataset.giro;
    forma.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (id) => $("#" + id).value.trim();
      const aviso = $("#aviso"), caja = $("#mensaje"), acciones = $("#enviar");
      const faltan = [];
      if (!v("nombre")) faltan.push("tu nombre");
      if (!v("negocio")) faltan.push("el nombre de tu negocio");
      if (!$("#acepto").checked) faltan.push("aceptar el aviso de privacidad");
      if (faltan.length) {
        aviso.textContent = "Falta " + faltan.join(", ").replace(/, ([^,]*)$/, " y $1") + ".";
        aviso.className = "aviso error"; aviso.hidden = false; caja.hidden = true; acciones.hidden = true;
        return;
      }
      const giro = sel.options[sel.selectedIndex].text;
      const texto = `Hola, ADN. Soy ${v("nombre")}, de ${v("negocio")} (${giro}).` + (v("necesidad") ? `\nMe gustaría resolver: ${v("necesidad")}` : "");
      caja.textContent = texto; caja.hidden = false;
      acciones.innerHTML = "";
      const a = document.createElement("a");
      a.className = "boton wa"; a.target = "_blank"; a.rel = "noopener"; a.href = waUrl(texto); a.textContent = "Mandar por WhatsApp";
      const copiar = document.createElement("button");
      copiar.type = "button"; copiar.className = "boton"; copiar.textContent = "Copiar mensaje";
      copiar.addEventListener("click", () => {
        const sel2 = () => { const r = document.createRange(); r.selectNodeContents(caja); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copiar.textContent = "Texto seleccionado"; };
        if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => { copiar.textContent = "Copiado"; }, sel2); else sel2();
      });
      acciones.append(a, copiar); acciones.hidden = false;
      aviso.className = "aviso"; aviso.textContent = `Si prefieres correo, mándalo a ${ADN.contacto.correo}.`; aviso.hidden = false;
    });
  }

  // Doble hélice: dos hebras y sus pares de bases en los cuatro colores. Se pausa fuera de pantalla.
  const cv = $("#helice");
  if (cv && cv.getContext) {
    const ctx = cv.getContext("2d");
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, colores = [], visible = true, corriendo = false;
    const medir = () => {
      const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
      w = r.width; h = r.height; cv.width = Math.max(1, w * d); cv.height = Math.max(1, h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const css = getComputedStyle(document.documentElement);
      colores = ["--a", "--t", "--c", "--g"].map((k) => css.getPropertyValue(k).trim());
    };
    const dibujar = (t) => {
      ctx.clearRect(0, 0, w, h);
      const horizontal = w > h, largo = horizontal ? w : h, cruz = horizontal ? h : w;
      const pares = Math.max(8, Math.round(largo / 22)), amp = cruz * 0.32, centro = cruz / 2, fase = t / 2400;
      const pt = (s, o) => (horizontal ? [s, centro + o] : [centro + o, s]);
      for (let i = 0; i <= pares; i++) {
        const s = (i / pares) * largo, ang = i * 0.42 + fase, prof = Math.cos(ang);
        const [x1, y1] = pt(s, Math.sin(ang) * amp), [x2, y2] = pt(s, Math.sin(ang + Math.PI) * amp);
        const xm = (x1 + x2) / 2, ym = (y1 + y2) / 2;
        ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.globalAlpha = 0.35 + 0.45 * (prof + 1) / 2;
        ctx.strokeStyle = colores[i % 4]; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xm, ym); ctx.stroke();
        ctx.strokeStyle = colores[(i + 1) % 4]; ctx.beginPath(); ctx.moveTo(xm, ym); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = prof > 0 ? colores[1] : colores[0]; ctx.beginPath(); ctx.arc(x1, y1, 4 + prof * 1.5, 0, 7); ctx.fill();
        ctx.fillStyle = prof > 0 ? colores[0] : colores[1]; ctx.beginPath(); ctx.arc(x2, y2, 4 - prof * 1.5, 0, 7); ctx.fill();
      }
    };
    const ciclo = (t) => { if (!visible || quieto) { corriendo = false; return; } dibujar(t); requestAnimationFrame(ciclo); };
    const arrancar = () => { if (corriendo || quieto) return; corriendo = true; requestAnimationFrame(ciclo); };
    medir(); dibujar(0);
    addEventListener("resize", () => { medir(); dibujar(performance.now()); });
    const recolor = () => setTimeout(() => { medir(); dibujar(performance.now()); }, 50);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor);
    new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) arrancar(); }).observe(cv);
    } else arrancar();
  }
})();
