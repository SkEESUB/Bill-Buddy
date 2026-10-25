/**
 * Account layer: profile identity, notification preferences, security activity,
 * support tickets, full data export and permanent account deletion.
 *
 * Every function is authenticated and scoped to the calling user.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";

/* ------------------------------- overview ------------------------------- */

export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profile, settings, prefs, user, activity, counts] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
      supabase.auth.getUser(),
      supabase
        .from("audit_logs")
        .select("id, action, entity_type, created_at, metadata")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
      Promise.all([
        supabase.from("bills").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase.from("budgets").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("attachments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]),
    ]);

    const firstError = profile.error ?? settings.error ?? prefs.error ?? activity.error;
    if (firstError) throw new Error(firstError.message);

    const authUser = user.data.user;
    return {
      profile: profile.data ?? null,
      settings: settings.data ?? null,
      notificationPreferences: prefs.data ?? null,
      activity: activity.data ?? [],
      identity: {
        email: authUser?.email ?? null,
        emailConfirmed: Boolean(authUser?.email_confirmed_at),
        phone: authUser?.phone ?? null,
        createdAt: authUser?.created_at ?? null,
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        providers: (authUser?.app_metadata?.["providers"] as string[] | undefined) ?? [],
      },
      counts: {
        bills: counts[0].count ?? 0,
        transactions: counts[1].count ?? 0,
        budgets: counts[2].count ?? 0,
        attachments: counts[3].count ?? 0,
      },
    };
  });

/* -------------------------- notification prefs -------------------------- */

const notificationPrefsInput = z.object({
  bill_reminders: z.boolean().optional(),
  overdue_alerts: z.boolean().optional(),
  payment_confirmations: z.boolean().optional(),
  budget_alerts: z.boolean().optional(),
  weekly_summary: z.boolean().optional(),
  security_alerts: z.boolean().optional(),
});

export type NotificationPrefsInput = z.infer<typeof notificationPrefsInput>;

export const saveNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => notificationPrefsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...data } as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ------------------------------- avatar -------------------------------- */

const AVATAR_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** One-time signed upload URL under the caller's own avatar folder. */
export const createAvatarUpload = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        mime_type: z.enum(AVATAR_MIME),
        file_size: z.number().int().positive().max(MAX_AVATAR_BYTES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext =
      data.mime_type === "image/png" ? "png" : data.mime_type === "image/webp" ? "webp" : "jpg";
    const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

/** Point the profile at a freshly uploaded avatar and drop the previous file. */
export const setAvatar = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z.object({ storage_path: z.string().min(3).max(400).nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.storage_path && !data.storage_path.startsWith(`${userId}/`)) {
      throw new Error("That file does not belong to your account.");
    }
    const { data: existing } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const previous = (existing as { avatar_url: string | null } | null)?.avatar_url ?? null;

    const { data: row, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, avatar_url: data.storage_path } as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (previous && previous !== data.storage_path && previous.startsWith(`${userId}/`)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("avatars").remove([previous]);
    }
    return row;
  });

/** Short-lived link for the caller's own avatar. */
export const getAvatarUrl = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const path = (data as { avatar_url: string | null } | null)?.avatar_url ?? null;
    if (!path) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60);
    if (error) return { url: null as string | null };
    return { url: signed.signedUrl as string | null };
  });

/* ---------------------------- support tickets --------------------------- */

export const listSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        subject: z.string().trim().min(4).max(140),
        description: z.string().trim().min(10).max(4000),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("support_tickets")
      .insert({ ...data, user_id: context.userId } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* -------------------------------- export -------------------------------- */

const EXPORT_TABLES = [
  "profiles",
  "user_settings",
  "notification_preferences",
  "bills",
  "bill_occurrences",
  "transactions",
  "budgets",
  "categories",
  "payments",
  "notifications",
  "attachments",
  "audit_logs",
] as const;

/** Every row the caller owns, as a single JSON archive built from the database. */
export const exportAccountData = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const archive: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user_id: userId,
    };

    // The table name is dynamic here, so query through a loosely typed handle.
    const db = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
    };

    for (const table of EXPORT_TABLES) {
      const column = table === "profiles" ? "id" : "user_id";
      const { data, error } = await db.from(table).select("*").eq(column, userId).limit(20000);
      if (error) throw new Error(`${table}: ${error.message}`);
      archive[table] = data ?? [];
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `billbuddy-account-${stamp}.json`,
      mime: "application/json;charset=utf-8",
      content: JSON.stringify(archive, null, 2),
    };
  });

/* ------------------------------- deletion ------------------------------- */

/**
 * Permanently delete the account. Personal rows cascade with the auth user;
 * only an anonymous, non-identifying summary is retained for financial audit.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        confirmation: z.string(),
        reason: z.string().trim().max(500).optional(),
      })
      .refine((v) => v.confirmation.trim().toUpperCase() === "DELETE", {
        message: "Type DELETE to confirm.",
        path: ["confirmation"],
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [bills, transactions] = await Promise.all([
      supabase.from("bills").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("closed_accounts").insert({
      reason: data.reason ?? null,
      retained_summary: {
        bills: bills.count ?? 0,
        transactions: transactions.count ?? 0,
      },
    } as never);

    // Remove stored files first — storage does not cascade with the auth user.
    for (const bucket of ["receipts", "avatars"]) {
      const { data: files } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
      if (paths.length > 0) await supabaseAdmin.storage.from(bucket).remove(paths);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
