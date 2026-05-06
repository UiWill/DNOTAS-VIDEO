import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { MonitorPlay, LogOut, Plus, Shield, Radio, Trash2, Power, BookOpen, GraduationCap, Star, Crown } from "lucide-react";
import logo from "@/assets/logo.png";
import { MultiRoomControl } from "@/components/MultiRoomControl";
import AdminNotificationBell from "@/components/AdminNotificationBell";
import { PromotionsSection } from "@/components/PromotionsSection";
import { DicasSection } from "@/components/DicasSection";
import CoursesHighlight from "@/components/CoursesHighlight";
import TrainingsHighlight from "@/components/TrainingsHighlight";
import Footer from "@/components/Footer";
import UsefulLinksSection from "@/components/UsefulLinksSection";
import { WelcomeVideo } from "@/components/WelcomeVideo";
import { SubscriptionCTA } from "@/components/SubscriptionCTA";

type AppRole = "admin" | "mark";

const roleLabels: Record<AppRole, string> = {
  admin: "ADM",
  mark: "MARK",
};

interface Room {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  team: string | null;
  scheduled_at: string | null;
  current_path: string | null;
  webrtc_live: boolean;
  webrtc_last_seen_at: string | null;
  allowed_roles: AppRole[];
  created_at: string;
}

// Check if webrtc is considered live based on last heartbeat (within 30 seconds)
const isWebrtcRecentlyActive = (room: Room): boolean => {
  if (room.webrtc_live) return true;
  if (!room.webrtc_last_seen_at) return false;
  
  const lastSeen = new Date(room.webrtc_last_seen_at);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  
  // Consider live if heartbeat was within 30 seconds
  return diffMs < 30000;
};

const roomSchema = z.object({
  allowed_roles: z
    .array(z.enum(["admin", "mark"] as const))
    .min(1, "Selecione ao menos um cargo"),
});

type RoomFormValues = z.infer<typeof roomSchema>;

const Dashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userRoles, isAdmin, isMark, signOut } = useAuth();
  const { isActive, daysRemaining } = useSubscription();
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [subscriptionBannerUrl, setSubscriptionBannerUrl] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  // Fetch subscription toggle setting
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("subscription_enabled, subscription_banner_url, payment_link")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSubscriptionEnabled(data.subscription_enabled);
          setSubscriptionBannerUrl((data as any).subscription_banner_url || "");
          setPaymentLink((data as any).payment_link || "");
        }
      });
  }, []);

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      allowed_roles: ["mark"],
    },
  });

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, title, description, project, team, scheduled_at, current_path, webrtc_live, webrtc_last_seen_at, allowed_roles, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Room[];
    },
    // Refetch every 10 seconds to update live status
    refetchInterval: 10000,
  });



  useEffect(() => {
    const channel = supabase
      .channel("rooms-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rooms"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const onSubmit = async (values: RoomFormValues) => {
    if (!isAdmin) {
      toast({
        title: "Permissão negada",
        description: "Apenas administradores podem criar novas salas.",
        variant: "destructive",
      });
      return;
    }

    try {
      const titleFromRoles = values.allowed_roles
        .map((role) => roleLabels[role])
        .join(" + ");

      const { data, error } = await supabase.functions.invoke("create-room", {
        body: {
          title: titleFromRoles,
          allowed_roles: values.allowed_roles,
        },
      });

      if (error) throw error;

      const roomId = (data as { id?: string } | null)?.id;
      if (!roomId) throw new Error("Sala criada, mas não foi possível obter o ID.");

      toast({ title: "Sala criada", description: "A nova sala já está disponível." });
      form.reset({ allowed_roles: values.allowed_roles });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      navigate(`/room/${roomId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a sala.";
      toast({ title: "Erro ao criar sala", description: message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await signOut();
    // Force full page reload to ensure session is properly cleared
    window.location.assign("/auth");
  };

  const handleDeleteRoom = async (roomId: string, roomTitle: string) => {
    if (!confirm(`Deseja excluir a sala "${roomTitle}"?`)) return;

    try {
      const { error } = await supabase.from("rooms").delete().eq("id", roomId);
      if (error) throw error;
      toast({ title: "Sala excluída" });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao excluir.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const handleEndTransmission = async (roomId: string) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ current_path: null })
        .eq("id", roomId);

      if (error) throw error;
      toast({ title: "Transmissão encerrada" });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao encerrar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const visibleRooms = rooms ?? [];

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
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Transmissão interna</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Painel de salas</h1>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-xs">
          {!isAdmin && isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://pay.looma.app.br/PPWJ0J?plan=y2p7xj5l", "_blank")}
              className="text-[11px] gap-1"
            >
              <Star className="h-3.5 w-3.5 text-yellow-500" />
              {daysRemaining}d restantes
            </Button>
          )}
          {isAdmin && (
            <>
              <AdminNotificationBell />
              <Button variant="secondary" size="sm" asChild>
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-1.5" />
                  Admin
                </Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </nav>
      </header>

      {isAdmin && (
        <section className="mx-auto w-full max-w-6xl mb-6">
          <MultiRoomControl />
        </section>
      )}

      {/* Admin create room - only for admin */}
      {isAdmin && isMark && (
        <section className="mx-auto w-full max-w-6xl mb-6">
          <Card className="glass-panel border border-border/80 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4 text-accent" />
                Nova sala de transmissão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-xs sm:text-sm">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargos com acesso</label>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(Object.keys(roleLabels) as AppRole[]).map((role) => {
                      const selected = form.watch("allowed_roles").includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            const current = form.getValues("allowed_roles");
                            if (current.includes(role)) {
                              form.setValue(
                                "allowed_roles",
                                current.filter((r) => r !== role),
                                { shouldValidate: true }
                              );
                            } else {
                              form.setValue("allowed_roles", [...current, role], { shouldValidate: true });
                            }
                          }}
                          className={
                            "rounded-full border px-3 py-1.5 text-[11px] transition-colors " +
                            (selected
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-card text-muted-foreground hover:border-accent/60")
                          }
                        >
                          {roleLabels[role]}
                        </button>
                      );
                    })}
                  </div>
                  {form.formState.errors.allowed_roles && (
                    <p className="text-[11px] text-destructive">{form.formState.errors.allowed_roles.message}</p>
                  )}
                </div>
                <div className="pt-2">
                  <Button type="submit" size="sm" className="w-full sm:w-auto glow-ring">
                    Criar sala
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Welcome Video + Side Panel */}
      <section className="mx-auto w-full max-w-6xl mt-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WelcomeVideo isMark={isMark} />
          {isMark ? (
            <div className="flex flex-col gap-4">
              <Card className="glass-panel border border-border/80 animate-fade-in">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <MonitorPlay className="h-4 w-4 text-accent" />
                      Salas ativas
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Clique para entrar.</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs px-4 pb-4 pt-0">
                  {visibleRooms.length > 0 ? (
                    <ul className="space-y-2">
                      {visibleRooms.map((room) => {
                        const isOnline = !!room.current_path || isWebrtcRecentlyActive(room);
                        return (
                          <li
                            key={room.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/40 p-2.5 hover:bg-card/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={
                                  "h-2 w-2 rounded-full flex-shrink-0 " +
                                  (isOnline ? "status-online-dot" : "bg-muted-foreground")
                                }
                              />
                              <span className="text-xs font-medium truncate">{room.title}</span>
                              <div className="flex gap-1">
                                {room.allowed_roles.map((role) => (
                                  <Badge key={role} variant="outline" className="border-border/70 text-[9px] px-1.5 py-0">
                                    {roleLabels[role as AppRole] ?? role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isAdmin && room.current_path && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                                  onClick={() => handleEndTransmission(room.id)}
                                >
                                  <Power className="h-3 w-3" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteRoom(room.id, room.title)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" asChild className="h-6 px-2 text-[10px]">
                                <Link to={`/room/${room.id}`}>
                                  <Radio className="h-3 w-3 mr-1" />
                                  Entrar
                                </Link>
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex items-center justify-center py-4 text-center">
                      <MonitorPlay className="h-5 w-5 text-muted-foreground/50 mr-2" />
                      <p className="text-muted-foreground text-xs">Nenhuma sala disponível.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <UsefulLinksSection />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {subscriptionEnabled && (
                <SubscriptionCTA
                  bannerUrl={subscriptionBannerUrl}
                  paymentLink={paymentLink}
                />
              )}
              <UsefulLinksSection />
            </div>
          )}
        </div>
      </section>

      {/* Promotions Section - visible to all */}
      <section className="mx-auto w-full max-w-6xl mb-4">
        <PromotionsSection />
      </section>

      {/* Courses Highlight Section - visible to all (RLS handles visibility) */}
      <section className="mx-auto w-full max-w-6xl mb-4">
        <CoursesHighlight />
      </section>

      {/* Trainings Highlight Section */}
      <section className="mx-auto w-full max-w-6xl mb-4">
        <TrainingsHighlight />
      </section>

      {/* Dicas Section - visible to all */}
      <section className="mx-auto w-full max-w-6xl mb-8 flex-grow">
        <DicasSection />
      </section>

      <Footer />

    </main>
  );
};

export default Dashboard;
