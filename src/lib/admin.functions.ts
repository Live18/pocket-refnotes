import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logActivity } from "@/lib/activity";
import { pacificDayRange } from "@/lib/report-export";

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
// ---------------------------------------------------------------------------
// Admin Reports tab — every user's DELIVERED reports (status saved_sent with
// sent_at stamped). RLS already limits admins to delivered reports from other
// users; the explicit filters here also keep out the admin's OWN unsent
// reports, which RLS allows them to read as the author.
// ---------------------------------------------------------------------------

const DELIVERED_REPORT_COLUMNS =
  "id, author_id, recipient_email, sent_at, body, game:games(id, title, game_date, location, crew, level, gender, home_team, visiting_team)";

async function authorProfiles(supabase: any, authorIds: string[]) {
  const ids = [...new Set(authorIds)];
  const byId = new Map<string, { name: string; email: string | null }>();
  if (ids.length === 0) return byId;
  const { data, error } = await supabase.from("profiles").select("id, display_name, email").in("id", ids);
  if (error) throw new Error(error.message);
  (data ?? []).forEach((p: any) => byId.set(p.id, { name: p.display_name || p.email || "Unknown referee", email: p.email ?? null }));
  return byId;
}

// Delivered reports (optionally within a sent_at window), with the filing referee's name/email.
// Pages past PostgREST's 1,000-row cap so a full season never gets silently truncated.
async function fetchDeliveredReports(
  supabase: any,
  opts: { sentFrom?: Date | null; sentBefore?: Date | null; ascending?: boolean } = {},
) {
  const PAGE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("entries")
      .select(DELIVERED_REPORT_COLUMNS)
      .eq("status", "saved_sent")
      .not("sent_at", "is", null);
    if (opts.sentFrom) query = query.gte("sent_at", opts.sentFrom.toISOString());
    if (opts.sentBefore) query = query.lt("sent_at", opts.sentBefore.toISOString());
    const { data, error } = await query
      .order("sent_at", { ascending: opts.ascending ?? false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const authors = await authorProfiles(supabase, rows.map((r) => r.author_id));
  return rows.map((r) => ({
    ...r,
    author_name: authors.get(r.author_id)?.name ?? "Unknown referee",
    author_email: authors.get(r.author_id)?.email ?? null,
  }));
}

export const listDeliveredReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return { reports: await fetchDeliveredReports(context.supabase) };
  });

export const getDeliveredReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: report, error } = await context.supabase
      .from("entries")
      .select(DELIVERED_REPORT_COLUMNS)
      .eq("id", data.id)
      .eq("status", "saved_sent")
      .not("sent_at", "is", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!report) return { report: null };
    const authors = await authorProfiles(context.supabase, [report.author_id]);
    return { report: { ...report, author_name: authors.get(report.author_id)?.name ?? "Unknown referee" } };
  });

// ---------------------------------------------------------------------------
// Bulk report export — same request → fulfill workflow as the activity log
// export. Admins request a range of SENT dates (whole Pacific-time days,
// inclusive); a super admin fulfills it, which returns the rows for the
// browser to turn into a CSV and records the export in the activity log.
// ---------------------------------------------------------------------------

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const requestReportExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    sentFrom: ymd.optional(),
    sentTo: ymd.optional(),
  }).refine((d) => !d.sentFrom || !d.sentTo || d.sentFrom <= d.sentTo, {
    message: "The start date must be on or before the end date.",
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: request, error } = await context.supabase
      .from("report_export_requests")
      .insert({
        requested_by: context.userId,
        sent_from: data.sentFrom ?? null,
        sent_to: data.sentTo ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logActivity(context.supabase, {
      actorId: context.userId,
      action: "report_export_requested",
      targetId: request.id,
      metadata: { sentFrom: request.sent_from, sentTo: request.sent_to },
    });
    return { request };
  });

export const listMyReportExportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("report_export_requests")
      .select("id, sent_from, sent_to, status, report_count, fulfilled_at, created_at")
      .eq("requested_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const listAllReportExportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("report_export_requests")
      .select("id, requested_by, sent_from, sent_to, status, report_count, fulfilled_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const requesters = await authorProfiles(context.supabase, (data ?? []).map((r: any) => r.requested_by));
    return {
      requests: (data ?? []).map((r: any) => ({ ...r, requester_name: requesters.get(r.requested_by)?.name ?? "Unknown" })),
    };
  });

export const fulfillReportExportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: request, error: reqError } = await context.supabase
      .from("report_export_requests")
      .select("id, requested_by, sent_from, sent_to, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqError) throw new Error(reqError.message);
    if (!request) throw new Error("Request not found.");
    if (request.status === "fulfilled") throw new Error("This request was already fulfilled.");

    const range = pacificDayRange(request.sent_from, request.sent_to);
    const reports = await fetchDeliveredReports(context.supabase, {
      sentFrom: range.start,
      sentBefore: range.endExclusive,
      ascending: true,
    });

    const { data: updated, error: updateError } = await context.supabase
      .from("report_export_requests")
      .update({
        status: "fulfilled",
        report_count: reports.length,
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: context.userId,
      })
      .eq("id", data.requestId)
      .select()
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Fulfill failed: no request was updated. Check RLS permissions on report_export_requests.");

    await logActivity(context.supabase, {
      actorId: context.userId,
      action: "report_export_downloaded",
      targetId: request.id,
      metadata: {
        requestedBy: request.requested_by,
        sentFrom: request.sent_from,
        sentTo: request.sent_to,
        reportCount: reports.length,
      },
    });

    return { reports, request: updated };
  });
