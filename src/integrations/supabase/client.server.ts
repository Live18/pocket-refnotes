import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "https://reftechtool.app";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key";

/**
 * Admin client — bypasses RLS. Server-only. Never import from client code.
 */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
