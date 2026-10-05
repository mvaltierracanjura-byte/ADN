// Conexión del cliente. En el sitio de ADN va vacío: las herramientas corren en modo demo (localStorage).
// En la instalación de un cliente: export const SUPABASE = { url: "https://xxxx.supabase.co", anonKey: "…" };
// y agregar ese dominio a connect-src en netlify.toml.
export const SUPABASE = null;
export const NEGOCIO_WHATSAPP = ""; // WhatsApp del negocio (52 + 10 dígitos) para "escríbenos"
