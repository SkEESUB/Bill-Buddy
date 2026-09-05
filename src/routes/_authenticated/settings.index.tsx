import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "Settings — PocketPilot" },
      { name: "description", content: "Manage your PocketPilot profile, appearance, notifications, security and data." },
      { property: "og:title", content: "Settings — PocketPilot" },
      { property: "og:description", content: "Manage your PocketPilot profile, appearance, notifications, security and data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <SettingsPage />
    </Layout>
  ),
});
