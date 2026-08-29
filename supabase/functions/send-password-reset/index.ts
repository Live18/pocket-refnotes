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
      const { email } = await req.json();

      // Generate password reset link
      const { data: resetLinkData } = await ctx.supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });

      if (!resetLinkData?.properties?.action_link) {
        return new Response(
          JSON.stringify({ error: "Failed to generate reset link" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Initialize Resend client
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      // Send email
      const emailResponse = await resend.emails.send({
        from: "noreply@refnotes.app",
        to: [email],
        subject: "Reset your RefNotes password",
        html: `
          <div>
            <a href="${resetLinkData?.properties?.action_link}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
          </div>
        `,
      });

      return new Response(
        JSON.stringify(emailResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error sending password reset email:", error);
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-password-reset' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"email":"user@example.com"}'

*/
