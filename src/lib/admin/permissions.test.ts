import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  MUTATING_PERMISSIONS,
  hasPermission,
  isAdmin,
  isAdminRole,
  permissionsFor,
  primaryRole,
  safeMetadata,
  worstStatus,
  type HealthCheck,
} from "./permissions";

describe("role model", () => {
  it("grants a super admin every permission", () => {
    expect(permissionsFor(["super_admin"])).toEqual([...ADMIN_PERMISSIONS]);
  });

  it("grants an ordinary user nothing", () => {
    expect(permissionsFor(["user"])).toEqual([]);
    expect(isAdmin(["user"])).toBe(false);
  });

  it("treats unknown roles as powerless", () => {
    expect(permissionsFor(["root", "owner", ""])).toEqual([]);
    expect(isAdminRole("root")).toBe(false);
  });

  it("never lets a read-only admin mutate anything", () => {
    for (const permission of MUTATING_PERMISSIONS) {
      expect(hasPermission(["readonly_admin"], permission)).toBe(false);
    }
    expect(hasPermission(["readonly_admin"], "users.read")).toBe(true);
  });

  it("keeps support away from money and account status", () => {
    expect(hasPermission(["support_admin"], "support.write")).toBe(true);
    expect(hasPermission(["support_admin"], "payments.reconcile")).toBe(false);
    expect(hasPermission(["support_admin"], "payments.read")).toBe(false);
    expect(hasPermission(["support_admin"], "users.status")).toBe(false);
  });

  it("keeps finance away from the support inbox and account status", () => {
    expect(hasPermission(["finance_admin"], "payments.reconcile")).toBe(true);
    expect(hasPermission(["finance_admin"], "jobs.retry")).toBe(true);
    expect(hasPermission(["finance_admin"], "support.write")).toBe(false);
    expect(hasPermission(["finance_admin"], "users.status")).toBe(false);
  });

  it("reserves account status changes for super admins", () => {
    const holders = (["super_admin", "finance_admin", "support_admin", "readonly_admin"] as const).filter(
      (role) => hasPermission([role], "users.status"),
    );
    expect(holders).toEqual(["super_admin"]);
  });

  it("unions permissions across multiple roles without duplicates", () => {
    const combined = permissionsFor(["support_admin", "finance_admin"]);
    expect(new Set(combined).size).toBe(combined.length);
    expect(combined).toContain("support.write");
    expect(combined).toContain("payments.reconcile");
    expect(combined).not.toContain("users.status");
  });

  it("reports the highest-privilege role held", () => {
    expect(primaryRole(["readonly_admin", "super_admin"])).toBe("super_admin");
    expect(primaryRole(["support_admin", "readonly_admin"])).toBe("support_admin");
    expect(primaryRole([])).toBe("user");
  });
});

describe("audit metadata", () => {
  it("drops credential-shaped keys at any depth", () => {
    const cleaned = safeMetadata({
      userId: "u1",
      password: "hunter2",
      nested: { access_token: "t", note: "keep", provider: { key_secret: "s", id: "ok" } },
    });
    expect(cleaned).toEqual({ userId: "u1", nested: { note: "keep", provider: { id: "ok" } } });
  });

  it("keeps ordinary values including arrays and nulls", () => {
    expect(safeMetadata({ roles: ["a"], reason: null, count: 2 })).toEqual({
      roles: ["a"],
      reason: null,
      count: 2,
    });
  });
});

describe("system health", () => {
  const check = (status: HealthCheck["status"]): HealthCheck => ({
    component: "c",
    status,
    detail: "",
  });

  it("reports the worst component status", () => {
    expect(worstStatus([check("HEALTHY"), check("DEGRADED")])).toBe("DEGRADED");
    expect(worstStatus([check("NOT_CONFIGURED"), check("FAILING")])).toBe("FAILING");
    expect(worstStatus([check("HEALTHY")])).toBe("HEALTHY");
    expect(worstStatus([])).toBe("HEALTHY");
  });
});