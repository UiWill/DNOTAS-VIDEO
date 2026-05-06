import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Play, ExternalLink } from "lucide-react";

interface DicaVideo {
  id: string;
  title: string;
  youtube_url: string;
  thumbnail_url: string | null;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function DicasSection() {
  const [dicas, setDicas] = useState<DicaVideo[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from("dicas_videos")
          .select("id, title, youtube_url, thumbnail_url")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (error) throw error;
        setDicas(data || []);
      } catch (err) {
        console.error("Error fetching dicas:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (dicas.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h2 className="text-sm font-semibold">Conteúdos do YouTube</h2>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {dicas.map((dica) => {
          const videoId = extractYouTubeId(dica.youtube_url);
          const thumb =
            dica.thumbnail_url ||
            (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);

          return (
            <a
              key={dica.id}
              href={dica.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full"
            >
              <Card className="h-full overflow-hidden border-border/50 bg-card/50 hover:border-accent/50 hover:bg-card/80 transition-all duration-300">
                <div className="relative aspect-video overflow-hidden bg-black">
                  <div className="w-full h-full relative group">
                    {thumb && (
                      <img
                        src={thumb}
                        alt={dica.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-lg">
                        <ExternalLink className="h-5 w-5 text-accent-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="text-xs font-medium line-clamp-2 min-h-[2.5rem]">
                    {dica.title}
                  </h3>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
