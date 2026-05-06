import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SubscriptionGate } from "@/components/SubscriptionGate";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireMark?: boolean;
  skipSubscription?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireMark = false, skipSubscription = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isMark } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireMark && !isMark) {
    return <Navigate to="/dashboard" replace />;
  }

  if (skipSubscription) {
    return <>{children}</>;
  }

  return <SubscriptionGate>{children}</SubscriptionGate>;
}
