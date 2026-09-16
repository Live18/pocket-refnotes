// diagnostic test 2
// diagnostic test
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
// Import Resend client
import { Resend } from "npm:resend@2.0.0";

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    try {
      const { email, redirectTo } = await req.json(); // <-- CHANGE: accept an optional redirectTo from the caller

      // Using 'magiclink' rather than 'signup': generateLink's 'signup' type is
      // documented for creating a NEW user and is unreliable/undocumented for an
      // already-created-but-unconfirmed user (the case here, since real signup via
      // /auth/v1/signup already created the account). 'magiclink' is documented to
      // work for existing users and, when clicked, confirms the email as a side
      // effect of completing the login. Confirm this behaves as expected via a
      // direct curl test before wiring this into the signup flow.
      const { data: verifyLinkData, error: verifyLinkError } = await ctx.supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        // <-- ADDITION: without this, the link falls back to the project's default
        // Site URL instead of returning the user to the invite-accept page they
        // started from. Must also be present in Supabase Auth's redirect allow-list
        // or Supabase will silently ignore it and fall back anyway.
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (!verifyLinkData?.properties?.action_link) {
        // <-- CHANGE: surface the actual error from generateLink instead of
        // discarding it — this was previously silent, which is exactly what
        // made the earlier "zero attempts logged, no error" delivery bug slow
        // to diagnose.
        return new Response(
          JSON.stringify({
            error: verifyLinkError?.message ?? "Failed to generate verification link",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Initialize Resend client
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      // Send email
      // <-- CHANGE: destructure { data, error } — same Resend-doesn't-throw gap
      // already fixed in process-report-jobs and send-password-reset.
      const { data: emailData, error: sendError } = await resend.emails.send({
        from: "noreply@refnotes.app",
        to: [email],
        subject: "Verify your RefNotes email",
        html: `
          <div>
            <a href="${verifyLinkData?.properties?.action_link}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a>
          </div>
        `,
      });

      // <-- ADDITION: this is very likely the actual root cause of the
      // "zero attempts logged, no error" verification-email delivery bug your
      // notes flagged — a rejected send was silently reported as 200 success.
      if (sendError) {
        console.error("Resend rejected verification email:", sendError);
        return new Response(
          JSON.stringify({ error: sendError.message ?? "Resend rejected the email" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(emailData), // <-- CHANGE: was emailResponse — now just the successful data
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error sending verification email:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
};

/* To invoke locally:
  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-verification-email' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"email":"user@example.com","redirectTo":"http://localhost:8080/accept-invite/some-token"}'
*/