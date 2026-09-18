export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    try {
      const { email, redirectTo } = await req.json(); // <-- CHANGE: accept redirectTo, matching send-verification-email

      const { data: resetLinkData, error: resetLinkError } = await ctx.supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: redirectTo ?? "https://refnotes.app/reset-password" }, // <-- CHANGE: placeholder path — confirm real route
      });

      // <-- CHANGE: action_link's host is always broken (hardcoded 127.0.0.1 by
      // the Supabase CLI — see supabase/cli#4006, no config.toml override exists).
      // Only hashed_token is trustworthy; rebuild the link ourselves against our
      // real domain through the same /api/ nginx proxy the client SDK already uses.
      const resetUrl = resetLinkData?.properties?.hashed_token
        ? `https://refnotes.app/api/auth/v1/verify?token=${resetLinkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(redirectTo ?? "https://refnotes.app/reset-password")}`
        : undefined;

      if (!resetUrl) { // <-- CHANGE: was checking action_link
        return new Response(
          JSON.stringify({ error: resetLinkError?.message ?? "Failed to generate reset link" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      const { data: emailData, error: sendError } = await resend.emails.send({
        from: "noreply@refnotes.app",
        to: [email],
        subject: "Reset your RefNotes password",
        html: `
          <div>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
          </div>
        `,
      });

      if (sendError) {
        console.error("Resend rejected password reset email:", sendError);
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
      console.error("Error sending password reset email:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
};