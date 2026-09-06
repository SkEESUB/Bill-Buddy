import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminOverviewPage } from "@/pages/admin/AdminOverviewPage";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Operations overview — BillBuddy Operations" },
      { name: "description", content: "Platform health, scheduler status and operational metrics for BillBuddy staff." },
      { property: "og:title", content: "Operations overview — BillBuddy Operations" },
      { property: "og:description", content: "Platform health, scheduler status and operational metrics for BillBuddy staff." },
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
        <AdminOverviewPage />
      </AdminShell>
    </Layout>
  );
}
