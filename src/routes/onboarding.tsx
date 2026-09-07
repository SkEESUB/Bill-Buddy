import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Get Started — BillBuddy" },
      { name: "description", content: "Set up your BillBuddy account." },
    ],
  }),
  component: () => <OnboardingPage />,
});
