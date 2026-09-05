import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { TransactionsPage } from "@/pages/TransactionsPage";

export const Route = createFileRoute("/_authenticated/transactions/")({
  head: () => ({
    meta: [
      { title: "Transactions — PocketPilot" },
      {
        name: "description",
        content: "Search, filter and export every income, expense and bill payment you record.",
      },
      { property: "og:title", content: "Transactions — PocketPilot" },
      {
        property: "og:description",
        content: "Search, filter and export every income, expense and bill payment you record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <TransactionsPage />
    </Layout>
  ),
});
