import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProfilePage } from "@/pages/ProfilePage";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — PocketPilot" },
      {
        name: "description",
        content: "Update your name, mobile number and default UPI ID in PocketPilot.",
      },
      { property: "og:title", content: "Your Profile — PocketPilot" },
      {
        property: "og:description",
        content: "Update your name, mobile number and default UPI ID in PocketPilot.",
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
