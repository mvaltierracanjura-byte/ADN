// Genera img/og.png (1200×630, vista previa en WhatsApp y redes) e img/icono-180.png.
// Requiere Playwright (local o global):  NODE_PATH=$(npm root -g) node scripts/imagenes.mjs
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const navegador = await chromium.launch();
const p = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(join(raiz, "scripts/og.html")).href, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(raiz, "img/og.png") });
await p.setViewportSize({ width: 180, height: 180 });
await p.setContent(`<style>body{margin:0}</style><img src="${pathToFileURL(join(raiz, "img/icono.svg")).href}" width="180" height="180">`);
await p.waitForTimeout(200);
await p.screenshot({ path: join(raiz, "img/icono-180.png") });
await navegador.close();
console.log("img/og.png e img/icono-180.png listos.");
