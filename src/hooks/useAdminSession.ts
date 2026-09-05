import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminSession } from "@/lib/admin.functions";
import type { AdminPermission } from "@/lib/admin/permissions";

export const ADMIN_SESSION_KEY = ["admin", "session"] as const;

/**
 * The caller's administrative role, resolved server-side.
 * Used only to shape the UI — the server re-checks every request.
 */
export function useAdminSession(options?: { enabled?: boolean }) {
  const fetchSession = useServerFn(getAdminSession);
  const query = useQuery({
    queryKey: ADMIN_SESSION_KEY,
    queryFn: () => fetchSession(),
    staleTime: 60_000,
    retry: false,
    enabled: options?.enabled ?? true,
  });

  const permissions = query.data?.permissions ?? [];
  return {
    ...query,
    session: query.data ?? null,
    isAdmin: Boolean(query.data?.isAdmin),
    can: (permission: AdminPermission) => permissions.includes(permission),
  };
}