import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { BudgetDetailPage } from "@/pages/BudgetDetailPage";

export const Route = createFileRoute("/_authenticated/money/budgets/$id")({
  head: () => ({
    meta: [
      { title: "Budget detail — BillBuddy" },
      {
        name: "description",
        content: "Cycle progress, historical performance and contributing transactions for a budget.",
      },
      { property: "og:title", content: "Budget detail — BillBuddy" },
      {
        property: "og:description",
        content: "Cycle progress, historical performance and contributing transactions for a budget.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetDetailRoute,
});

function BudgetDetailRoute() {
  const { id } = Route.useParams();
  return (
    <Layout>
      <BudgetDetailPage id={id} />
    </Layout>
  );
}
