/**
 * Administrative operations.
 *
 * Every function authenticates the caller, resolves their roles server-side
 * and asserts an explicit permission before touching data. Reads of another
 * person's account and every mutation are written to the immutable audit
 * trail. Nothing here exposes credentials, tokens or payment secrets.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveAccount } from "@/lib/auth/active-account";
import {
  ACCOUNT_STATUSES,
  worstStatus,
  type AdminPermission,
  type HealthCheck,
} from "@/lib/admin/permissions";

/* -------------------------------- session -------------------------------- */

export type AdminSession = {
  userId: string;
  roles: string[];
  role: string;
  permissions: AdminPermission[];
  isAdmin: boolean;
};

/** Who am I, administratively? Safe for any signed-in user to call. */
export const getAdminSession = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }): Promise<AdminSession> => {
    const { loadActor } = await import("@/lib/admin/guard.server");
    const { actor } = await loadActor(context.userId);
    return {
      userId: actor.userId,
      roles: actor.roles,
      role: actor.role,
      permissions: actor.permissions,
      isAdmin: actor.permissions.length > 0,
    };
  });

/* --------------------------------- users --------------------------------- */

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  accountStatus: string;
  roles: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { search?: string; page?: number } | undefined) =>
    z
      .object({ search: z.string().max(200).optional(), page: z.number().int().min(1).max(200).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ users: AdminUserRow[]; page: number; hasMore: boolean }> => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "users.read");

    const page = data.page ?? 1;
    const perPage = 25;
    const search = (data.search ?? "").trim().toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authList, error } = await supabaseAdmin.auth.admin.listUsers({
      page: search ? 1 : page,
      perPage: search ? 1000 : perPage,
    });
    if (error) throw new Error(error.message);

    let authUsers = authList.users;
    if (search) {
      authUsers = authUsers.filter(
        (u) => (u.email ?? "").toLowerCase().includes(search) || u.id === search,
      );
    }

    const ids = authUsers.map((u) => u.id);
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      db.from("profiles").select("id, full_name, account_status").in("id", ids.length ? ids : [""]),
      db.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : [""]),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesById = new Map<string, string[]>();
    for (const row of roleRows ?? []) {
      rolesById.set(row.user_id, [...(rolesById.get(row.user_id) ?? []), String(row.role)]);
    }

    let users: AdminUserRow[] = authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      fullName: profileById.get(u.id)?.full_name ?? null,
      accountStatus: profileById.get(u.id)?.account_status ?? "ACTIVE",
      roles: rolesById.get(u.id) ?? [],
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
    }));

    if (search && users.length === 0) {
      const { data: byName } = await db
        .from("profiles")
        .select("id, full_name, account_status")
        .ilike("full_name", `%${search}%`)
        .limit(perPage);
      users = (byName ?? []).map((p) => ({
        id: p.id,
        email: null,
        fullName: p.full_name,
        accountStatus: p.account_status ?? "ACTIVE",
        roles: rolesById.get(p.id) ?? [],
        createdAt: null,
        lastSignInAt: null,
      }));
    }

    const hasMore = !search && authUsers.length === perPage;
    if (search) {
      await writeAudit(db, {
        action: "ADMIN_SEARCH_USERS",
        entityType: "user",
        actorUserId: actor.userId,
        actorRole: actor.role,
        metadata: { matches: users.length },
      });
      users = users.slice(0, perPage);
    }

    return { users, page, hasMore };
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "users.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const [profile, roles, settings, counts, orders, tickets] = await Promise.all([
      db.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", data.userId),
      db.from("user_settings").select("currency, timezone, theme").eq("user_id", data.userId).maybeSingle(),
      Promise.all([
        db.from("bills").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
        db.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
        db.from("budgets").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
        db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
      ]),
      db
        .from("payment_orders")
        .select("id, amount, currency, status, created_at, captured_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("support_tickets")
        .select("id, subject, status, priority, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    await writeAudit(db, {
      action: "ADMIN_VIEW_USER",
      entityType: "user",
      entityId: data.userId,
      subjectUserId: data.userId,
      actorUserId: actor.userId,
      actorRole: actor.role,
    });

    const p = profile.data;
    return {
      id: data.userId,
      // Identity only — never tokens, password hashes or payment credentials.
      email: authUser?.user?.email ?? null,
      emailConfirmed: Boolean(authUser?.user?.email_confirmed_at),
      createdAt: authUser?.user?.created_at ?? null,
      lastSignInAt: authUser?.user?.last_sign_in_at ?? null,
      fullName: p?.full_name ?? null,
      accountStatus: p?.account_status ?? "ACTIVE",
      statusReason: p?.status_reason ?? null,
      statusChangedAt: p?.status_changed_at ?? null,
      roles: (roles.data ?? []).map((r) => String(r.role)),
      settings: settings.data ?? null,
      counts: {
        bills: counts[0].count ?? 0,
        transactions: counts[1].count ?? 0,
        budgets: counts[2].count ?? 0,
        notifications: counts[3].count ?? 0,
      },
      recentOrders: orders.data ?? [],
      tickets: tickets.data ?? [],
    };
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { userId: string; status: string; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(ACCOUNT_STATUSES),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "users.status");

    if (data.userId === actor.userId) {
      throw new Error("You cannot change the status of your own account");
    }
    // An admin may not act on another admin: that is an escalation path.
    const { rolesOf } = await import("@/lib/admin/guard.server");
    const { isAdmin } = await import("@/lib/admin/permissions");
    const targetRoles = await rolesOf(db, data.userId);
    if (isAdmin(targetRoles)) {
      await writeAudit(db, {
        action: "ADMIN_CHANGE_ACCOUNT_STATUS",
        entityType: "user",
        entityId: data.userId,
        subjectUserId: data.userId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        result: "denied",
        metadata: { reason: "target is an administrator" },
      });
      throw new Error("Administrator accounts cannot be changed from this screen");
    }

    const { data: before } = await db
      .from("profiles")
      .select("account_status")
      .eq("id", data.userId)
      .maybeSingle();

    const { error } = await db
      .from("profiles")
      .update({
        account_status: data.status,
        status_reason: data.reason,
        status_changed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await writeAudit(db, {
      action: "ADMIN_CHANGE_ACCOUNT_STATUS",
      entityType: "user",
      entityId: data.userId,
      subjectUserId: data.userId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      metadata: { from: before?.account_status ?? "ACTIVE", to: data.status, reason: data.reason },
    });

    return { status: data.status };
  });

/* -------------------------------- support -------------------------------- */

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { status?: string } | undefined) =>
    z.object({ status: z.string().max(30).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { db } = await requireAdmin(context.userId, "support.read");

    let query = db
      .from("support_tickets")
      .select("id, user_id, subject, status, priority, assigned_to, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { ticketId: string }) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "support.read");

    const { data: ticket, error } = await db
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found");

    const [{ data: messages }, { supabaseAdmin }] = await Promise.all([
      db
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", data.ticketId)
        .order("created_at", { ascending: true }),
      import("@/integrations/supabase/client.server"),
    ]);
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(ticket.user_id);

    await writeAudit(db, {
      action: "ADMIN_VIEW_TICKET",
      entityType: "support_ticket",
      entityId: data.ticketId,
      subjectUserId: ticket.user_id,
      actorUserId: actor.userId,
      actorRole: actor.role,
    });

    return {
      ticket,
      requesterEmail: authUser?.user?.email ?? null,
      messages: messages ?? [],
    };
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { ticketId: string; status?: string; priority?: string; assignToMe?: boolean }) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "waiting_user", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        assignToMe: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "support.write");

    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.priority) patch["priority"] = data.priority;
    if (data.assignToMe) patch["assigned_to"] = actor.userId;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: row, error } = await db
      .from("support_tickets")
      .update(patch as never)
      .eq("id", data.ticketId)
      .select("user_id, status, priority")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await writeAudit(db, {
      action: "ADMIN_UPDATE_SUPPORT_TICKET",
      entityType: "support_ticket",
      entityId: data.ticketId,
      subjectUserId: row?.user_id ?? null,
      actorUserId: actor.userId,
      actorRole: actor.role,
      metadata: patch,
    });

    return { ok: true };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { ticketId: string; body: string; internal: boolean }) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        internal: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "support.write");

    const { data: ticket } = await db
      .from("support_tickets")
      .select("user_id, subject")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found");

    const { error } = await db.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      author_user_id: actor.userId,
      author_type: "staff",
      body: data.body,
      is_internal: data.internal,
    } as never);
    if (error) throw new Error(error.message);

    if (!data.internal) {
      const { insertDraft } = await import("@/lib/notify.server");
      await insertDraft(db as never, ticket.user_id, {
        type: "security",
        title: "Support replied to your request",
        body: `“${ticket.subject}” has a new reply from the BillBuddy team.`,
        dedupeKey: `support:${data.ticketId}:${Date.now()}`,
      } as never);
    }

    await writeAudit(db, {
      action: "ADMIN_REPLY_SUPPORT_TICKET",
      entityType: "support_ticket",
      entityId: data.ticketId,
      subjectUserId: ticket.user_id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      metadata: { internal: data.internal, length: data.body.length },
    });

    return { ok: true };
  });

/* -------------------------------- payments -------------------------------- */

export const listPaymentOrders = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { status?: string } | undefined) =>
    z.object({ status: z.string().max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { db } = await requireAdmin(context.userId, "payments.read");

    let query = db
      .from("payment_orders")
      .select(
        "id, user_id, amount, currency, status, provider, refunded_amount, failure_code, failure_message, created_at, captured_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    // Provider order/payment identifiers are deliberately omitted from the list.
    return rows ?? [];
  });

export const listWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { db } = await requireAdmin(context.userId, "payments.read");

    const { data, error } = await db
      .from("payment_events")
      .select("id, provider, event_type, payment_order_id, processed, processed_at, process_error, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    // The raw payload is never returned: it can contain contact details.
    return data ?? [];
  });

export const reconcilePayment = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { paymentOrderId: string }) =>
    z.object({ paymentOrderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "payments.reconcile");

    const { reconcileOrderWithProvider, loadOrder } = await import("@/lib/payments/settle.server");
    try {
      const order = await loadOrder(db as never, data.paymentOrderId);
      if (!order) throw new Error("PAYMENT_ORDER_NOT_FOUND");
      const result = await reconcileOrderWithProvider(db as never, order);
      await writeAudit(db, {
        action: "ADMIN_RECONCILE_PAYMENT",
        entityType: "payment_order",
        entityId: data.paymentOrderId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        metadata: { state: (result as { state?: string })?.state ?? null },
      });
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeAudit(db, {
        action: "ADMIN_RECONCILE_PAYMENT",
        entityType: "payment_order",
        entityId: data.paymentOrderId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        result: "error",
        metadata: { message: message.slice(0, 300) },
      });
      throw new Error(message);
    }
  });

/* ------------------------------ system health ----------------------------- */

export const listJobRunsAdmin = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { db } = await requireAdmin(context.userId, "jobs.read");
    const { data, error } = await db
      .from("job_runs")
      .select(
        "id, job, run_key, status, started_at, finished_at, duration_ms, processed, created, failed, retry_count, error",
      )
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const retryJob = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { job: string }) =>
    z.object({ job: z.enum(["sweep", "retention"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { writeAudit } = await import("@/lib/admin/audit.server");
    const { db, actor } = await requireAdmin(context.userId, "jobs.retry");

    const { runNotificationSweep, runNotificationRetention } = await import("@/lib/jobs.server");
    // Both jobs are claim-locked and idempotent, so a manual run can never
    // duplicate work already done for the current window.
    const result = data.job === "retention" ? await runNotificationRetention() : await runNotificationSweep();

    await writeAudit(db, {
      action: "ADMIN_RETRY_JOB",
      entityType: "job",
      entityId: null,
      actorUserId: actor.userId,
      actorRole: actor.role,
      metadata: { job: data.job, ran: result.ran, created: result.created, failed: result.failed },
    });

    return result;
  });

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { db } = await requireAdmin(context.userId, "system.read");

    const checks: HealthCheck[] = [];
    const started = Date.now();

    const { error: dbError } = await db.from("user_settings").select("user_id", { count: "exact", head: true });
    checks.push({
      component: "Database",
      status: dbError ? "FAILING" : "HEALTHY",
      detail: dbError ? dbError.message : `Responded in ${Date.now() - started} ms`,
    });

    const { data: lastSweep } = await db
      .from("job_runs")
      .select("status, started_at, finished_at, failed, created, error")
      .eq("job", "notification_sweep")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastSweep) {
      checks.push({ component: "Scheduler", status: "UNKNOWN", detail: "No run recorded yet" });
    } else {
      const ageMs = Date.now() - new Date(lastSweep.started_at).getTime();
      const stale = ageMs > 3 * 60 * 60 * 1000;
      checks.push({
        component: "Scheduler",
        status: lastSweep.status === "failed" ? "FAILING" : stale ? "DEGRADED" : "HEALTHY",
        detail: stale
          ? `Last run ${Math.round(ageMs / 3_600_000)} h ago`
          : `Last run ${lastSweep.status}, ${lastSweep.created} notifications created`,
      });
    }

    const { data: lastRetention } = await db
      .from("job_runs")
      .select("status, started_at, processed")
      .eq("job", "notification_retention")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    checks.push({
      component: "Retention",
      status: !lastRetention ? "UNKNOWN" : lastRetention.status === "failed" ? "FAILING" : "HEALTHY",
      detail: lastRetention
        ? `Last run ${new Date(lastRetention.started_at).toISOString().slice(0, 16).replace("T", " ")} UTC, ${lastRetention.processed} pruned`
        : "No run recorded yet",
    });

    const { readConfig, webhookConfigured, isSandboxKey } = await import("@/lib/payments/provider.server");
    const config = readConfig();
    checks.push({
      component: "Payment provider",
      status: config ? "HEALTHY" : "NOT_CONFIGURED",
      detail: config
        ? `Razorpay keys present (${isSandboxKey(config.keyId) ? "test" : "live"} mode)`
        : "Razorpay credentials not set — checkout is disabled",
    });
    checks.push({
      component: "Payment webhook",
      status: webhookConfigured() ? "HEALTHY" : "NOT_CONFIGURED",
      detail: webhookConfigured() ? "Signing secret present" : "Webhook secret not set",
    });

    const { count: unprocessed } = await db
      .from("payment_events")
      .select("id", { count: "exact", head: true })
      .eq("processed", false);
    checks.push({
      component: "Webhook queue",
      status: (unprocessed ?? 0) > 10 ? "DEGRADED" : "HEALTHY",
      detail: `${unprocessed ?? 0} unprocessed events`,
    });

    const [{ count: users }, { count: notifications }, { count: openTickets }] = await Promise.all([
      db.from("user_settings").select("user_id", { count: "exact", head: true }),
      db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    ]);

    return {
      overall: worstStatus(checks),
      checks,
      metrics: {
        users: users ?? 0,
        unreadNotifications: notifications ?? 0,
        openTickets: openTickets ?? 0,
      },
      generatedAt: new Date().toISOString(),
    };
  });

/* --------------------------------- audit ---------------------------------- */

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((input: { action?: string; actorUserId?: string } | undefined) =>
    z
      .object({ action: z.string().max(60).optional(), actorUserId: z.string().uuid().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/admin/guard.server");
    const { db } = await requireAdmin(context.userId, "audit.read");

    let query = db
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_user_id, actor_role, actor_type, result, user_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.action) query = query.eq("action", data.action);
    if (data.actorUserId) query = query.eq("actor_user_id", data.actorUserId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });