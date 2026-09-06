import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  head: () => ({
    meta: [
      { title: "User operations — BillBuddy Operations" },
      { name: "description", content: "Search BillBuddy accounts and review their status." },
      { property: "og:title", content: "User operations — BillBuddy Operations" },
      { property: "og:description", content: "Search BillBuddy accounts and review their status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Layout>
      <AdminShell>
        <AdminUsersPage />
      </AdminShell>
    </Layout>
  );
}
