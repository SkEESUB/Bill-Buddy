import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminPaymentsPage } from "@/pages/admin/AdminPaymentsPage";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payment operations — PocketPilot Operations" },
      { name: "description", content: "Inspect payment orders and provider webhook delivery." },
      { property: "og:title", content: "Payment operations — PocketPilot Operations" },
      { property: "og:description", content: "Inspect payment orders and provider webhook delivery." },
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
        <AdminPaymentsPage />
      </AdminShell>
    </Layout>
  );
}
