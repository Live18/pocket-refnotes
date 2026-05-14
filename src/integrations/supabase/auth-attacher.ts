import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Client-side function middleware: attach the user's bearer token to outgoing
 * createServerFn RPC calls so requireSupabaseAuth on the server can validate it.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return next();
    return next({
      sendContext: {},
      headers: { Authorization: `Bearer ${token}` },
    });
  },
);
