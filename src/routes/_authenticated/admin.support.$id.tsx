import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AdminShell } from "@/pages/admin/ui";
import { AdminTicketPage } from "@/pages/admin/AdminTicketPage";

export const Route = createFileRoute("/_authenticated/admin/support/$id")({
  head: () => ({
    meta: [
      { title: "Support ticket — PocketPilot Operations" },
      { name: "description", content: "Read and answer one PocketPilot support request." },
      { property: "og:title", content: "Support ticket — PocketPilot Operations" },
      { property: "og:description", content: "Read and answer one PocketPilot support request." },
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
        <AdminTicketPage ticketId={id} />
      </AdminShell>
    </Layout>
  );
}
