import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CreditCard, Shield, Star, ArrowRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionModal({ open, onOpenChange }: SubscriptionModalProps) {
  const { user } = useAuth();
  const { isPending } = useSubscription();
  const paymentLink = "https://pay.looma.app.br/PPWJ0J?plan=y2p7xj5l";

  const handleSubscribe = () => {
    if (paymentLink) {
      window.open(paymentLink, "_blank");
    } else {
      toast.error("Link de pagamento não configurado. Entre em contato com o administrador.");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-yellow-500" />
            Plano de Assinatura
          </DialogTitle>
          <DialogDescription>
            Assine para ter acesso completo à plataforma.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Clock className="h-12 w-12 text-yellow-500" />
            <div>
              <p className="font-semibold text-foreground">Pagamento em análise</p>
              <p className="text-sm text-muted-foreground mt-1">
                Seu pedido está sendo processado. Você receberá acesso assim que o pagamento for confirmado.
              </p>
            </div>
          </div>
        ) : (
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Plano Semestral</h3>
                  <p className="text-sm text-muted-foreground">6 meses de acesso completo</p>
                </div>
                <Badge className="bg-primary text-primary-foreground text-xs">RECOMENDADO</Badge>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-foreground">R$ 1.000</span>
                <span className="text-sm text-muted-foreground">,00</span>
                <span className="text-sm text-muted-foreground ml-1">/ 6 meses</span>
              </div>

              <ul className="space-y-2 text-sm">
                {[
                  "Acesso completo às salas de transmissão",
                  "Acesso a todas as aulas e tutoriais",
                  "Feed de promoções exclusivas",
                  "Suporte prioritário",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <Button onClick={handleSubscribe} className="w-full mt-2" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" />
                Assinar agora
              </Button>

              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Você será redirecionado para a página de pagamento segura. Após a confirmação, seu acesso será liberado pelo administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
