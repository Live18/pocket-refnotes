import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/auth.functions";
import { getPreviewRole, setPreviewRole, previewMe, type PreviewRole } from "@/lib/preview-mode";

export interface MeData {
  userId: string;
  email: string | null;
  profile: { id: string; display_name: string | null; email: string | null; default_recipient_email: string | null; onboarding_completed_at: string | null } | null; // <-- CHANGE: added default_recipient_email
  role: "user" | "admin" | "super_admin";
  isAdmin: boolean;
}

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  user: User | null;
  me: MeData | null;
  isAuthenticated: boolean;
  previewRole: PreviewRole | null;
  previewAs: (role: PreviewRole) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewRole, setPreviewRoleState] = useState<PreviewRole | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const refresh = async () => {
    if (previewRole) { setMe(previewMe(previewRole) as MeData); return; }
    if (!session) { setMe(null); return; }
    try {
      const data = await getMe();
      console.log("getMe result:", data);    	
      setMe(data as MeData);
    } catch {
      setMe(null);
    }
  };

  useEffect(() => {
    // Hydrate preview role from sessionStorage first.
    const pr = getPreviewRole();
    if (pr) {
      setPreviewRoleState(pr);
      setMe(previewMe(pr) as MeData);
      setLoading(false);
      return;
    }
    // 1. Subscribe FIRST to avoid missed events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    // 2. Then fetch existing session.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionChecked) return;
    if (previewRole) { setMe(previewMe(previewRole) as MeData); return; }
    if (session) {
      refresh().finally(() => setLoading(false));
    } else {
      setMe(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, loading, previewRole, sessionChecked]);

  const previewAs = (role: PreviewRole) => {
    setPreviewRole(role);
    setPreviewRoleState(role);
    setMe(previewMe(role) as MeData);
  };

  return (
    <Ctx.Provider value={{
      loading,
      session,
      user: session?.user ?? null,
      me,
      isAuthenticated: !!session || !!previewRole,
      previewRole,
      previewAs,
      refresh,
      signOut: async () => {
        if (previewRole) {
          setPreviewRole(null);
          setPreviewRoleState(null);
          setMe(null);
          return;
        }
        await supabase.auth.signOut();
      },
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