import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Middleware that validates the bearer token from the request and provides
 * a Supabase client scoped to the authenticated user (RLS applies as user).
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }
    const token = authHeader.slice("Bearer ".length);

    const url = process.env.SUPABASE_URL ?? "https://reftechtool.app";
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "placeholder-anon-key";

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error("Unauthorized: invalid token");
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        userEmail: data.user.email ?? null,
      },
    });
  },
);
