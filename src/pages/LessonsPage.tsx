import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  GraduationCap,
  Play,
  CheckCircle2,
  Circle,
  ChevronLeft,
  FolderOpen,
} from "lucide-react";
import VideoThumbnail from "@/components/VideoThumbnail";
import logo from "@/assets/logo.png";
import Footer from "@/components/Footer";
import LessonComments from "@/components/LessonComments";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import VideoProtection from "@/components/VideoProtection";

interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
}

interface CourseLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  cover_url: string | null;
  display_order: number;
}

interface LessonProgress {
  lesson_id: string;
  completed: boolean;
  watch_position_seconds: number;
}

const LessonsPage = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<CourseLesson | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval>>();

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchData();
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, []);

  // Auto-select lesson from URL param
  useEffect(() => {
    const lessonId = searchParams.get("lesson");
    if (lessonId && lessons.length > 0 && !selectedLesson) {
      const found = lessons.find((l) => l.id === lessonId);
      if (found) {
        setSelectedLesson(found);
        setSearchParams({}, { replace: true });
      }
    }
  }, [lessons, searchParams]);

  const fetchData = async () => {
    try {
      const [modulesRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from("course_modules").select("id, title, description, display_order").eq("is_active", true).order("display_order"),
        supabase.from("course_lessons").select("id, module_id, title, description, video_url, cover_url, display_order").eq("is_active", true).order("display_order"),
        user
          ? supabase.from("lesson_progress").select("lesson_id, completed, watch_position_seconds").eq("user_id", user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (modulesRes.error) throw modulesRes.error;
      if (lessonsRes.error) throw lessonsRes.error;
      setModules((modulesRes.data as CourseModule[]) || []);
      setLessons((lessonsRes.data as CourseLesson[]) || []);
      setProgress((progressRes.data as LessonProgress[]) || []);
    } catch (err) {
      console.error("Error fetching lessons:", err);
    } finally {
      setLoading(false);
    }
  };

  const getLessonProgress = (lessonId: string) => progress.find((p) => p.lesson_id === lessonId);

  const totalLessons = lessons.length;
  const completedLessons = progress.filter((p) => p.completed).length;
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const getModuleProgress = (moduleId: string) => {
    const moduleLessons = lessons.filter((l) => l.module_id === moduleId);
    if (moduleLessons.length === 0) return 0;
    const completed = moduleLessons.filter((l) => progress.find((p) => p.lesson_id === l.id && p.completed)).length;
    return Math.round((completed / moduleLessons.length) * 100);
  };

  const selectLesson = (lesson: CourseLesson) => {
    // Save current progress before switching
    if (selectedLesson && videoRef.current) {
      saveProgress(selectedLesson.id, videoRef.current.currentTime, false);
    }
    setSelectedLesson(lesson);
  };

  const saveProgress = useCallback(
    async (lessonId: string, position: number, completed: boolean) => {
      if (!user) return;
      try {
        const existing = progress.find((p) => p.lesson_id === lessonId);
        if (existing) {
          await supabase
            .from("lesson_progress")
            .update({
              watch_position_seconds: Math.floor(position),
              completed,
              completed_at: completed ? new Date().toISOString() : null,
            })
            .eq("user_id", user.id)
            .eq("lesson_id", lessonId);
        } else {
          await supabase.from("lesson_progress").insert({
            user_id: user.id,
            lesson_id: lessonId,
            watch_position_seconds: Math.floor(position),
            completed,
            completed_at: completed ? new Date().toISOString() : null,
          });
        }
        // Update local state
        setProgress((prev) => {
          const idx = prev.findIndex((p) => p.lesson_id === lessonId);
          const updated = { lesson_id: lessonId, completed, watch_position_seconds: Math.floor(position) };
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = updated;
            return copy;
          }
          return [...prev, updated];
        });
      } catch (err) {
        console.error("Error saving progress:", err);
      }
    },
    [user, progress]
  );

  const handleVideoPlay = () => {
    // Periodically save position every 10s
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    saveTimerRef.current = setInterval(() => {
      if (selectedLesson && videoRef.current) {
        saveProgress(selectedLesson.id, videoRef.current.currentTime, false);
      }
    }, 10000);
  };

  const handleVideoEnded = () => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    if (selectedLesson) {
      saveProgress(selectedLesson.id, videoRef.current?.duration || 0, true);
    }
  };

  const handleVideoPause = () => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    if (selectedLesson && videoRef.current) {
      saveProgress(selectedLesson.id, videoRef.current.currentTime, false);
    }
  };

  const handleVideoLoaded = () => {
    if (selectedLesson && videoRef.current) {
      const prog = getLessonProgress(selectedLesson.id);
      if (prog && prog.watch_position_seconds > 0 && !prog.completed) {
        videoRef.current.currentTime = prog.watch_position_seconds;
      }
    }
  };

  const markComplete = async () => {
    if (!selectedLesson) return;
    const currentPos = videoRef.current?.currentTime || 0;
    await saveProgress(selectedLesson.id, currentPos, true);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-6 w-full max-w-md" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link to="/dashboard">
              <img src={logo} alt="Logo" className="h-20 w-auto flex-shrink-0 object-contain cursor-pointer hover:opacity-80 transition-opacity" decoding="async" />
            </Link>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Área do aluno</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Aulas</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminNotificationBell />
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>{completedLessons}/{totalLessons} aulas</span>
              <Progress value={overallProgress} className="w-24 h-2" />
              <span className="font-semibold text-foreground">{overallProgress}%</span>
            </div>
            {selectedLesson ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}>
                <ChevronLeft className="h-4 w-4 mr-1.5" />
                Voltar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Dashboard
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile progress */}
      <div className="sm:hidden px-4 pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{completedLessons}/{totalLessons}</span>
          <Progress value={overallProgress} className="flex-1 h-2" />
          <span className="font-semibold text-foreground">{overallProgress}%</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-grow px-4 py-6">
        {selectedLesson ? (
          /* Video Player View */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold flex-1">{selectedLesson.title}</h2>
              {getLessonProgress(selectedLesson.id)?.completed ? (
                <Badge variant="default" className="bg-accent/20 text-accent border-accent/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Concluída
                </Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={markComplete}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Marcar concluída
                </Button>
              )}
            </div>

            {selectedLesson.video_url ? (
              <VideoProtection videoRef={videoRef} lessonId={selectedLesson.id}>
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    src={selectedLesson.video_url}
                    controls
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full"
                    onPlay={handleVideoPlay}
                    onEnded={handleVideoEnded}
                    onPause={handleVideoPause}
                    onLoadedMetadata={handleVideoLoaded}
                    poster={selectedLesson.cover_url || undefined}
                  />
                </div>
              </VideoProtection>
            ) : (
              <div className="aspect-video rounded-xl bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">Nenhum vídeo disponível para esta aula</p>
              </div>
            )}

            {selectedLesson.description && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{selectedLesson.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Comunidade - Perguntas e Respostas */}
            <LessonComments lessonId={selectedLesson.id} />
          </div>
        ) : (
          /* Modules list */
          <div className="space-y-4">
            {modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <GraduationCap className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Nenhuma aula disponível</p>
                <p className="text-sm text-muted-foreground/70 mt-1">As aulas serão disponibilizadas em breve.</p>
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={modules.map((m) => m.id)} className="space-y-3">
                {modules.map((mod) => {
                  const moduleLessons = lessons.filter((l) => l.module_id === mod.id);
                  const modProgress = getModuleProgress(mod.id);
                  return (
                    <AccordionItem key={mod.id} value={mod.id} className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card/80">
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <FolderOpen className="h-5 w-5 text-accent flex-shrink-0" />
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
                          <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma aula neste módulo</p>
                        ) : (
                          <ul className="space-y-2">
                            {moduleLessons.map((lesson) => {
                              const prog = getLessonProgress(lesson.id);
                              const isCompleted = prog?.completed || false;
                              return (
                                <li key={lesson.id}>
                                  <button
                                    onClick={() => selectLesson(lesson)}
                                    className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent/10 group"
                                  >
                                    {lesson.video_url ? (
                                       <VideoThumbnail videoUrl={lesson.video_url} alt={lesson.title} className="h-12 w-20 rounded-md object-cover flex-shrink-0" />
                                     ) : lesson.cover_url ? (
                                       <img src={lesson.cover_url} alt="" className="h-12 w-20 rounded-md object-cover flex-shrink-0" />
                                     ) : (
                                       <div className="h-12 w-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                         <Play className="h-4 w-4 text-muted-foreground" />
                                       </div>
                                     )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                                        {lesson.title}
                                      </p>
                                      {lesson.description && (
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{lesson.description}</p>
                                      )}
                                    </div>
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground/30 flex-shrink-0" />
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
            )}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
};

export default LessonsPage;
