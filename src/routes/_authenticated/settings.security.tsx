import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { SecuritySettingsPage } from "@/pages/settings/SecuritySettingsPage";

export const Route = createFileRoute("/_authenticated/settings/security")({
  head: () => ({
    meta: [
      { title: "Security — BillBuddy" },
      { name: "description", content: "Review your sign-in identity, manage sessions and see recent account activity." },
      { property: "og:title", content: "Security — BillBuddy" },
      { property: "og:description", content: "Review your sign-in identity, manage sessions and see recent account activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <SecuritySettingsPage />
    </Layout>
  ),
});
