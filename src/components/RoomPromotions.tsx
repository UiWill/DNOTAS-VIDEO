import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, Gift, Star, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface DeskPromotion {
  id: string;
  desk_name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string;
  coupon_code: string;
  is_featured: boolean;
}

export function RoomPromotions() {
  const [promotions, setPromotions] = useState<DeskPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("desk_promotions")
      .select("id, desk_name, description, logo_url, website_url, coupon_code, is_featured")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPromotions(data || []);
        setLoading(false);
      });
  }, []);

  const handleGetCoupon = async (promo: DeskPromotion) => {
    try {
      await navigator.clipboard.writeText(promo.coupon_code);
      setCopiedId(promo.id);
      toast.success(`Cupom "${promo.coupon_code}" copiado!`);
      setTimeout(() => window.open(promo.website_url, "_blank", "noopener,noreferrer"), 500);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Erro ao copiar cupom");
    }
  };

  if (loading || promotions.length === 0) return null;

  const featuredPromo = promotions.find(p => p.is_featured);
  const regularPromos = promotions.filter(p => !p.is_featured);

  const renderPromotionCard = (promo: DeskPromotion, isFeatured: boolean = false) => {
    const isCopied = copiedId === promo.id;

    return (
      <div
        key={promo.id}
        className={`group relative overflow-hidden rounded-xl border p-4 ${
          isFeatured
            ? "border-amber-500/60 bg-gradient-to-br from-amber-500/15 via-card to-amber-600/10 shadow-lg shadow-amber-500/20 col-span-full"
            : "border-border/60 bg-gradient-to-br from-card to-muted/30 hover:border-accent/40"
        }`}
      >
        {isFeatured && (
          <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white gap-1.5 border-0 shadow-lg shadow-amber-500/30">
            <Sparkles className="h-3 w-3" />
            EM CONTA
            <Star className="h-3 w-3 fill-current" />
          </Badge>
        )}

        <div className={`relative z-10 flex ${isFeatured ? "flex-row items-center gap-5" : "flex-col"} h-full`}>
          {/* Logo */}
          <div className={`flex items-center gap-3 ${isFeatured ? "flex-shrink-0" : "mb-3"}`}>
            {promo.logo_url ? (
              <img
                src={promo.logo_url}
                alt={promo.desk_name}
                className={`${isFeatured ? "h-16 w-16" : "h-14 w-14"} object-contain flex-shrink-0`}
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className={`${isFeatured ? "h-16 w-16" : "h-14 w-14"} rounded-lg ${isFeatured ? "bg-amber-500/20 border-amber-500/40" : "bg-accent/10 border-accent/20"} border flex items-center justify-center flex-shrink-0`}>
                <span className={`${isFeatured ? "text-base" : "text-sm"} font-bold ${isFeatured ? "text-amber-500" : "text-accent"}`}>
                  {promo.desk_name.charAt(0)}
                </span>
              </div>
            )}
            {!isFeatured && (
              <h3 className="font-semibold text-sm text-foreground leading-tight">
                {promo.desk_name}
              </h3>
            )}
          </div>

          {/* Content */}
          <div className={`flex-1 ${isFeatured ? "flex flex-col justify-center" : ""}`}>
            {isFeatured && (
              <h3 className="font-bold text-base text-foreground leading-tight mb-1">
                {promo.desk_name}
              </h3>
            )}
            {promo.description && (
              <p className={`${isFeatured ? "text-sm" : "text-xs"} text-muted-foreground line-clamp-2 mb-3 flex-1`}>
                {promo.description}
              </p>
            )}
          </div>

          {/* CTA */}
          <Button
            onClick={() => handleGetCoupon(promo)}
            size={isFeatured ? "default" : "sm"}
            className={`${isFeatured ? "flex-shrink-0 px-5" : "w-full"} gap-2 ${isFeatured ? "text-sm" : "text-xs"} ${
              isCopied
                ? "bg-emerald-600 hover:bg-emerald-700"
                : isFeatured
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
                  : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            }`}
          >
            {isCopied ? (
              <>
                <Check className={isFeatured ? "h-4 w-4" : "h-3 w-3"} />
                Copiado!
              </>
            ) : (
              <>
                <Copy className={isFeatured ? "h-4 w-4" : "h-3 w-3"} />
                Pegar Cupom
                <ExternalLink className={isFeatured ? "h-3 w-3" : "h-2.5 w-2.5"} />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="glass-panel border border-border/80">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4 text-accent" />
          Promoções de Mesas Proprietárias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {featuredPromo && renderPromotionCard(featuredPromo, true)}
          {regularPromos.map((promo) => renderPromotionCard(promo, false))}
        </div>
      </CardContent>
    </Card>
  );
}
