import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Guardar la intención antes de que el SDK quite los tokens de la dirección.
export const enlaceRecuperacion = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
export const configurado = Boolean(url?.startsWith('https://') && key && !key.startsWith('http') && !key.startsWith('sb_secret_'));
export const supabase = createClient(url ?? "http://localhost", key ?? "sin-clave");
