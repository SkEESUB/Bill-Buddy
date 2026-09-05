import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { MoneySettingsPage } from "@/pages/settings/MoneySettingsPage";

export const Route = createFileRoute("/_authenticated/settings/money")({
  head: () => ({
    meta: [
      { title: "Money & Budget Settings — PocketPilot" },
      { name: "description", content: "Set your income, starting balance and the defaults used for new budgets." },
      { property: "og:title", content: "Money & Budget Settings — PocketPilot" },
      { property: "og:description", content: "Set your income, starting balance and the defaults used for new budgets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <MoneySettingsPage />
    </Layout>
  ),
});
