import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — BillBuddy" },
      { name: "description", content: "Sign in to manage your bills with BillBuddy." },
      { property: "og:title", content: "Sign In — BillBuddy" },
      {
        property: "og:description",
        content: "Sign in to manage your bills with BillBuddy.",
      },
    ],
  }),
  component: () => <LoginPage />,
});
