import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** false si todavía no se configuró el archivo .env.local */
export const configured = Boolean(url && key);

export const sb = createClient(url || "http://localhost:54321", key || "sin-configurar");

export const photoUrl = (path: string) => sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
