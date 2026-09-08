import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Save } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { updateMyProfile } from "@/lib/auth.functions";

export const Route = createFileRoute("/journal/settings")({
  component: SettingsPage,
});

// Simple format check only — no server-side validation, per Bill's decision (Sep 8)
// to keep this feature small. Not exhaustive RFC 5322, just catches obvious typos.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function SettingsPage() {
  const { me, refresh } = useAuth();
  const updateMyProfileFn = useServerFn(updateMyProfile);

  const [displayName, setDisplayName] = useState(me?.profile?.display_name ?? "");
  const [recipientEmail, setRecipientEmail] = useState(me?.profile?.default_recipient_email ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const emailInvalid = recipientEmail.trim() !== "" && !isValidEmail(recipientEmail.trim());

  const onSave = async () => {
    if (emailInvalid) return;
    try {
      setSaving(true);
      setSaveError(null);
      setSaved(false);
      await updateMyProfileFn({
        data: {
          display_name: displayName.trim() || null,
          default_recipient_email: recipientEmail.trim() || null,
        },
      });
      await refresh(); // pulls the updated profile back into auth context
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col">
      <AppHeader title="Settings" />
      <div className="flex items-center justify-between px-5 pb-3">
        <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
        {saveError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {saveError}
          </div>
        )}
        {saved && (
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            Saved.
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you'd like to appear"
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Default recipient email
          </label>
          <input
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="reports@example.com"
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {emailInvalid && (
            <p className="text-xs text-destructive">Enter a valid email address.</p>
          )}
        </div>

        <button
          onClick={onSave}
          disabled={saving || emailInvalid}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
        >
          <Save size={14} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
