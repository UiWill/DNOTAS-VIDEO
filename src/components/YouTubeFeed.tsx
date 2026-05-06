import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Youtube, Play, ExternalLink, Sparkles } from "lucide-react";

interface YouTubeVideo {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
  link: string;
}

export function YouTubeFeed() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("youtube-feed");
        
        if (error) throw error;
        
        if (data?.videos) {
          setVideos(data.videos);
        }
      } catch (err) {
        console.error("Error fetching YouTube feed:", err);
        setError("Não foi possível carregar os vídeos");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || videos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Youtube className="h-5 w-5 text-red-500" />
        <h2 className="text-sm font-semibold">Últimos Vídeos do Canal</h2>
      </div>
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {videos.slice(0, 6).map((video, index) => {
          const isNewest = index === 0;
          return (
            <a
              key={video.id}
              href={video.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
              onClick={(e) => {
                e.preventDefault();
                window.open(video.link, '_blank', 'noopener,noreferrer');
              }}
            >
              <Card className={`h-full overflow-hidden border-border/50 bg-card/50 hover:border-accent/50 hover:bg-card/80 transition-all duration-300 ${isNewest ? 'ring-2 ring-red-500/50' : ''}`}>
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                      <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <h3 className="text-xs font-medium line-clamp-2 min-h-[2.5rem] group-hover:text-accent transition-colors flex-1">
                      {video.title}
                    </h3>
                    {isNewest && (
                      <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1 animate-pulse shrink-0 text-[10px]">
                        <Sparkles className="h-2.5 w-2.5" />
                        NOVO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(video.published)}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
