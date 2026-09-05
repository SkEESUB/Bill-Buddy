/**
 * Immutable audit trail — server-only.
 *
 * `audit_logs` has no insert, update or delete policy, so nothing but the
 * service role can write to it and nothing at all can rewrite history. Every
 * administrative action goes through `writeAudit`, including denials: an
 * attempt that was refused is exactly the record an operator needs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { safeMetadata, type AdminAction } from "./permissions";

type Db = SupabaseClient<Database>;

export type AuditEntry = {
  action: AdminAction | string;
  entityType: string;
  entityId?: string | null;
  /** The user the action was performed *on*, when there is one. */
  subjectUserId?: string | null;
  actorUserId: string;
  actorRole: string;
  result?: "success" | "denied" | "error";
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  const { error } = await db.from("audit_logs").insert({
    user_id: entry.subjectUserId ?? entry.actorUserId,
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole,
    actor_type: "admin",
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    result: entry.result ?? "success",
    correlation_id: entry.correlationId ?? null,
    metadata: safeMetadata(entry.metadata ?? {}) as never,
  } as never);
  // An audit write must never mask the outcome of the action itself, but a
  // silent loss would be worse: it is loud in the logs.
  if (error) console.error("[admin:audit] could not record action", entry.action, error.message);
}