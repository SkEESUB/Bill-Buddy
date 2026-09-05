import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { HistoryPage } from "@/pages/HistoryPage";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Payment History — BillBoard" },
      { name: "description", content: "Review every bill payment you have made." },
      { property: "og:title", content: "Payment History — BillBoard" },
      {
        property: "og:description",
        content: "Review every bill payment you have made.",
      },
    ],
  }),
  component: () => (
    <Layout>
      <HistoryPage />
    </Layout>
  ),
});
