import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminGate,
});

function AdminGate() {
  const { me } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (me && !me.isAdmin) {
      router.navigate({ to: "/" });
    }
  }, [me, router]);

  if (!me) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!me.isAdmin) return null;
  return <Outlet />;
}
