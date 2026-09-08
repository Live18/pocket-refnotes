import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, userEmail } = context;

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(`Failed to load profile: ${error.message}`);

    return {
      userId,
      email: userEmail,
      profile: profile ?? null,
      role: (profile?.role as "admin" | "super_admin" | "user") ?? "user",
      isAdmin: (profile?.role === "admin" || profile?.role === "super_admin"),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    display_name: z.string().nullable(),
    default_recipient_email: z.string().email().nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        default_recipient_email: data.default_recipient_email,
      })
      .eq("id", userId);
    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return { ok: true };
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