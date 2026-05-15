import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: (s) => search.parse(s),
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, previewAs } = useAuth();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.navigate({ to: redirect ?? "/" });
  }, [isAuthenticated, router, redirect]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { error } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email, password,
            options: { emailRedirectTo: window.location.origin },
          });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-105 active:scale-95 transition disabled:opacity-50">
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Have an invite? <Link to="/" className="underline">Open the link from your email</Link>
        </p>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-4 w-full max-w-sm space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Dev preview</p>
          <p className="text-xs text-muted-foreground">No real auth, no data is saved. Lets you click through the post-login screens.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { previewAs("member"); router.navigate({ to: "/" }); }}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:scale-105 active:scale-95 transition"
            >Preview as Member</button>
            <button
              onClick={() => { previewAs("admin"); router.navigate({ to: "/" }); }}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:scale-105 active:scale-95 transition"
            >Preview as Admin</button>
          </div>
        </div>
      )}
    </div>
  );
}
