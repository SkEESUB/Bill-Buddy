import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { PaymentSettingsPage } from "@/pages/settings/PaymentSettingsPage";

export const Route = createFileRoute("/_authenticated/settings/payments")({
  head: () => ({
    meta: [
      { title: "Payment Settings — PocketPilot" },
      { name: "description", content: "Set your default UPI ID and review how PocketPilot handles bill payments." },
      { property: "og:title", content: "Payment Settings — PocketPilot" },
      { property: "og:description", content: "Set your default UPI ID and review how PocketPilot handles bill payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <PaymentSettingsPage />
    </Layout>
  ),
});
