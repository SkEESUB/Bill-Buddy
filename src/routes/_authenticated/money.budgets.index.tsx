import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { BudgetsPage } from "@/pages/BudgetsPage";

export const Route = createFileRoute("/_authenticated/money/budgets/")({
  head: () => ({
    meta: [
      { title: "Budgets — PocketPilot" },
      {
        name: "description",
        content: "Create and track category budgets with spend, remaining amount and status.",
      },
      { property: "og:title", content: "Budgets — PocketPilot" },
      {
        property: "og:description",
        content: "Create and track category budgets with spend, remaining amount and status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <BudgetsPage />
    </Layout>
  ),
});
