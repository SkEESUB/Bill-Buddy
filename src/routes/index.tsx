import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BillBoard — Track Bills, Due Dates & Payments" },
      {
        name: "description",
        content:
          "BillBoard keeps every bill, due date and payment in one bright dashboard with reminders and spending insights.",
      },
      { property: "og:title", content: "BillBoard — Track Bills, Due Dates & Payments" },
      {
        property: "og:description",
        content: "Track bills, due dates and payments in one simple dashboard.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <Layout>
        <HomePage />
      </Layout>
    </ProtectedRoute>
  ),
});
