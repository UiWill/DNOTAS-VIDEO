import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import whatsappLogo from "@/assets/whatsapp-logo.png";
import telegramLogo from "@/assets/telegram-logo.png";

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  platform: string;
  display_order: number;
}

const platformIcons: Record<string, { logo: string; color: string; label: string }> = {
  whatsapp: { logo: whatsappLogo, color: "bg-green-600/20 text-green-400 border-green-600/30", label: "WhatsApp" },
  telegram: { logo: telegramLogo, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Telegram" },
};

const UsefulLinksSection = () => {
  const { data: links = [] } = useQuery({
    queryKey: ["useful-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("useful_links")
        .select("id, title, url, platform, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as UsefulLink[];
    },
  });

  if (links.length === 0) return null;

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          Faça parte do nosso canal de Comunicação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {links.map((link) => {
            const info = platformIcons[link.platform] || platformIcons.whatsapp;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all hover:scale-[1.02] hover:shadow-md ${info.color}`}
              >
                <img src={info.logo} alt={info.label} className="h-7 w-7 rounded-full object-contain" loading="lazy" decoding="async" width={28} height={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{link.title}</p>
                  <p className="text-[11px] opacity-70">{info.label}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default UsefulLinksSection;
