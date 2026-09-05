import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { InsightsPage } from "@/pages/InsightsPage";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — PocketPilot" },
      {
        name: "description",
        content: "Cash flow, category trends, safe-to-spend and deterministic forecasts.",
      },
      { property: "og:title", content: "Insights — PocketPilot" },
      {
        property: "og:description",
        content: "Cash flow, category trends, safe-to-spend and deterministic forecasts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <InsightsPage />
    </Layout>
  ),
});
