import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dumbbell,
  FolderOpen,
  Play,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
}

interface TrainingLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  display_order: number;
}

interface TrainingProgress {
  lesson_id: string;
  completed: boolean;
}

const TrainingsHighlight = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [modulesRes, lessonsRes, progressRes] = await Promise.all([
          supabase.from("training_modules").select("id, title, description, display_order").eq("is_active", true).order("display_order"),
          supabase.from("training_lessons").select("id, module_id, title, description, cover_url, display_order").eq("is_active", true).order("display_order"),
          user
            ? supabase.from("training_progress").select("lesson_id, completed").eq("user_id", user.id)
            : Promise.resolve({ data: [], error: null }),
        ]);
        setModules((modulesRes.data as TrainingModule[]) || []);
        setLessons((lessonsRes.data as TrainingLesson[]) || []);
        setProgress((progressRes.data as TrainingProgress[]) || []);
      } catch (err) {
        console.error("Error fetching trainings highlight:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const totalLessons = lessons.length;
  const completedLessons = progress.filter((p) => p.completed).length;
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const getModuleProgress = (moduleId: string) => {
    const moduleLessons = lessons.filter((l) => l.module_id === moduleId);
    if (moduleLessons.length === 0) return 0;
    const completed = moduleLessons.filter((l) => progress.find((p) => p.lesson_id === l.id && p.completed)).length;
    return Math.round((completed / moduleLessons.length) * 100);
  };

  const handleLessonClick = (lessonId: string) => {
    navigate(`/treinamentos?lesson=${lessonId}`);
  };

  if (loading) {
    return (
      <Card className="glass-panel border border-border/80 animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (modules.length === 0) return null;

  return (
    <Card className="glass-panel border border-border/80 animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Dumbbell className="h-4 w-4 text-accent" />
            Treinamentos em destaque
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {completedLessons}/{totalLessons} treinamentos concluídos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <Progress value={overallProgress} className="w-24 h-2" />
            <span className="text-xs font-semibold text-foreground">{overallProgress}%</span>
          </div>
          <Button size="sm" variant="outline" asChild className="text-xs">
            <Link to="/treinamentos">
              Ver todos
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={[modules[0]?.id]} className="space-y-2">
          {modules.map((mod) => {
            const moduleLessons = lessons.filter((l) => l.module_id === mod.id);
            const modProgress = getModuleProgress(mod.id);
            return (
              <AccordionItem key={mod.id} value={mod.id} className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card/80">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <FolderOpen className="h-4 w-4 text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{mod.title}</h3>
                      {mod.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{mod.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mr-2">
                      <span className="text-xs text-muted-foreground">{moduleLessons.length} aulas</span>
                      <Progress value={modProgress} className="w-16 h-1.5" />
                      <span className="text-xs font-medium w-8 text-right">{modProgress}%</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  {moduleLessons.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Nenhum treinamento neste módulo</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {moduleLessons.map((lesson) => {
                        const isCompleted = progress.find((p) => p.lesson_id === lesson.id)?.completed || false;
                        return (
                          <li key={lesson.id}>
                            <button
                              onClick={() => handleLessonClick(lesson.id)}
                              className="w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent/10 group"
                            >
                              {lesson.cover_url ? (
                                <img src={lesson.cover_url} alt="" className="h-10 w-16 rounded-md object-cover flex-shrink-0" />
                              ) : (
                                <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                  <Play className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                                  {lesson.title}
                                </p>
                              </div>
                              {isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default TrainingsHighlight;
