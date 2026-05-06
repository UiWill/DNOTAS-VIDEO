import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Play, ExternalLink, ArrowLeft, Monitor, Building2, Lightbulb } from "lucide-react";
import logo from "@/assets/logo.png";
import Footer from "@/components/Footer";

type TutorialCategory = "plataformas" | "mesas" | "dicas_operacionais";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  category: TutorialCategory;
}

const categoryLabels: Record<TutorialCategory, { label: string; icon: React.ReactNode }> = {
  plataformas: { label: "Plataformas", icon: <Monitor className="h-4 w-4" /> },
  mesas: { label: "Mesas", icon: <Building2 className="h-4 w-4" /> },
  dicas_operacionais: { label: "Dicas Operacionais", icon: <Lightbulb className="h-4 w-4" /> },
};

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

const TutorialsPage = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TutorialCategory>("plataformas");

  useEffect(() => {
    const fetchTutorials = async () => {
      try {
        const { data, error } = await supabase
          .from("tutorials")
          .select("id, title, description, youtube_url, thumbnail_url, category")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (error) throw error;
        setTutorials((data as Tutorial[]) || []);
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

  const filteredTutorials = tutorials.filter((t) => t.category === activeTab);

  const renderTutorialGrid = (tutorialsList: Tutorial[]) => {
    if (tutorialsList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-sm">
            Nenhum tutorial disponível nesta categoria.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tutorialsList.map((tutorial) => (
          <a
            key={tutorial.id}
            href={tutorial.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
            onClick={(e) => {
              e.preventDefault();
              window.open(
                tutorial.youtube_url,
                "_blank",
                "noopener,noreferrer"
              );
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
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                    <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="text-xs font-medium line-clamp-2 min-h-[2.5rem] group-hover:text-accent transition-colors">
                  {tutorial.title}
                </h3>
                {tutorial.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
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
    );
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pb-6">
        <div className="flex items-start gap-3">
          <Link to="/dashboard">
            <img
              src={logo}
              alt="Logo"
              className="h-20 w-auto flex-shrink-0 object-contain cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Área de aprendizado
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Tutoriais
            </h1>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl flex-grow">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full max-w-md" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-video rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TutorialCategory)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              {(Object.keys(categoryLabels) as TutorialCategory[]).map((cat) => (
                <TabsTrigger key={cat} value={cat} className="flex items-center gap-2 text-xs sm:text-sm">
                  {categoryLabels[cat].icon}
                  <span className="hidden sm:inline">{categoryLabels[cat].label}</span>
                  <span className="sm:hidden">
                    {cat === "plataformas" ? "Plataformas" : cat === "mesas" ? "Mesas" : "Dicas"}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(categoryLabels) as TutorialCategory[]).map((cat) => (
              <TabsContent key={cat} value={cat}>
                {renderTutorialGrid(filteredTutorials)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </section>

      <Footer />
    </main>
  );
};

export default TutorialsPage;
