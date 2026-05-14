import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook called by the Docker PDF/email worker after rendering + sending
 * a report. Updates the report_jobs row and stamps entries.sent_at.
 *
 * Security: HMAC-SHA256 over the raw body, key = PDF_WORKER_CALLBACK_SECRET.
 */
export const Route = createFileRoute("/api/public/report-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PDF_WORKER_CALLBACK_SECRET;
        if (!secret) {
          return new Response("Server not configured", { status: 500 });
        }
        const signature = request.headers.get("x-worker-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expected, "hex");
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const jobId: string | undefined = payload?.jobId;
        const status: string | undefined = payload?.status;
        if (!jobId || !status) {
          return new Response("Missing jobId/status", { status: 400 });
        }

        const updates: Record<string, unknown> = { status };
        if (payload?.lastError) updates.last_error = String(payload.lastError);
        if (typeof payload?.attempts === "number") updates.attempts = payload.attempts;

        const { data: job, error } = await supabaseAdmin
          .from("report_jobs")
          .update(updates)
          .eq("id", jobId)
          .select("entry_id")
          .single();
        if (error) return new Response(error.message, { status: 500 });

        if (status === "sent" && job?.entry_id) {
          await supabaseAdmin
            .from("entries")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", job.entry_id);
        }

        return new Response("ok");
      },
    },
  },
});
