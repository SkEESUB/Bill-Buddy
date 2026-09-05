import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminUserDetailPage } from "@/pages/admin/AdminUserDetailPage";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  head: () => ({
    meta: [
      { title: "Account detail — PocketPilot Operations" },
      { name: "description", content: "Operational view of one PocketPilot account." },
      { property: "og:title", content: "Account detail — PocketPilot Operations" },
      { property: "og:description", content: "Operational view of one PocketPilot account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  return (
    <Layout>
      <AdminShell>
        <AdminUserDetailPage userId={id} />
      </AdminShell>
    </Layout>
  );
}
