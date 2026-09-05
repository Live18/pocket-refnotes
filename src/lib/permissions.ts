import type { MeData } from "@/lib/auth-context";

type Role = MeData["role"];

export type Action =
  | "entries:create"
  | "entries:save"
  | "entries:delete"
  | "entries:send"
  | "users:manage"
  | "reports:manage"
  | "activityLog:request"
  | "admins:manage"
  | "activityLog:manage";

const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  user: ["entries:create", "entries:save", "entries:delete", "entries:send"],
  admin: [
    "entries:create", "entries:save", "entries:delete", "entries:send",
    "users:manage", "reports:manage", "activityLog:request",
  ],
  super_admin: [
    "entries:create", "entries:save", "entries:delete", "entries:send",
    "users:manage", "reports:manage", "activityLog:request",
    "admins:manage", "activityLog:manage",
  ],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}
export type Capability = "journal" | "admin";

export function getCapacities(me: Pick<MeData, "role"> | null): Capability[] {
  if (!me) return [];
  const caps: Capability[] = ["journal"]; // every authenticated user has Journal
  if (me.role === "admin" || me.role === "super_admin") caps.push("admin");
  return caps;
}