import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * After signup or login, the user calls this with an invite token to bind
 * their auth user to the org and assign the invited role.
 */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, userEmail } = context;
    const { data: invite, error } = await supabaseAdmin
      .from("invites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_at) throw new Error("Invite already used");
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error("Invite expired");
    }
    if (userEmail && userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("Invite email does not match signed-in user");
    }

    // Update profile with email and role.
    await supabaseAdmin
      .from("profiles")
      .update({ email: userEmail, role: invite.role })
      .eq("id", userId);

    await supabaseAdmin
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { role: invite.role };
  });

/**
 * Lookup invite by token (public — no auth) so the accept page can show
 * the email/org name before the user signs up.
 */
export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => z.object({ token: z.string().min(8) }).parse(input))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("email, role, expires_at, accepted_at, org:orgs(name)")
      .eq("token", data.token)
      .maybeSingle();
    return { invite: invite ?? null };
  });
