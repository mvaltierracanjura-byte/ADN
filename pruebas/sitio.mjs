// Pruebas del sitio con Playwright: NODE_PATH=$(npm root -g) node pruebas/sitio.mjs [carpeta-capturas]
// Sirve el sitio con la misma CSP de netlify.toml y revisa cada página en celular y escritorio, claro y oscuro.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADN = require(join(raiz, "datos.js"));
const capturas = process.argv[2];
if (capturas) mkdirSync(capturas, { recursive: true });

const csp = readFileSync(join(raiz, "netlify.toml"), "utf8").match(/Content-Security-Policy = "([^"]+)"/)[1];
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };
const servidor = createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (ruta.endsWith("/")) ruta += "index.html";
  const archivo = join(raiz, ruta);
  if (!archivo.startsWith(raiz) || !existsSync(archivo) || statSync(archivo).isDirectory()) {
    res.writeHead(404, { "Content-Type": TIPOS[".html"], "Content-Security-Policy": csp });
    return res.end(readFileSync(join(raiz, "404.html")));
  }
  res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] || "application/octet-stream", "Content-Security-Policy": csp });
  res.end(readFileSync(archivo));
});
await new Promise((r) => servidor.listen(0, r));
const URL_BASE = `http://localhost:${servidor.address().port}`;

const HERRAMIENTAS = ["/herramientas/", "/herramientas/diagnostico.html", "/herramientas/agenda.html", "/herramientas/bandeja.html", "/herramientas/resenas.html",
  "/herramientas/cobro.html", "/herramientas/factura.html", "/herramientas/pronostico.html", "/herramientas/contenido.html", "/herramientas/google.html", "/herramientas/aviso.html"];
const PAGINAS = ["/", "/en/", "/privacidad.html", "/404-no-existe", ...ADN.giros.map((g) => `/giros/${g.id}.html`), ...HERRAMIENTAS, "/herramientas/cita.html#nada", "/herramientas/pagar.html#nada"];
const navegador = await chromium.launch();
let fallas = 0, pruebas = 0;
async function prueba(nombre, fn) {
  pruebas++;
  try { await fn(); console.log("✓", nombre); }
  catch (e) { fallas++; console.log("✗", nombre, "\n   ", e.message.split("\n")[0]); }
}

async function abrir(ruta, { ancho = 390, alto = 844, tema = "light" } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/404 \(Not Found\)/.test(m.text()) ) errores.push(m.text()); });
  await p.goto(URL_BASE + ruta, { waitUntil: "networkidle" });
  return { p, ctx, errores };
}

// 1. Todas las páginas: sin errores, sin scroll lateral, tipografías cargadas
for (const ruta of PAGINAS) {
  for (const [ancho, tema] of [[390, "light"], [390, "dark"], [1280, "light"], [1280, "dark"]]) {
    await prueba(`${ruta} a ${ancho}px ${tema}: sin errores ni scroll lateral`, async () => {
      const { p, ctx, errores } = await abrir(ruta, { ancho, alto: ancho > 800 ? 900 : 844, tema });
      const { sw, cw, fuente } = await p.evaluate(async () => { await document.fonts.ready; return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, fuente: document.fonts.check('700 20px "Unbounded"') && document.fonts.check('400 16px "Figtree"') }; });
      assert.deepEqual(errores, [], "errores en consola");
      assert.ok(sw <= cw, `scroll lateral: ${sw} > ${cw}`);
      assert.ok(fuente, "tipografías sin cargar");
      if (capturas && (ruta === "/" || ruta === "/giros/consultorios.html" || ruta === "/en/" || (ruta.startsWith("/herramientas/") && ancho === 390 && tema === "light"))) {
        await p.screenshot({ path: join(capturas, `${ruta.replace(/\W+/g, "_") || "inicio"}-${ancho}-${tema}.png`), fullPage: true });
      }
      await ctx.close();
    });
  }
}

// 2. Portada
const { p, ctx } = await abrir("/", { ancho: 1280, alto: 900 });
await prueba("bases: 4 columnas con 16 servicios", async () => {
  assert.equal(await p.locator("#bases .base-col").count(), 4);
  assert.equal(await p.locator("#bases li").count(), 16);
});
await prueba("giros: 9 pestañas y la ficha cambia con su enlace", async () => {
  assert.equal(await p.locator("#lista-giros button").count(), ADN.giros.length);
  await p.click("#tab-consultorios");
  await p.waitForSelector("#ficha >> text=Recordatorio por WhatsApp");
  assert.equal(await p.getAttribute("#ficha a.boton", "href"), "giros/consultorios.html");
});
await prueba("enlaces de WhatsApp con el número de ADN", async () => {
  const hrefs = await p.$$eval("a[data-wa]", (as) => as.map((a) => a.href));
  assert.ok(hrefs.length >= 3);
  for (const h of hrefs) assert.ok(h.startsWith("https://wa.me/526692166036?text="), h);
});
await prueba("demo de Vektor: pedido, total, folio y paso a persona", async () => {
  const ultima = () => p.locator("#chat .burbuja.asistente").last().textContent();
  await p.click("#sugeridas >> text=Quiero 2 lattes y una galleta");
  await p.waitForFunction(() => /\$175/.test(document.querySelector("#chat").textContent));
  assert.match(await ultima(), /2 × Latte, 1 × Galleta rellena/);
  await p.click("#sugeridas >> text=Eso es todo");
  await p.waitForFunction(() => /Total: \$175/.test(document.querySelector("#chat").textContent));
  await p.click("#sugeridas >> text=Paso por él");
  await p.waitForFunction(() => /folio es LM-\d{3}/.test(document.querySelector("#chat").textContent));
  await p.fill("#chat-texto", "un matcha latte por favor");
  await p.press("#chat-texto", "Enter");
  await p.waitForFunction(() => /1 × Matcha latte\.\s+Llevas \$75/.test(document.querySelector("#chat").innerText));
  assert.doesNotMatch(await ultima(), /× Latte/); // "matcha latte" no cuenta también un latte
  await p.click("#sugeridas >> text=¿Tienen leche de almendra?");
  await p.waitForFunction(() => /no quiero inventarte/.test(document.querySelector("#chat").textContent));
  await p.waitForFunction(() => /Necesita a una persona/.test(document.querySelector("#chat").textContent));
});
await prueba("calculadora: citas y mensajes", async () => {
  assert.equal(await p.textContent("#r-perdida"), "$31,176"); // 60 × 4.33 × 20% × 600
  assert.equal((await p.textContent("#r-recupera")).replace(/\s/g, " "), "$9,353 – $15,588");
  await p.click("#calc >> text=Mensajes sin contestar");
  assert.equal(await p.textContent("#r-perdida"), "$13,500"); // 6 × 30 × 3/10 × 250
  assert.ok(await p.locator("#r-recupera-txt").isHidden());
  await p.fill("#m-n", "10");
  assert.equal(await p.textContent("#r-perdida"), "$22,500");
  assert.match(decodeURIComponent(await p.getAttribute("#r-wa", "href")), /Me salen \$22,500 al mes/);
});
await prueba("formulario: pide aviso de privacidad y arma el WhatsApp", async () => {
  await p.click("#forma button[type=submit]");
  assert.match(await p.textContent("#aviso"), /tu nombre, el nombre de tu negocio y aceptar el aviso de privacidad/);
  await p.fill("#nombre", "Ana");
  await p.fill("#negocio", "Clínica Sol");
  await p.selectOption("#giro", "consultorios");
  await p.fill("#necesidad", "Pacientes que no llegan");
  await p.click("#forma button[type=submit]");
  assert.match(await p.textContent("#aviso"), /aviso de privacidad/);
  await p.check("#acepto");
  await p.click("#forma button[type=submit]");
  const href = await p.getAttribute("#enviar a.boton", "href");
  assert.match(decodeURIComponent(href), /^https:\/\/wa\.me\/526692166036\?text=Hola, ADN\. Soy Ana, de Clínica Sol \(Consultorios y clínicas\)\.\nMe gustaría resolver: Pacientes que no llegan$/);
});
await ctx.close();

// 3. Celular: menú y botón flotante
await prueba("celular: menú abre y cierra; botón flotante visible", async () => {
  const { p, ctx } = await abrir("/");
  assert.ok(await p.locator(".wa-flotante").isVisible());
  assert.ok(await p.locator("#menu").isHidden());
  await p.click(".abrir-menu");
  assert.ok(await p.locator("#menu").isVisible());
  await p.click("#menu >> text=Demo");
  assert.ok(await p.locator("#menu").isHidden());
  await ctx.close();
});

// 4. Página de giro
await prueba("giro: formulario con el giro ya elegido y sin pestañas", async () => {
  const { p, ctx } = await abrir("/giros/rentas.html");
  assert.equal(await p.inputValue("#giro"), "rentas");
  assert.match(await p.textContent("h1"), /Rentas vacacionales/);
  assert.match(await p.getAttribute(".wa-flotante", "href"), /rentas%20vacacionales|rentas/i);
  await ctx.close();
});

// 5. SEO básico
await prueba("SEO: título, descripción, canonical y og:image en cada página indexable", async () => {
  for (const ruta of PAGINAS.filter((r) => r !== "/404-no-existe" && !r.includes("#"))) {
    const { p, ctx } = await abrir(ruta, { ancho: 1280 });
    const m = await p.evaluate(() => ({
      t: document.title, d: document.querySelector('meta[name="description"]')?.content,
      c: document.querySelector('link[rel="canonical"]')?.href, h1: document.querySelectorAll("h1").length,
    }));
    assert.ok(m.t && m.d && m.c, ruta);
    assert.equal(m.h1, 1, `${ruta}: un solo h1`);
    await ctx.close();
  }
});


// 6. Herramientas
const enPagina = async (ruta, fn, op = {}) => { const { p, ctx, errores } = await abrir(ruta, { ancho: 1280, alto: 900, ...op }); try { await fn(p); assert.deepEqual(errores, []); } finally { await ctx.close(); } };

await prueba("demo de Vektor contesta en inglés", () => enPagina("/", async (p) => {
  await p.click("#sugeridas >> text=Hi! What time do you open?");
  await p.waitForFunction(() => /We're open Monday to Saturday/.test(document.querySelector("#chat").textContent));
}));
await prueba("portada: sección de herramientas, diagnóstico y pregunta sobre el agente de Meta", () => enPagina("/", async (p) => {
  assert.equal(await p.getAttribute("#herramientas a.boton", "href"), "herramientas/");
  assert.match(await p.textContent("#preguntas"), /agente de IA gratis/);
  assert.match(await p.textContent("#metodo"), /Piloto medido/);
}));
await prueba("agenda: apartar, ver la cita, confirmar, cambiar y cancelar", () => enPagina("/herramientas/agenda.html", async (p) => {
  await p.locator("#horas button").first().click();
  await p.fill("#c-nombre", "Prueba Uno"); await p.fill("#c-tel", "669 111 2233");
  await p.click("#forma-cita button[type=submit]");
  await p.waitForSelector("#c-ok:not([hidden])");
  assert.match(await p.textContent("#c-ok"), /quedó apartada/);
  const href = await p.getAttribute("#c-ok a[href^='cita.html']", "href");
  await p.goto(URL_BASE + "/herramientas/" + href, { waitUntil: "networkidle" });
  assert.match(await p.textContent("#titulo"), /Prueba, tu cita/);
  await p.click("#confirmar"); await p.waitForFunction(() => /Confirmada/.test(document.querySelector("#detalle").textContent));
  await p.click("#cambiar"); await p.locator("#dias button").nth(2).click(); await p.waitForSelector("#horas button");
  await p.locator("#horas button").first().click(); await p.waitForFunction(() => /Por confirmar/.test(document.querySelector("#detalle").textContent));
  await p.click("#cancelar"); await p.click("#si-cancelar"); await p.waitForFunction(() => /Cancelada/.test(document.querySelector("#detalle").textContent));
  assert.ok(await p.locator("#acciones").isHidden());
}));
await prueba("agenda: no deja apartar sin nombre ni con teléfono inválido", () => enPagina("/herramientas/agenda.html", async (p) => {
  await p.locator("#horas button").first().click();
  await p.fill("#c-tel", "123");
  await p.click("#forma-cita button[type=submit]");
  assert.match(await p.textContent("#c-error"), /nombre|WhatsApp/);
}));
await prueba("bandeja: clasifica, manda quejas a persona y arma el plan de reactivación", () => enPagina("/herramientas/bandeja.html", async (p) => {
  assert.equal(await p.locator("#bandeja li").count(), 10);
  await p.fill("#msj", "Mi pedido 5555 llegó incompleto"); await p.click("#probar button");
  assert.match(await p.locator("#bandeja li").first().textContent(), /A una persona.*Urgente/s);
  assert.ok(await p.locator("#plan li").count() >= 4);
  await p.fill("#oferta", "un postre gratis");
  assert.match(await p.locator("#plan .mensaje-wa").first().textContent(), /un postre gratis/);
}));
await prueba("reseñas: invitación y respuesta a una negativa", () => enPagina("/herramientas/resenas.html", async (p) => {
  assert.match(await p.textContent("#invitacion"), /¡Hola, Laura! Gracias por elegir Café La Muestra/);
  assert.match(await p.inputValue("#resp-2"), /Lamentamos/);
  assert.match(await p.inputValue("#resp-1"), /^Hi Mike/);
  const antes = await p.textContent("#metricas");
  await p.locator("#resenas li").nth(1).locator("button").click();
  assert.notEqual(await p.textContent("#metricas"), antes);
}));
await prueba("cobro: valida CLABE, crea el cobro, lo concilia y abre la página de pago", () => enPagina("/herramientas/cobro.html", async (p) => {
  assert.match(await p.textContent("#clabe-estado"), /✓ CLABE válida/);
  await p.fill("#clabe", "032180000118359718");
  assert.match(await p.textContent("#clabe-estado"), /no es válida/);
  await p.fill("#clabe", "032180000118359719");
  await p.click("#crear");
  assert.match(await p.textContent("#creado"), /referencia \d{7}/);
  await p.click("#conciliar");
  assert.match(await p.textContent("#sin-cobro"), /2 cobro\(s\) marcados como pagados/);
  const enlace = await p.getAttribute("#creado a[target=_blank]", "href");
  await p.goto(enlace, { waitUntil: "networkidle" });
  assert.match(await p.textContent("#datos"), /032 180 00011835971 9/);
  assert.match(await p.textContent("#monto"), /175/);
}));
await prueba("autofactura: errores claros y vista previa con IVA desglosado", () => enPagina("/herramientas/factura.html", async (p) => {
  await p.click("#facturar");
  assert.match(await p.textContent("#errores"), /RFC/);
  await p.fill("#rfc", "EKU9003173C9"); await p.dispatchEvent("#rfc", "input");
  await p.fill("#nombre", "Escuela Kemper Urgate SA de CV"); await p.fill("#cp", "26015"); await p.fill("#correo", "a@b.mx");
  await p.selectOption("#regimen", "601"); await p.selectOption("#uso", "G03");
  await p.click("#facturar");
  const v = await p.textContent("#vista");
  assert.match(v, /ESCUELA KEMPER URGATE · EKU9003173C9/);
  assert.match(v, /\$17\.93/);
}));
await prueba("pronóstico: tabla por producto y el calor sube los frappés", () => enPagina("/herramientas/pronostico.html", async (p) => {
  assert.equal(await p.locator("#tabla tr").count(), 4);
  const frappe = async () => +(await p.locator("#tabla tr", { hasText: "Frappé" }).locator("td").nth(3).textContent());
  const antes = await frappe();
  await p.click("[data-ajuste=calor]");
  assert.ok((await frappe()) > antes);
  assert.match(await p.textContent("#evaluacion"), /se equivoca en promedio/);
}));
await prueba("contenido, Google y aviso generan su resultado", async () => {
  await enPagina("/herramientas/contenido.html", async (p) => { assert.ok((await p.locator("#calendario li").count()) >= 8); });
  await enPagina("/herramientas/google.html", async (p) => {
    const antes = await p.textContent("#puntaje");
    await p.check("#p-resenas");
    assert.notEqual(await p.textContent("#puntaje"), antes);
    assert.match(await p.inputValue("#codigo"), /"@type": "CafeOrCoffeeShop"/);
  });
  await enPagina("/herramientas/aviso.html", async (p) => {
    assert.match(await p.inputValue("#aviso"), /Ana López Pérez, que opera con el nombre comercial Consultorio Sonrisa/);
    assert.match(await p.inputValue("#aviso"), /Datos sensibles/);
  });
});
await prueba("diagnóstico: recomienda y arma el WhatsApp", () => enPagina("/herramientas/diagnostico.html", async (p) => {
  assert.match(await p.textContent("#resultado"), /Empieza por/);
  assert.match(await p.textContent("#resultado"), /al mes/);
  await p.selectOption("#citas", "si"); await p.fill("#citas-semana", "200"); await p.fill("#inasist", "30");
  assert.match(await p.textContent("#resultado .ok-msj"), /Agenda con recordatorios/);
  assert.match(decodeURIComponent(await p.getAttribute("#resultado a.boton.wa", "href")), /Hice el diagnóstico/);
}));

await prueba("la página habla de lo que ofrecemos, no de otros negocios", async () => {
  for (const ruta of ["/", "/en/", ...ADN.giros.map((g) => `/giros/${g.id}.html`)]) {
    const { p, ctx } = await abrir(ruta);
    assert.doesNotMatch(await p.content(), /osako/i, ruta);
    assert.doesNotMatch(await p.innerText("body"), /\bAbi\b/, ruta + ": el asistente se llama Vektor");
    await ctx.close();
  }
  const { p, ctx } = await abrir("/");
  assert.match(await p.textContent("#demo"), /Vektor[\s\S]*nombre que tú prefieras/);
  for (const id of ["ayudamos", "mejoramos", "entregamos", "para-quien", "cuidamos"]) assert.equal(await p.locator("#" + id).count(), 1, id);
  assert.equal(await p.locator("#ayudamos .ayuda-fila:not(.ayuda-cab)").count(), 9);
  for (const a of await p.locator(".menu a[href^='#']").all()) assert.equal(await p.locator(await a.getAttribute("href")).count(), 1, "el menú apunta a secciones que existen");
  await ctx.close();
});

// Negocio conectado: kit/config.js con Supabase (falso, en el mismo origen para respetar la CSP).
async function conectado(ruta, rpcs, fn) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errores = [], llamadas = [];
  p.on("pageerror", (e) => errores.push(e.message));
  await p.route("**/kit/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `export const SUPABASE = { url: "${URL_BASE}/falso", anonKey: "anon" }; export const NEGOCIO_WHATSAPP = "";` }));
  await p.route("**/falso/rest/v1/rpc/*", async (r) => {
    const fn = r.request().url().split("/").pop(), cuerpo = JSON.parse(r.request().postData() || "{}");
    llamadas.push({ fn, cuerpo });
    const [status, body] = rpcs[fn](cuerpo);
    await r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  try { await p.goto(URL_BASE + ruta, { waitUntil: "networkidle" }); await fn(p, llamadas); assert.deepEqual(errores, []); }
  finally { await ctx.close(); }
}
const COBRO = { negocio: "Consultorio Sonrisa", beneficiario: "Consultorio Sonrisa SC", clabe: "002010077777777771", dimo: null, monto: 600, concepto: "CITA LIMPIEZA", referencia: "0004817", estado: "pendiente" };
await prueba("pago conectado: datos de la base, sin aviso de demo, y avisa el pago", () => conectado("/herramientas/pagar.html#t=0123456789abcdef01234567",
  { cobro_por_token: () => [200, [COBRO]], avisar_pago: () => [200, "avisado"] }, async (p, llamadas) => {
    assert.equal(await p.isVisible("#aviso-demo"), false);
    assert.match(await p.textContent("#datos"), /002 010 07777777777 1/);
    assert.match(await p.textContent("#monto"), /600/);
    await p.click("#pague");
    await p.waitForSelector("#gracias:not([hidden])");
    assert.deepEqual(llamadas.map((l) => l.fn), ["cobro_por_token", "avisar_pago"]);
  }));
await prueba("pago conectado: un enlace con datos en vez de token no muestra ninguna CLABE", () => conectado("/herramientas/pagar.html#eyJjIjoiMDAyMDEwMDc3Nzc3Nzc3NzcxIn0",
  { cobro_por_token: () => [200, []] }, async (p, llamadas) => {
    assert.match(await p.textContent("#monto"), /no es válido/);
    assert.equal(llamadas.length, 0);
  }));
await prueba("autofactura conectada: manda la solicitud a la base y muestra sus errores", () => {
  let veces = 0;
  return conectado("/herramientas/factura.html", { pedir_factura: () => (++veces === 1 ? [400, { message: "No encontramos ese ticket con ese total. Revisa tu ticket." }] : [200, 7]) }, async (p, llamadas) => {
    assert.equal(await p.isVisible(".aviso-demo"), false);
    await p.fill("#folio", "A123"); await p.fill("#total", "250");
    await p.fill("#rfc", "EKU9003173C9"); await p.dispatchEvent("#rfc", "input");
    await p.fill("#nombre", "Escuela Kemper Urgate SA de CV"); await p.fill("#cp", "26015"); await p.fill("#correo", "a@b.mx");
    await p.selectOption("#regimen", "601"); await p.selectOption("#uso", "G03");
    await p.click("#facturar");
    await p.waitForSelector("#errores .error-msj");
    assert.match(await p.textContent("#errores"), /No encontramos ese ticket/);
    await p.click("#facturar");
    await p.waitForSelector("#vista .ok-msj");
    assert.match(await p.textContent("#vista"), /llega a a@b\.mx/);
    assert.deepEqual(llamadas[1].cuerpo, { p_folio: "A123", p_total: 250, p_rfc: "EKU9003173C9", p_nombre: "ESCUELA KEMPER URGATE", p_cp: "26015", p_regimen: "601", p_uso: "G03", p_correo: "a@b.mx" });
  });
});

await navegador.close();
servidor.close();
console.log(`\n${pruebas - fallas} de ${pruebas} pruebas pasaron.`);
process.exit(fallas ? 1 : 0);
