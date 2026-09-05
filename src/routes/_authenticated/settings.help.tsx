import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { HelpSettingsPage } from "@/pages/settings/HelpSettingsPage";

export const Route = createFileRoute("/_authenticated/settings/help")({
  head: () => ({
    meta: [
      { title: "Help & About — PocketPilot" },
      { name: "description", content: "Contact PocketPilot support, browse FAQs and check the app version." },
      { property: "og:title", content: "Help & About — PocketPilot" },
      { property: "og:description", content: "Contact PocketPilot support, browse FAQs and check the app version." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <HelpSettingsPage />
    </Layout>
  ),
});
