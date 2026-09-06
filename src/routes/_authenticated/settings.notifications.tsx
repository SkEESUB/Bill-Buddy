import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { NotificationSettingsPage } from "@/pages/settings/NotificationSettingsPage";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — BillBuddy" },
      { name: "description", content: "Decide which bill reminders, budget alerts and summaries BillBuddy sends you." },
      { property: "og:title", content: "Notification Settings — BillBuddy" },
      { property: "og:description", content: "Decide which bill reminders, budget alerts and summaries BillBuddy sends you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <NotificationSettingsPage />
    </Layout>
  ),
});
