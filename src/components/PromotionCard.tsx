import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PromotionCardProps {
  deskName: string;
  description?: string | null;
  logoUrl?: string | null;
  websiteUrl: string;
  couponCode: string;
}

export function PromotionCard({
  deskName,
  description,
  logoUrl,
  websiteUrl,
  couponCode,
}: PromotionCardProps) {
  const [copied, setCopied] = useState(false);

  const handleGetCoupon = async () => {
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);
      toast.success(`Cupom "${couponCode}" copiado!`);
      
      // Wait a moment before redirecting
      setTimeout(() => {
        window.open(websiteUrl, "_blank", "noopener,noreferrer");
      }, 500);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar cupom");
    }
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg border-border/50 bg-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <img
                src={logoUrl}
                alt={deskName}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-primary">
                {deskName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground truncate">
              {deskName}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleGetCoupon}
          className="w-full gap-2 transition-all"
          variant={copied ? "secondary" : "default"}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Cupom Copiado!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Pegar Cupom
              <ExternalLink className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
