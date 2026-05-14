import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/auth.functions";

export interface MeData {
  userId: string;
  email: string | null;
  profile: { id: string; org_id: string | null; display_name: string | null; email: string | null; onboarding_completed_at: string | null } | null;
  roles: { role: "admin" | "member"; orgId: string }[];
  isAdmin: boolean;
}

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  user: User | null;
  me: MeData | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!session) { setMe(null); return; }
    try {
      const data = await getMe();
      setMe(data as MeData);
    } catch {
      setMe(null);
    }
  };

  useEffect(() => {
    // 1. Subscribe FIRST to avoid missed events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    // 2. Then fetch existing session.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (session) refresh().finally(() => {});
    else setMe(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, loading]);

  return (
    <Ctx.Provider value={{
      loading,
      session,
      user: session?.user ?? null,
      me,
      refresh,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
