/**
 * Administrative role model — pure, dependency-free and therefore testable.
 *
 * Roles are stored in `public.user_roles` and are never accepted from the
 * browser. This module only answers the question "given this set of roles,
 * is this permission granted?"; the server decides which roles the caller
 * actually holds.
 */

export const ADMIN_PERMISSIONS = [
  "users.read",
  "users.status",
  "support.read",
  "support.write",
  "payments.read",
  "payments.reconcile",
  "jobs.read",
  "jobs.retry",
  "system.read",
  "audit.read",
  "security.read",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Roles exactly as stored in the `app_role` enum. */
export const APP_ROLES = [
  "super_admin",
  "finance_admin",
  "support_admin",
  "readonly_admin",
  "user",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

const READ_ONLY: AdminPermission[] = [
  "users.read",
  "support.read",
  "payments.read",
  "jobs.read",
  "system.read",
  "audit.read",
  "security.read",
];

const ROLE_PERMISSIONS: Record<AppRole, readonly AdminPermission[]> = {
  // Full operational control.
  super_admin: ADMIN_PERMISSIONS,
  // Operational control over money movement and automation — but no support
  // inbox writes and no account status changes.
  finance_admin: [
    "users.read",
    "support.read",
    "payments.read",
    "payments.reconcile",
    "jobs.read",
    "jobs.retry",
    "system.read",
    "audit.read",
    "security.read",
  ],
  // Customer support: the ticket inbox plus enough account context to help.
  // Deliberately excludes every financial mutation.
  support_admin: ["users.read", "support.read", "support.write", "system.read"],
  readonly_admin: READ_ONLY,
  user: [],
};

/** Permissions that change state. Read-only roles must never hold one. */
export const MUTATING_PERMISSIONS: readonly AdminPermission[] = [
  "users.status",
  "support.write",
  "payments.reconcile",
  "jobs.retry",
];

export const ADMIN_ROLES: readonly AppRole[] = [
  "super_admin",
  "finance_admin",
  "support_admin",
  "readonly_admin",
];

export function isAdminRole(role: string): role is AppRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/** The union of permissions granted by the given roles. Unknown roles grant nothing. */
export function permissionsFor(roles: readonly string[]): AdminPermission[] {
  const granted = new Set<AdminPermission>();
  for (const role of roles) {
    if (!isAdminRole(role)) continue;
    for (const permission of ROLE_PERMISSIONS[role]) granted.add(permission);
  }
  return ADMIN_PERMISSIONS.filter((p) => granted.has(p));
}

export function hasPermission(roles: readonly string[], permission: AdminPermission): boolean {
  return permissionsFor(roles).includes(permission);
}

/** True when the caller may open the admin area at all. */
export function isAdmin(roles: readonly string[]): boolean {
  return roles.some((r) => isAdminRole(r) && ROLE_PERMISSIONS[r].length > 0);
}

/** Human label for a role, used in the admin UI and audit metadata. */
export function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "finance_admin":
      return "Finance admin";
    case "support_admin":
      return "Support";
    case "readonly_admin":
      return "Read only";
    default:
      return "User";
  }
}

/** The highest-privilege role held, for audit records. */
export function primaryRole(roles: readonly string[]): AppRole {
  for (const role of ["super_admin", "finance_admin", "support_admin", "readonly_admin"] as const) {
    if (roles.includes(role)) return role;
  }
  return "user";
}

/* ------------------------------ audit actions ----------------------------- */

export const ADMIN_ACTIONS = [
  "ADMIN_VIEW_USER",
  "ADMIN_SEARCH_USERS",
  "ADMIN_CHANGE_ACCOUNT_STATUS",
  "ADMIN_VIEW_TICKET",
  "ADMIN_UPDATE_SUPPORT_TICKET",
  "ADMIN_REPLY_SUPPORT_TICKET",
  "ADMIN_VIEW_PAYMENT",
  "ADMIN_RECONCILE_PAYMENT",
  "ADMIN_RETRY_JOB",
  "ADMIN_VIEW_SECURITY",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Keys that must never reach an audit record, however they are nested. */
const FORBIDDEN_METADATA = [
  "password",
  "otp",
  "token",
  "secret",
  "key_secret",
  "apikey",
  "api_key",
  "authorization",
  "pin",
  "signature",
  "session",
  "credential",
];

/** Strip anything credential-shaped before it is written to the audit log. */
export function safeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowered = key.toLowerCase();
    if (FORBIDDEN_METADATA.some((bad) => lowered.includes(bad))) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = safeMetadata(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/* ----------------------------- account status ----------------------------- */

export const ACCOUNT_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
  "DELETION_PENDING",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isAccountStatus(value: string): value is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/* ------------------------------ health model ------------------------------ */

export type HealthStatus = "HEALTHY" | "DEGRADED" | "NOT_CONFIGURED" | "FAILING" | "UNKNOWN";

export type HealthCheck = {
  component: string;
  status: HealthStatus;
  detail: string;
};

/** Overall status is the worst individual status. */
export function worstStatus(checks: readonly HealthCheck[]): HealthStatus {
  const order: HealthStatus[] = ["FAILING", "DEGRADED", "NOT_CONFIGURED", "UNKNOWN", "HEALTHY"];
  for (const status of order) {
    if (checks.some((c) => c.status === status)) return status;
  }
  return "HEALTHY";
}