import { useRouterState } from "@tanstack/react-router";
import { getViewingLabel } from "@/lib/viewing";

export function ViewingBadge() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const label = getViewingLabel(pathname);
  if (!label) return null;

  return (
    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
      Acting as: {label}
    </span>
  );
}