import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProfilePage } from "@/pages/ProfilePage";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — BillBuddy" },
      {
        name: "description",
        content: "Update your name, mobile number and default UPI ID in BillBuddy.",
      },
      { property: "og:title", content: "Your Profile — BillBuddy" },
      {
        property: "og:description",
        content: "Update your name, mobile number and default UPI ID in BillBuddy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Layout>
      <ProfilePage />
    </Layout>
  ),
});
