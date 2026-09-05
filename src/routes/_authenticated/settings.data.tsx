import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { DataSettingsPage } from "@/pages/settings/DataSettingsPage";

export const Route = createFileRoute("/_authenticated/settings/data")({
  head: () => ({
    meta: [
      { title: "Privacy & Data — PocketPilot" },
      { name: "description", content: "Export every record PocketPilot holds, clear your bills or delete your account." },
      { property: "og:title", content: "Privacy & Data — PocketPilot" },
      { property: "og:description", content: "Export every record PocketPilot holds, clear your bills or delete your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <DataSettingsPage />
    </Layout>
  ),
});
