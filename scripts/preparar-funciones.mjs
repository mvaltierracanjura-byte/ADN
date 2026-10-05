// Copia kit/ y servidor/ dentro de supabase/functions/_adn/ para que Supabase los incluya al publicar.
//   node scripts/preparar-funciones.mjs && supabase functions deploy whatsapp --no-verify-jwt   (igual voz y recordatorios)
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "supabase/functions/_adn");
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const d of ["kit", "servidor"]) cpSync(join(raiz, d), join(destino, d), { recursive: true });
console.log("Listo: supabase/functions/_adn/{kit,servidor}");
