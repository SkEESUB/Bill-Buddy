import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { GoalsPage } from "@/pages/GoalsPage";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — BillBuddy" },
      { name: "description", content: "Track savings goals and financial targets in BillBuddy." },
      { property: "og:title", content: "Goals — BillBuddy" },
      { property: "og:description", content: "Track savings goals and financial targets in BillBuddy." },
    ],
  }),
  component: () => (
    <Layout>
      <GoalsPage />
    </Layout>
  ),
});
