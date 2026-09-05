import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminSupportPage } from "@/pages/admin/AdminSupportPage";

export const Route = createFileRoute("/_authenticated/admin/support/")({
  head: () => ({
    meta: [
      { title: "Support inbox — PocketPilot Operations" },
      { name: "description", content: "Triage and answer PocketPilot support requests." },
      { property: "og:title", content: "Support inbox — PocketPilot Operations" },
      { property: "og:description", content: "Triage and answer PocketPilot support requests." },
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
        <AdminSupportPage />
      </AdminShell>
    </Layout>
  );
}
