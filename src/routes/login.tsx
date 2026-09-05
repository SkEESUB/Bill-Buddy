import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — PocketPilot" },
      { name: "description", content: "Sign in to manage your bills with PocketPilot." },
      { property: "og:title", content: "Sign In — PocketPilot" },
      {
        property: "og:description",
        content: "Sign in to manage your bills with PocketPilot.",
      },
    ],
  }),
  component: () => <LoginPage />,
});
