import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { TransactionDetailPage } from "@/pages/TransactionDetailPage";

export const Route = createFileRoute("/_authenticated/transactions/$id")({
  head: () => ({
    meta: [
      { title: "Transaction details — BillBuddy" },
      { name: "description", content: "Full audit trail for a single financial record." },
      { property: "og:title", content: "Transaction details — BillBuddy" },
      { property: "og:description", content: "Full audit trail for a single financial record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  return (
    <Layout>
      <TransactionDetailPage id={id} />
    </Layout>
  );
}
