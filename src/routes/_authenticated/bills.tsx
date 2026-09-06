import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { BillsPage } from "@/pages/BillsPage";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({
    meta: [
      { title: "Your Bills — BillBuddy" },
      {
        name: "description",
        content: "Search, filter and pay every bill you track in BillBuddy.",
      },
      { property: "og:title", content: "Your Bills — BillBuddy" },
      {
        property: "og:description",
        content: "Search, filter and pay every bill you track in BillBuddy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <BillsPage />
    </Layout>
  ),
});
