import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminAuditPage } from "@/pages/admin/AdminAuditPage";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — BillBuddy Operations" },
      { name: "description", content: "The immutable record of every administrative action." },
      { property: "og:title", content: "Audit trail — BillBuddy Operations" },
      { property: "og:description", content: "The immutable record of every administrative action." },
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
        <AdminAuditPage />
      </AdminShell>
    </Layout>
  );
}
