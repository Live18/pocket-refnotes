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

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    try {
      const { email, redirectTo } = await req.json();

      const { data: verifyLinkData, error: verifyLinkError } = await ctx.supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: redirectTo ? { redirectTo } : undefined,
      });

      // <-- CHANGE: action_link's host is always broken (hardcoded 127.0.0.1 by
      // the Supabase CLI — see supabase/cli#4006, no config.toml override exists).
      // Only hashed_token is trustworthy; rebuild the link ourselves against our
      // real domain through the same /api/ nginx proxy the client SDK already uses.
      const verificationUrl = verifyLinkData?.properties?.hashed_token
        ? `https://refnotes.app/api/auth/v1/verify?token=${verifyLinkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo ?? "https://refnotes.app")}`
        : undefined;

      if (!verificationUrl) { // <-- CHANGE: was checking verifyLinkData?.properties?.action_link
        return new Response(
          JSON.stringify({
            error: verifyLinkError?.message ?? "Failed to generate verification link",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      const { data: emailData, error: sendError } = await resend.emails.send({
        from: "noreply@refnotes.app",
        to: [email],
        subject: "Verify your RefNotes email",
        html: `
          <div>
            <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a>
          </div>
        `,
      });

      if (sendError) {
        console.error("Resend rejected verification email:", sendError);
        return new Response(
          JSON.stringify({ error: sendError.message ?? "Resend rejected the email" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(emailData),
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