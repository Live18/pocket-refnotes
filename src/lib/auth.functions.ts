import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, userEmail } = context;

    const [{ data: profile }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);

    return {
      userId,
      email: userEmail,
      profile: profile ?? null,
      role: (profile?.role as "admin" | "super_admin" | "user") ?? "user",
      isAdmin: (profile?.role === "admin" || profile?.role === "super_admin"),
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", userId);
    return { ok: true };
  });
