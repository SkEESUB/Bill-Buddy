/**
 * Server-side authorisation for the admin area.
 *
 * Roles are read with the service role from `user_roles` — never taken from
 * the request — and every denial is written to the audit trail. UI gating is
 * convenience; this is the security boundary.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  hasPermission,
  isAdmin,
  permissionsFor,
  primaryRole,
  type AdminPermission,
} from "./permissions";
import { writeAudit } from "./audit.server";

export type Db = SupabaseClient<Database>;

export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export type AdminActor = {
  userId: string;
  roles: string[];
  permissions: AdminPermission[];
  role: string;
};

export async function rolesOf(db: Db, userId: string): Promise<string[]> {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String(r.role));
}

export async function loadActor(userId: string): Promise<{ db: Db; actor: AdminActor }> {
  const db = await adminDb();
  const roles = await rolesOf(db, userId);
  return {
    db,
    actor: {
      userId,
      roles,
      permissions: permissionsFor(roles),
      role: primaryRole(roles),
    },
  };
}

export class AdminForbiddenError extends Error {
  constructor(permission: string) {
    super(`FORBIDDEN: missing permission ${permission}`);
    this.name = "AdminForbiddenError";
  }
}

/**
 * Resolve the caller and assert one permission. Throws — and records the
 * refusal — when the caller does not hold it.
 */
export async function requireAdmin(
  userId: string,
  permission: AdminPermission,
): Promise<{ db: Db; actor: AdminActor }> {
  const { db, actor } = await loadActor(userId);

  if (!isAdmin(actor.roles) || !hasPermission(actor.roles, permission)) {
    await writeAudit(db, {
      action: "ADMIN_ACCESS_DENIED",
      entityType: "admin",
      actorUserId: userId,
      actorRole: actor.role,
      result: "denied",
      metadata: { permission, roles: actor.roles },
    });
    throw new AdminForbiddenError(permission);
  }

  return { db, actor };
}