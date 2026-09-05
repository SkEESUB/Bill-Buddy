import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AppearanceSettingsPage } from "@/pages/settings/AppearanceSettingsPage";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => ({
    meta: [
      { title: "Appearance & Locale — PocketPilot" },
      { name: "description", content: "Choose light or dark theme, reduce motion, and set your currency and timezone." },
      { property: "og:title", content: "Appearance & Locale — PocketPilot" },
      { property: "og:description", content: "Choose light or dark theme, reduce motion, and set your currency and timezone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <AppearanceSettingsPage />
    </Layout>
  ),
});
