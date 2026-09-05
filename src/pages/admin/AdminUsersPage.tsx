import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { listUsers } from "@/lib/admin.functions";
import { roleLabel } from "@/lib/admin/permissions";
import { useDebounced } from "@/hooks/useDebounced";
import { Loading } from "./ui";

/** Account lookup. Shows identity and status only — never credentials. */
export function AdminUsersPage() {
  const fetchUsers = useServerFn(listUsers);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 350);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", debounced, page],
    queryFn: () => fetchUsers({ data: debounced ? { search: debounced, page } : { page } }),
  });

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          className="input !pl-11"
          placeholder="Search by email or name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search users"
        />
      </label>

      {isLoading ? (
        <Loading />
      ) : (data?.users.length ?? 0) === 0 ? (
        <p className="card p-6 text-center text-sm text-text-secondary">No accounts matched.</p>
      ) : (
        <ul className="space-y-2">
          {data?.users.map((user) => (
            <li key={user.id}>
              <Link
                to="/admin/users/$id"
                params={{ id: user.id }}
                className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {user.email ?? user.fullName ?? user.id}
                  </p>
                  <p className="truncate text-[12px] text-text-secondary">
                    {user.fullName ?? "No name"}
                    {user.roles.length > 0 ? ` · ${user.roles.map(roleLabel).join(", ")}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                    user.accountStatus === "ACTIVE"
                      ? "bg-success/10 text-success"
                      : "bg-error/10 text-error"
                  }`}
                >
                  {user.accountStatus.replace("_", " ").toLowerCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!debounced && (
        <div className="flex justify-between">
          <button
            type="button"
            className="btn btn-secondary !min-h-10 !px-4 !text-xs"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-secondary !min-h-10 !px-4 !text-xs"
            disabled={!data?.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}