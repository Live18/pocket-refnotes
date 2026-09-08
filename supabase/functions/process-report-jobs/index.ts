// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// NOTE ON AUTH APPROACH (deviates from send-password-reset / send-verification-email):
// Those two functions use withSupabase({ auth: ["secret"] }) + ctx.supabaseAdmin.
// That path is broken in local dev right now — the new sb_secret_... key format
// doesn't resolve correctly for withSupabase's secret-mode check OR for
// ctx.supabaseAdmin's table-query access (confirmed via testing: both the auth
// gate and RLS-bypassed queries failed with the "new" key, using the exact
// value pulled straight from the running container's env). Matches a known
// issue in the wild: supabase/cli#4524 ("Secret Key is not compatible with
// local development").
//
// Workaround: skip @supabase/server's built-in secret-key handling entirely.
// Use auth: ["none"] (no built-in gate) + a manual header check against
// SUPABASE_SERVICE_ROLE_KEY (the older, proven key format — confirmed present
// and populated in the container env), and build the admin client directly
// with plain supabase-js instead of ctx.supabaseAdmin.
//
// This function is invoked by pg_cron (server-to-server) on a 1-minute
// schedule, never called from the client. It ignores the request body
// entirely — its job is to find work in the DB, not process the request.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

export default {
  fetch: withSupabase({ auth: ["none"] }, async (req, _ctx) => {
    try {
      const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const providedKey =
        req.headers.get("apikey") ??
        req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

      // Manual secret-key check, replacing withSupabase's built-in 'secret'
      // auth mode (broken locally — see note above). Accepts the key via
      // either apiKey or Authorization: Bearer, whichever pg_cron/curl sends.
      if (!expectedKey || providedKey !== expectedKey) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Built directly with supabase-js + the proven service_role key,
      // bypassing ctx.supabaseAdmin (broken locally with the new key format —
      // see note above). Fully privileged, bypasses RLS, same as
      // ctx.supabaseAdmin would normally provide.
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL"),
        expectedKey
      );

      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      const sendResults = await processQueuedJobs(supabaseAdmin, resend);
      const digestResult = await runDigestCheck(supabaseAdmin, resend);

      return new Response(
        JSON.stringify({ sendResults, digestResult }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error in process-report-jobs:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
};

// ---------------------------------------------------------------------------
// Step 1: process queued jobs
// ---------------------------------------------------------------------------

async function processQueuedJobs(supabaseAdmin, resend) {
  const { data: queuedJobs, error: queuedError } = await supabaseAdmin
    .from("report_jobs")
    .select(`
      id,
      entry_id,
      attempts,
      entries!inner (
        id,
        body,
        recipient_email,
        author_id,
        game:games (
          title,
          opponent,
          location,
          game_date,
          crew
        )
      )
    `)
    .eq("status", "queued");

  if (queuedError) {
    console.error("Error fetching queued jobs:", queuedError);
    return { processed: 0, error: queuedError.message };
  }

  if (!queuedJobs || queuedJobs.length === 0) {
    return { processed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const job of queuedJobs) {
    // Guard against double-processing if a future change ever runs more than
    // one worker instance. Not a concern at current scale, but cheap to do
    // correctly now.
    await supabaseAdmin
      .from("report_jobs")
      .update({ status: "rendering" })
      .eq("id", job.id);

    const entry = job.entries;
    // Confirmed via debug logging (Sep 7): unlike journal.entries.tsx's
    // single-level embed (typed as an array), this double-nested embed
    // (report_jobs -> entries -> games) comes back as a plain object, not
    // an array — no [0] indexing needed here.
    const game = entry?.game;

    try {
      if (!entry?.recipient_email) {
        throw new Error("Entry has no recipient_email set");
      }

      const { error: sendError } = await resend.emails.send({
        from: "noreply@refnotes.app",
        to: [entry.recipient_email],
        subject: `New RefNotes report: ${game?.title ?? "Game report"}`,
        html: buildReportEmailHtml(game, entry),
      });

      // Resend's SDK returns { data, error } rather than throwing for
      // API-level rejections (invalid recipient, unverified domain, etc.) —
      // confirmed via testing (Sep 7): a malformed recipient_email returned
      // 200/no-throw and was silently marked "sent". Must check error
      // explicitly and throw ourselves so the existing retry/failed logic
      // below actually engages.
      if (sendError) {
        throw new Error(sendError.message ?? "Resend rejected the email");
      }

      const { error: sentUpdateError } = await supabaseAdmin
        .from("report_jobs")
        .update({ status: "sent" })
        .eq("id", job.id);

      if (sentUpdateError) {
        console.error(`Failed to mark job ${job.id} as sent:`, sentUpdateError);
      }

      // entries.status is already 'saved_sent' (set at saveAndSend time) —
      // only sent_at needs updating here.
      const { error: entryUpdateError } = await supabaseAdmin
        .from("entries")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", job.entry_id);

      if (entryUpdateError) {
        console.error(`Failed to set sent_at for entry ${job.entry_id}:`, entryUpdateError);
      }

      sent++;
    } catch (sendError) {
      const nextAttempts = (job.attempts ?? 0) + 1;
      const nextStatus = nextAttempts >= 3 ? "failed" : "queued";

      const { error: failUpdateError } = await supabaseAdmin
        .from("report_jobs")
        .update({
          attempts: nextAttempts,
          last_error: sendError.message,
          status: nextStatus,
        })
        .eq("id", job.id);

      if (failUpdateError) {
        console.error(`Failed to update job ${job.id} after send failure:`, failUpdateError);
      }

      if (nextStatus === "failed") {
        failed++;

        // <-- ADDITION: final failure (3rd attempt exhausted) — flip the
        // entry's own status so the referee's own view stops showing "Sent"
        // forever. Mirrors the existing sent_at update above (same shape,
        // same error-logging pattern), just the failure-side counterpart.
        // Not blocking on error here matches how the sent_at update above
        // also just logs and continues — a failed status-flip shouldn't
        // crash the whole batch run.
        const { error: entryFailUpdateError } = await supabaseAdmin
          .from("entries")
          .update({ status: "send_failed" })
          .eq("id", job.entry_id);

        if (entryFailUpdateError) {
          console.error(`Failed to set send_failed for entry ${job.entry_id}:`, entryFailUpdateError);
        }
      } else {
        retried++;
      }
    }
  }

  return { processed: queuedJobs.length, sent, failed, retried };
}

function buildReportEmailHtml(game, entry) {
  const gameDate = game?.game_date
    ? new Date(game.game_date).toLocaleString()
    : "Date not set";
  // Confirmed via debug logging (Sep 7): a real entry's body key was "text",
  // not "notes" as documented for journal.new.tsx's flow — likely created via
  // the separate/legacy New Entry route already flagged as an open
  // discrepancy. Checking both keeps this working regardless of which route
  // created the entry, until that discrepancy is resolved.
  const notes = entry?.body?.notes ?? entry?.body?.text ?? "";

  return `
    <div>
      <h2>${game?.title ?? "Game Report"}</h2>
      <p><strong>Opponent:</strong> ${game?.opponent ?? "—"}</p>
      <p><strong>Location:</strong> ${game?.location ?? "—"}</p>
      <p><strong>Date:</strong> ${gameDate}</p>
      <p><strong>Crew:</strong> ${game?.crew ?? "—"}</p>
      <hr />
      <p>${notes}</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Step 2: digest check — rolling 15-minute failure digest to Super Admins
// ---------------------------------------------------------------------------

async function runDigestCheck(supabaseAdmin, resend) {
  const { data: failedJobs, error: failedError } = await supabaseAdmin
    .from("report_jobs")
    .select(`
      id,
      attempts,
      last_error,
      updated_at,
      entries!inner (
        author_id,
        game:games ( title )
      )
    `)
    .eq("status", "failed")
    .is("notified_at", null)
    .order("updated_at", { ascending: true });

  if (failedError) {
    console.error("Error fetching failed jobs for digest:", failedError);
    return { sent: false, error: failedError.message };
  }

  // Zero rows: nothing wrong, do nothing, no email.
  if (!failedJobs || failedJobs.length === 0) {
    return { sent: false, reason: "no unnotified failures" };
  }

  const oldest = failedJobs[0];
  const oldestAgeMs = Date.now() - new Date(oldest.updated_at).getTime();
  const fifteenMinutesMs = 15 * 60 * 1000;

  // Rolling check, not a fixed-window timer: every tick asks "has the oldest
  // unreported failure been waiting 15+ minutes?" If not, wait for next tick.
  if (oldestAgeMs < fifteenMinutesMs) {
    return { sent: false, reason: "oldest failure under 15 minutes old" };
  }

  const superAdminEmails = await getSuperAdminEmails(supabaseAdmin);

  if (superAdminEmails.length === 0) {
    console.error("No Super Admin emails found — cannot send digest.");
    return { sent: false, error: "no super admin recipients found" };
  }

  const refereeNames = await getRefereeNames(
    supabaseAdmin,
    failedJobs.map((job) => job.entries?.author_id).filter(Boolean)
  );

  const html = buildDigestEmailHtml(failedJobs, refereeNames);

  const { error: digestSendError } = await resend.emails.send({
    from: "noreply@refnotes.app",
    to: superAdminEmails,
    subject: `RefNotes: ${failedJobs.length} report send(s) failed`,
    html,
  });

  // Same Resend error-field gap as the report-send path above — check
  // explicitly rather than assuming a throw.
  if (digestSendError) {
    console.error("Failed to send digest email:", digestSendError);
    return { sent: false, error: digestSendError.message ?? "Resend rejected the digest email" };
  }

  const jobIds = failedJobs.map((job) => job.id);
  const { error: notifyUpdateError } = await supabaseAdmin
    .from("report_jobs")
    .update({ notified_at: new Date().toISOString() })
    .in("id", jobIds);

  if (notifyUpdateError) {
    console.error("Failed to set notified_at after digest send:", notifyUpdateError);
  }

  return { sent: true, jobCount: failedJobs.length };
}

// profiles.role has no direct email — auth.users isn't exposed to PostgREST,
// so Super Admin emails are resolved via the admin API (getUserById), not a
// raw SQL join.
async function getSuperAdminEmails(supabaseAdmin) {
  const { data: superAdmins, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "super_admin");

  if (error || !superAdmins) {
    console.error("Error fetching super_admin profiles:", error);
    return [];
  }

  const emails = [];
  for (const admin of superAdmins) {
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(admin.id);

    if (userError || !userData?.user?.email) {
      console.error(`Could not resolve email for super_admin ${admin.id}:`, userError);
      continue;
    }

    emails.push(userData.user.email);
  }

  return emails;
}

// Referee display name: profiles.display_name if set, otherwise falls back
// to email via the same admin API lookup — display_name has no UI to set it
// yet, so it will be null for everyone until that profile UI is built.
async function getRefereeNames(supabaseAdmin, authorIds) {
  const uniqueIds = [...new Set(authorIds)];
  const names = {};

  if (uniqueIds.length === 0) {
    return names;
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueIds);

  if (error) {
    console.error("Error fetching profiles for digest names:", error);
  }

  const displayNameById = {};
  for (const profile of profiles ?? []) {
    displayNameById[profile.id] = profile.display_name;
  }

  for (const id of uniqueIds) {
    if (displayNameById[id]) {
      names[id] = displayNameById[id];
      continue;
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(id);

    names[id] = userError || !userData?.user?.email
      ? "Unknown referee"
      : userData.user.email;
  }

  return names;
}

function buildDigestEmailHtml(failedJobs, refereeNames) {
  const rows = failedJobs
    .map((job) => {
      const game = job.entries?.game;
      const authorId = job.entries?.author_id;
      const refereeName = refereeNames[authorId] ?? "Unknown referee";

      return `
        <li>
          <strong>${game?.title ?? "Unknown game"}</strong>
          — ${refereeName}
          — ${job.attempts} attempt(s)
          — ${job.last_error ?? "No error message recorded"}
        </li>
      `;
    })
    .join("");

  return `
    <div>
      <p>${failedJobs.length} report send(s) have failed and exhausted retries:</p>
      <ul>${rows}</ul>
    </div>
  `;
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request, using SUPABASE_SERVICE_ROLE_KEY (get it from
     `docker exec supabase_edge_runtime_<project> env | findstr SERVICE_ROLE`
     or `supabase status`):

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-report-jobs' \
    --header 'apiKey: <SUPABASE_SERVICE_ROLE_KEY>'

*/