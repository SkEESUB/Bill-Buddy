import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminSystemPage } from "@/pages/admin/AdminSystemPage";

export const Route = createFileRoute("/_authenticated/admin/system")({
  head: () => ({
    meta: [
      { title: "System and jobs — PocketPilot Operations" },
      { name: "description", content: "Scheduled job history and manual, idempotent re-runs." },
      { property: "og:title", content: "System and jobs — PocketPilot Operations" },
      { property: "og:description", content: "Scheduled job history and manual, idempotent re-runs." },
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
        <AdminSystemPage />
      </AdminShell>
    </Layout>
  );
}
