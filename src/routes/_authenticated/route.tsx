import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });

    // A suspended or closed account keeps its data but loses access.
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.account_status !== "ACTIVE") {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
