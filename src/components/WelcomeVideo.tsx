import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Tv } from "lucide-react";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

interface WelcomeVideoProps {
  isMark?: boolean;
}

export function WelcomeVideo({ isMark = false }: WelcomeVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("welcome_video_url, welcome_video_url_mark, welcome_video_enabled")
        .limit(1)
        .single();
      if (data) {
        const d = data as any;
        if (d.welcome_video_enabled) {
          const url = isMark ? (d.welcome_video_url_mark || d.welcome_video_url) : d.welcome_video_url;
          if (url) {
            setEnabled(true);
            setVideoUrl(url);
          }
        }
      }
    };
    fetchVideo();
  }, [isMark]);

  if (!enabled || !videoUrl) return null;

  const youtubeId = extractYouTubeId(videoUrl);

  return (
    <Card className="glass-panel border border-border/80 animate-fade-in h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Tv className="h-4 w-4 text-accent" />
          Bem-vindo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
          {youtubeId ? (
            playing ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : (
              <button onClick={() => setPlaying(true)} className="w-full h-full relative group">
                <img
                  src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                  alt="Vídeo de boas-vindas"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-accent/90 flex items-center justify-center shadow-lg">
                    <Play className="h-5 w-5 text-accent-foreground fill-current ml-0.5" />
                  </div>
                </div>
              </button>
            )
          ) : (
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              preload="metadata"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
