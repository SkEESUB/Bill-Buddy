import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { MoneyPage } from "@/pages/MoneyPage";

export const Route = createFileRoute("/_authenticated/money/")({
  head: () => ({
    meta: [
      { title: "Money Tracker — PocketPilot" },
      {
        name: "description",
        content: "Track income, expenses and category budgets alongside your bills.",
      },
      { property: "og:title", content: "Money Tracker — PocketPilot" },
      {
        property: "og:description",
        content: "Track income, expenses and category budgets alongside your bills.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <MoneyPage />
    </Layout>
  ),
});
