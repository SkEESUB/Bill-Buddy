import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — BillBoard" },
      { name: "description", content: "See spending trends across your bills." },
      { property: "og:title", content: "Analytics — BillBoard" },
      { property: "og:description", content: "See spending trends across your bills." },
    ],
  }),
  component: () => (
    <Layout>
      <AnalyticsPage />
    </Layout>
  ),
});
