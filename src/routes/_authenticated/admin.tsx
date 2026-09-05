import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { me } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (me && !me.isAdmin) router.navigate({ to: "/" });
  }, [me, router]);

  if (!me) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!me.isAdmin) return null;

  return (
    <div className="px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <Link to="/" className="rounded-md border border-border px-3 py-1.5 text-xs">← Journal</Link>
        </div>
        <nav className="mt-3 flex gap-3 text-sm">
          <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: "font-bold underline" }}>Members</Link>
          <Link to="/admin/invites" activeProps={{ className: "font-bold underline" }}>Invites</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}