import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Renders children only for signed-in users.
 * Shows the branded BillBuddy loading screen while the session is being resolved,
 * then renders children or redirects to /login.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <LoadingScreen message="Checking session..." />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
