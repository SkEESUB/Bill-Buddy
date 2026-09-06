import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { NotificationsPage } from "@/pages/NotificationsPage";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — BillBuddy" },
      { name: "description", content: "Every bill reminder, budget alert and payment confirmation in one place." },
      { property: "og:title", content: "Notifications — BillBuddy" },
      { property: "og:description", content: "Every bill reminder, budget alert and payment confirmation in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <NotificationsPage />
    </Layout>
  ),
});
