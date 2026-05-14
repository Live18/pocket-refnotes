import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  "https://reftechtool.app";

const key =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== "undefined" && process.env?.SUPABASE_PUBLISHABLE_KEY) ||
  "placeholder-anon-key";

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== "undefined",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
