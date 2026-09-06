import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { CategorySettingsPage } from "@/pages/settings/CategorySettingsPage";

export const Route = createFileRoute("/_authenticated/settings/categories")({
  head: () => ({
    meta: [
      { title: "Categories — BillBuddy" },
      { name: "description", content: "Create, rename, hide and delete the categories behind your bills and budgets." },
      { property: "og:title", content: "Categories — BillBuddy" },
      { property: "og:description", content: "Create, rename, hide and delete the categories behind your bills and budgets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <CategorySettingsPage />
    </Layout>
  ),
});
