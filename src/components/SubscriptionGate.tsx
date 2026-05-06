import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Lock, Star, Clock, LogOut, RefreshCw, ExternalLink } from "lucide-react";
import logo from "@/assets/logo.png";

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isAdmin, isMark, signOut, refreshRoles } = useAuth();
  const { isActive, isPending, isLoading, daysRemaining, refetch } = useSubscription();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const paymentLink = "https://pay.looma.app.br/PPWJ0J?plan=y2p7xj5l";

  // Auto-refresh when user returns to the tab (e.g. after payment)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isActive && !isAdmin && !isMark) {
        refetch();
        refreshRoles?.();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive, isAdmin, isMark, refetch, refreshRoles]);

  const handleCheckStatus = useCallback(async () => {
    setChecking(true);
    await Promise.all([refetch(), refreshRoles?.()]);
    setTimeout(() => setChecking(false), 1500);
  }, [refetch, refreshRoles]);

  // Admins and mark users bypass subscription check
  if (isAdmin || isMark) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isActive) return <>{children}</>;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <img src={logo} alt="DNOTAS TREINAMENTOS" className="h-16 w-auto mb-8" decoding="async" width={64} height={64} />

      {isPending ? (
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="rounded-full bg-yellow-500/10 p-4">
            <Clock className="h-10 w-10 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Pagamento em análise</h2>
          <p className="text-sm text-muted-foreground">
            Seu pedido de assinatura está sendo analisado. O acesso será liberado assim que o pagamento for confirmado.
          </p>
          <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checking} className="mt-2 gap-2">
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Verificar status"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="rounded-full bg-destructive/10 p-4">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Sua assinatura expirou ou você ainda não possui um plano ativo. Assine para continuar usando a plataforma.
          </p>
          <Button onClick={() => window.open(paymentLink, "_blank")} size="lg" className="mt-2 gap-2">
            <ExternalLink className="h-4 w-4" />
            Assinar agora
          </Button>
          <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checking} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Já paguei, verificar acesso"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      )}
    </div>
  );
}
