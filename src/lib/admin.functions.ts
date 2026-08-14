import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(
  supabase: any,
  userId: string,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    throw new Error("Forbidden: admin role required");
  }
}

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, email, role, created_at");
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: lastEntries }] = await Promise.all([
      // Last entry meta only — never the body.
      context.supabase
        .from("entries")
        .select("author_id, status, saved_at, sent_at, updated_at, game:games(title, game_date)")
        .in("author_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .order("updated_at", { ascending: false }),
    ]);

    const lastByUser = new Map<string, any>();
    (lastEntries ?? []).forEach((e: any) => {
      if (!lastByUser.has(e.author_id)) lastByUser.set(e.author_id, e);
    });

    return {
      members: (profiles ?? []).map((p) => ({
        ...p,
        lastEntry: lastByUser.get(p.id) ?? null,
      })),
    };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("invites")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invites: data ?? [] };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    email: z.string().email(),
    role: z.enum(["admin", "user"]).default("user"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const { data: invite, error } = await context.supabase
      .from("invites")
      .insert({
        email: data.email,
        role: data.role,
        token,
        invited_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // TODO: email the invite link via Resend (handled by Docker worker or here)
    return { invite, inviteUrl: `/accept-invite/${token}` };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("invites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "user"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("profiles").update({ role: data.role }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const orgId = await assertAdmin(context.supabase, context.userId);
    // Use admin client because removing roles + clearing org requires service role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("org_id", orgId);
    await supabaseAdmin.from("profiles").update({ org_id: null }).eq("id", data.userId);
    return { ok: true };
  });
