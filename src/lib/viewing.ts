export interface ViewingRoute {
  path: string;
  label: string;
}

// Ordered most-specific first. "/" is checked last and matched exactly —
// every path starts with "/", so it can't be matched by prefix like the others.
export const VIEWING_ROUTES: ViewingRoute[] = [
  { path: "/admin", label: "Admin" },
  { path: "/", label: "User" },
];

export function getViewingLabel(currentPath: string): string | null {
  for (const route of VIEWING_ROUTES) {
    if (route.path === "/") {
      if (currentPath === "/") return route.label;
      continue;
    }
    if (currentPath === route.path || currentPath.startsWith(route.path + "/")) {
      return route.label;
    }
  }
  return null;
}