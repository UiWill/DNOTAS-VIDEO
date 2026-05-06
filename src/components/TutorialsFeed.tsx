import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Play, ExternalLink } from "lucide-react";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function TutorialsFeed() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTutorials = async () => {
      try {
        const { data, error } = await supabase
          .from("tutorials")
          .select("id, title, description, youtube_url, thumbnail_url")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .limit(3);

        if (error) throw error;
        setTutorials(data || []);
      } catch (err) {
        console.error("Error fetching tutorials:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTutorials();
  }, []);

  const getThumbnail = (tutorial: Tutorial): string => {
    if (tutorial.thumbnail_url) return tutorial.thumbnail_url;
    const videoId = extractVideoId(tutorial.youtube_url);
    return videoId
      ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      : "/placeholder.svg";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (tutorials.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-accent" />
        <h2 className="text-sm font-semibold">Tutoriais</h2>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {tutorials.map((tutorial) => (
          <a
            key={tutorial.id}
            href={tutorial.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
            onClick={(e) => {
              e.preventDefault();
              window.open(tutorial.youtube_url, "_blank", "noopener,noreferrer");
            }}
          >
            <Card className="h-full overflow-hidden border-border/50 bg-card/50 hover:border-accent/50 hover:bg-card/80 transition-all duration-300">
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={getThumbnail(tutorial)}
                  alt={tutorial.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="text-xs font-medium line-clamp-2 min-h-[2.5rem] group-hover:text-accent transition-colors">
                  {tutorial.title}
                </h3>
                {tutorial.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">
                    {tutorial.description}
                  </p>
                )}
                <div className="flex items-center justify-end mt-2">
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
