import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, userEmail } = context;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, org_id").eq("user_id", userId),
    ]);

    return {
      userId,
      email: userEmail,
      profile: profile ?? null,
      roles: (roles ?? []).map((r) => ({ role: r.role as "admin" | "member", orgId: r.org_id as string })),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
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
