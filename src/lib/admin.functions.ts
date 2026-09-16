import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logActivity } from "@/lib/activity";

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

async function assertSuperAdmin(
  supabase: any,
  userId: string,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "super_admin") {
    throw new Error("Forbidden: super_admin role required");
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
    if (data.role === "admin") {
      await assertSuperAdmin(context.supabase, context.userId);
    }
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

    await logActivity(context.supabase, {
      actorId: context.userId,
      action: "invite_sent",
      metadata: { email: data.email, role: data.role },
    });

    // TODO: email the invite link via Resend (handled by Docker worker or here)
    return { invite, inviteUrl: `/accept-invite/${token}` };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: invite, error: fetchError } = await context.supabase
      .from("invites")
      .select("role, email")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!invite) throw new Error("Invite not found.");
    if (invite.role === "admin") {
      await assertSuperAdmin(context.supabase, context.userId);
    }
    const { data: deleted, error } = await context.supabase
      .from("invites")
      .delete()
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Revoke failed: no invite was deleted. Check RLS permissions on the invites table.");

    await logActivity(context.supabase, {
      actorId: context.userId,
      action: "invite_revoked",
      metadata: { email: invite.email, role: invite.role },
    });

    return { ok: true };
  });

export const changeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "user"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: before } = await context.supabase
      .from("profiles").select("role").eq("id", data.userId).maybeSingle();

    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.userId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Role change failed: no profile was updated. Check that the target user exists.");

    await logActivity(context.supabase, {
      actorId: context.userId,
      action: "role_change",
      targetId: data.userId,
      metadata: { fromRole: before?.role ?? null, toRole: data.role },
    });

    return { ok: true };
  });

export const requestActivityLogExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: request, error } = await context.supabase
      .from("activity_log_requests")
      .insert({
        requested_by: context.userId,
        date_range_start: data.startDate ?? null,
        date_range_end: data.endDate ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { request };
  });

export const listMyActivityLogRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("activity_log_requests")
      .select("id, date_range_start, date_range_end, status, created_at")
      .eq("requested_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

// <-- ADDITION: Super Admin view of every request (not just their own), used
// to feed the new "All requests" fulfillment table.
export const listAllActivityLogRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("activity_log_requests")
      .select("id, requested_by, date_range_start, date_range_end, status, fulfilled_at, fulfilled_by, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

// <-- ADDITION: Super Admin fulfills one request — pulls the activity_log
// rows for that request's date range (joined to profiles for a readable
// actor name/email), marks the request fulfilled, and returns the rows for
// the client to turn into a CSV download.
// NOTE: this does not paginate past PostgREST's default 1,000-row cap. Fine
// at current per-season volume; revisit if a single request's date range
// could ever span enough activity to exceed that.
export const fulfillActivityLogRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: request, error: reqError } = await context.supabase
      .from("activity_log_requests")
      .select("date_range_start, date_range_end")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqError) throw new Error(reqError.message);
    if (!request) throw new Error("Request not found.");

    let query = context.supabase
      .from("activity_log")
      .select("id, action, target_id, metadata, created_at, actor:profiles(display_name, email)")
      .order("created_at", { ascending: true });

    if (request.date_range_start) query = query.gte("created_at", request.date_range_start);
    if (request.date_range_end) query = query.lte("created_at", request.date_range_end);

    const { data: entries, error: entriesError } = await query;
    if (entriesError) throw new Error(entriesError.message);

    const { data: updatedRequest, error: updateError } = await context.supabase // <-- CHANGE: added .select().maybeSingle() to catch RLS silently filtering the update to zero rows (same pattern as revokeInvite)
      .from("activity_log_requests")
      .update({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: context.userId,
      })
      .eq("id", data.requestId)
      .select()
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updatedRequest) throw new Error("Fulfill failed: no request was updated. Check RLS permissions on activity_log_requests.");

    return { entries: entries ?? [] };
  });