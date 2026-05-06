import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Shield, Users, UserPlus, Trash2, History, CalendarIcon,
  UserX, AlertTriangle, Pencil, Gift, BookOpen, GraduationCap, Download,
  ExternalLink, Lightbulb, ToggleLeft, ToggleRight, Settings, Link2, Menu,
  CreditCard, CheckCircle2, Clock, XCircle, MonitorPlay, Crown, Mail,
} from "lucide-react";
import logo from "@/assets/logo.png";
import type { Database } from "@/integrations/supabase/types";
import { PromotionsManager } from "@/components/PromotionsManager";
import { TutorialsManager } from "@/components/TutorialsManager";
import { CoursesManager } from "@/components/CoursesManager";
import Footer from "@/components/Footer";
import UsefulLinksManager from "@/components/UsefulLinksManager";
import { DicasManager } from "@/components/DicasManager";
import { TrainingsManager } from "@/components/TrainingsManager";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  roles: { role: AppRole; expires_at: string | null }[];
}

interface RoleLog {
  id: string;
  created_at: string;
  actor_email: string;
  target_user_id: string;
  previous_role: AppRole | null;
  new_role: AppRole | null;
  previous_expires_at: string | null;
  new_expires_at: string | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  amount_cents: number;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

type AdminTab = "users" | "accounts" | "logs" | "subscriptions" | "promotions" | "courses" | "trainings" | "links" | "dicas" | "settings";

const sidebarItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: "users", label: "Usuários", icon: Users },
  { id: "accounts", label: "Contas", icon: UserX },
  { id: "logs", label: "Histórico", icon: History },
  { id: "subscriptions", label: "Assinaturas", icon: CreditCard },
  { id: "promotions", label: "Promoções", icon: Gift },
  { id: "courses", label: "Aulas", icon: GraduationCap },
  { id: "trainings", label: "Treinamentos", icon: BookOpen },
  { id: "links", label: "Links", icon: ExternalLink },
  { id: "dicas", label: "Conteúdos YT", icon: Lightbulb },
  { id: "settings", label: "Configurações", icon: Settings },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roleLogs, setRoleLogs] = useState<RoleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("mark");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{ userId: string; role: AppRole; currentExpiry: string | null } | null>(null);
  const [editExpiresAt, setEditExpiresAt] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [togglingSubscription, setTogglingSubscription] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [savingPaymentLink, setSavingPaymentLink] = useState(false);
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState("");
  const [welcomeVideoUrlMark, setWelcomeVideoUrlMark] = useState("");
  const [savingWelcomeVideo, setSavingWelcomeVideo] = useState(false);
  const [subscriptionBannerUrl, setSubscriptionBannerUrl] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [welcomeVideoEnabled, setWelcomeVideoEnabled] = useState(true);
  const [togglingWelcomeVideo, setTogglingWelcomeVideo] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
  const [changeEmailUser, setChangeEmailUser] = useState<UserWithRoles | null>(null);
  const [newEmailValue, setNewEmailValue] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchUsers();
    fetchRoleLogs();
    fetchSettings();
    fetchSubscriptions();
  }, [isAdmin, navigate]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("subscription_enabled, payment_link, welcome_video_url, welcome_video_url_mark, subscription_banner_url, welcome_video_enabled")
      .limit(1)
      .single();
    if (data) {
      setSubscriptionEnabled(data.subscription_enabled);
      setPaymentLink((data as any).payment_link || "");
      setWelcomeVideoUrl((data as any).welcome_video_url || "");
      setWelcomeVideoUrlMark((data as any).welcome_video_url_mark || "");
      setSubscriptionBannerUrl((data as any).subscription_banner_url || "");
      setWelcomeVideoEnabled((data as any).welcome_video_enabled ?? true);
    }
  };

  const toggleSubscription = async () => {
    setTogglingSubscription(true);
    try {
      const newValue = !subscriptionEnabled;
      const { error } = await supabase
        .from("app_settings")
        .update({ subscription_enabled: newValue, updated_at: new Date().toISOString() })
        .not("id", "is", null);
      if (error) throw error;
      setSubscriptionEnabled(newValue);
      toast.success(newValue ? "Link de assinatura ativado!" : "Link de assinatura desativado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar configuração");
    } finally {
      setTogglingSubscription(false);
    }
  };

  const savePaymentLink = async () => {
    setSavingPaymentLink(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ payment_link: paymentLink, updated_at: new Date().toISOString() } as any)
        .not("id", "is", null);
      if (error) throw error;
      toast.success("Link de pagamento salvo!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar link");
    } finally {
      setSavingPaymentLink(false);
    }
  };

  const saveWelcomeVideo = async () => {
    setSavingWelcomeVideo(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ welcome_video_url: welcomeVideoUrl, welcome_video_url_mark: welcomeVideoUrlMark, updated_at: new Date().toISOString() } as any)
        .not("id", "is", null);
      if (error) throw error;
      toast.success("Vídeo de boas-vindas salvo!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar vídeo");
    } finally {
      setSavingWelcomeVideo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `banner_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("subscription-banners")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("subscription-banners")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      const { error } = await supabase
        .from("app_settings")
        .update({ subscription_banner_url: publicUrl, updated_at: new Date().toISOString() } as any)
        .not("id", "is", null);
      if (error) throw error;

      setSubscriptionBannerUrl(publicUrl);
      toast.success("Banner de assinatura salvo!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload do banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const { data: subs, error: subsError } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (subsError) throw subsError;

      const { data: profiles } = await supabase.from("profiles").select("id, email, name");
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: SubscriptionRow[] = (subs || []).map(s => {
        const profile = profileMap.get(s.user_id);
        return {
          ...s,
          user_email: profile?.email || "Desconhecido",
          user_name: profile?.name || undefined,
        };
      });
      setSubscriptions(enriched);
    } catch (error: any) {
      console.error("Error fetching subscriptions:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
      if (profilesError) throw profilesError;
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      if (rolesError) throw rolesError;
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => ({ role: r.role, expires_at: r.expires_at })),
      }));
      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("user_role_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRoleLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching logs:", error);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser || !user) return;
    try {
      const existingRole = selectedUser.roles.find((r) => r.role === newRole);
      if (existingRole) {
        const { error: updateError } = await supabase
          .from("user_roles")
          .update({ expires_at: expiresAt ? expiresAt.toISOString() : null })
          .eq("user_id", selectedUser.id)
          .eq("role", newRole);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_roles").insert({
          user_id: selectedUser.id,
          role: newRole,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
        });
        if (insertError) throw insertError;
      }
      await supabase.from("user_role_logs").insert({
        actor_id: user.id,
        actor_email: user.email || "",
        target_user_id: selectedUser.id,
        previous_role: existingRole?.role || null,
        new_role: newRole,
        previous_expires_at: existingRole?.expires_at || null,
        new_expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
      toast.success(existingRole ? "Cargo renovado com sucesso!" : "Cargo adicionado com sucesso!");
      setDialogOpen(false);
      setSelectedUser(null);
      setNewRole("mark");
      setExpiresAt(undefined);
      fetchUsers();
      fetchRoleLogs();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar cargo");
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
      await supabase.from("user_role_logs").insert({
        actor_id: user.id,
        actor_email: user.email || "",
        target_user_id: userId,
        previous_role: role,
        new_role: null,
      });
      toast.success("Cargo removido com sucesso!");
      fetchUsers();
      fetchRoleLogs();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover cargo");
    }
  };

  const handleDeleteAccount = async (targetUser: UserWithRoles) => {
    if (!user) return;
    const isTargetAdmin = targetUser.roles.some(r => r.role === "admin");
    if (isTargetAdmin) {
      toast.error("Não é possível excluir contas de administradores");
      return;
    }
    if (!confirm(`⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nDeseja realmente excluir a conta de "${targetUser.name || targetUser.email}"?\n\nTodos os dados do usuário serão permanentemente removidos.`)) {
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: targetUser.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Conta excluída com sucesso!");
      fetchUsers();
      fetchRoleLogs();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir conta");
    }
  };

  const handleEditExpiry = (userId: string, role: AppRole, currentExpiry: string | null) => {
    setEditingRole({ userId, role, currentExpiry });
    setEditExpiresAt(currentExpiry ? new Date(currentExpiry) : undefined);
    setEditDialogOpen(true);
  };

  const handleSaveExpiry = async () => {
    if (!editingRole || !user) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ expires_at: editExpiresAt ? editExpiresAt.toISOString() : null })
        .eq("user_id", editingRole.userId)
        .eq("role", editingRole.role);
      if (error) throw error;
      await supabase.from("user_role_logs").insert({
        actor_id: user.id,
        actor_email: user.email || "",
        target_user_id: editingRole.userId,
        previous_role: editingRole.role,
        new_role: editingRole.role,
        previous_expires_at: editingRole.currentExpiry,
        new_expires_at: editExpiresAt ? editExpiresAt.toISOString() : null,
      });
      toast.success("Data de expiração atualizada!");
      setEditDialogOpen(false);
      setEditingRole(null);
      setEditExpiresAt(undefined);
      fetchUsers();
      fetchRoleLogs();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar data");
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "admin": return "destructive";
      case "mark": return "default";
      default: return "outline";
    }
  };

  const handleChangeEmail = async () => {
    if (!changeEmailUser || !newEmailValue.trim()) return;
    setChangingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("change-user-email", {
        body: { user_id: changeEmailUser.id, new_email: newEmailValue.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`E-mail alterado de ${changeEmailUser.email} para ${newEmailValue.trim()}. Credenciais enviadas!`);
      setChangeEmailDialogOpen(false);
      setChangeEmailUser(null);
      setNewEmailValue("");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar e-mail");
    } finally {
      setChangingEmail(false);
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case "admin": return "ADM";
      case "mark": return "MARK";
      default: return role.toUpperCase();
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleString("pt-BR");

  const usersWithActiveRoles = users.filter((u) =>
    u.roles.some((r) => !r.expires_at || new Date(r.expires_at) > new Date())
  );

  const usersWithoutActiveRoles = users.filter((u) => {
    if (u.roles.length === 0) return true;
    return u.roles.every((r) => r.expires_at && new Date(r.expires_at) <= new Date());
  });

  const isRoleExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  const renderAddRoleDialog = (u: UserWithRoles) => (
    <Dialog open={dialogOpen && selectedUser?.id === u.id} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) { setSelectedUser(null); setExpiresAt(undefined); }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => setSelectedUser(u)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar Cargo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Cargo</DialogTitle>
          <DialogDescription>Adicione um novo cargo para {u.name || u.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">ADM</SelectItem>
                <SelectItem value="mark">MARK</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>ADM:</strong> Acesso total • <strong>MARK:</strong> Acesso às salas Mark
            </p>
          </div>
          <div className="space-y-2">
            <Label>Expira em (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, "PPP", { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={expiresAt} onSelect={setExpiresAt} initialFocus disabled={(date) => date < new Date()} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {expiresAt && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setExpiresAt(undefined)}>
                Limpar data
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleAddRole}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-8 w-8 object-contain" decoding="async" width={32} height={32} />
            <h1 className="text-lg font-semibold text-foreground">Painel Admin</h1>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Vertical Sidebar */}
        <aside className={cn(
          "border-r border-border bg-card/30 flex-shrink-0 transition-all duration-200 overflow-y-auto",
          sidebarOpen ? "w-52" : "w-0 lg:w-14",
        )}>
          <nav className="flex flex-col gap-1 p-2 pt-4">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className={cn("truncate", !sidebarOpen && "lg:hidden")}>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === "settings" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Configurações de Assinatura
                    </CardTitle>
                    <CardDescription>Gerencie o botão de assinatura e o link de pagamento</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Toggle subscription */}
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        {subscriptionEnabled ? (
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">Botão de Assinatura MARK</p>
                          <p className="text-[11px] text-muted-foreground">
                            {subscriptionEnabled
                              ? "Ativo — usuários sem cargo podem ver o botão de assinar"
                              : "Desativado — botão de assinatura oculto para usuários"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={subscriptionEnabled ? "destructive" : "default"}
                        onClick={toggleSubscription}
                        disabled={togglingSubscription}
                        className="text-xs"
                      >
                        {togglingSubscription ? "Salvando..." : subscriptionEnabled ? "Desativar" : "Ativar"}
                      </Button>
                    </div>

                    {/* Payment link */}
                    <div className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Link de Pagamento</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Cole aqui o link da sua API de pagamento. Quando o usuário clicar em "Assinar", será redirecionado para este link.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://seu-gateway-de-pagamento.com/checkout"
                          value={paymentLink}
                          onChange={(e) => setPaymentLink(e.target.value)}
                          className="flex-1"
                        />
                        <Button onClick={savePaymentLink} disabled={savingPaymentLink} size="sm">
                          {savingPaymentLink ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </div>

                    {/* Subscription banner */}
                    <div className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Banner de Assinatura</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Faça upload de uma arte/banner. Ao clicar, o usuário será redirecionado ao link de pagamento.
                      </p>
                      <p className="text-[11px] font-medium text-accent">
                        Proporção ideal: 1120×448px (5:2) para alta resolução.
                      </p>
                      {subscriptionBannerUrl && (
                        <img src={subscriptionBannerUrl} alt="Banner atual" className="w-full max-h-40 object-contain rounded-lg border border-border" />
                      )}
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          disabled={uploadingBanner}
                          className="flex-1"
                        />
                      </div>
                      {uploadingBanner && <p className="text-xs text-muted-foreground">Enviando...</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MonitorPlay className="h-5 w-5 text-primary" />
                      Vídeo de Boas-Vindas
                    </CardTitle>
                    <CardDescription>
                      Configure um vídeo que será exibido no dashboard para todos os usuários. Aceita links do YouTube (não listados) ou URLs de vídeo direto.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Toggle welcome video */}
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        {welcomeVideoEnabled ? (
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">Exibir vídeo de boas-vindas</p>
                          <p className="text-[11px] text-muted-foreground">
                            {welcomeVideoEnabled
                              ? "Ativo — vídeo visível no dashboard"
                              : "Desativado — vídeo oculto no dashboard"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={welcomeVideoEnabled ? "destructive" : "default"}
                        onClick={async () => {
                          setTogglingWelcomeVideo(true);
                          try {
                            const newValue = !welcomeVideoEnabled;
                            const { error } = await supabase
                              .from("app_settings")
                              .update({ welcome_video_enabled: newValue, updated_at: new Date().toISOString() } as any)
                              .not("id", "is", null);
                            if (error) throw error;
                            setWelcomeVideoEnabled(newValue);
                            toast.success(newValue ? "Vídeo ativado!" : "Vídeo desativado!");
                          } catch (error: any) {
                            toast.error(error.message || "Erro ao alterar");
                          } finally {
                            setTogglingWelcomeVideo(false);
                          }
                        }}
                        disabled={togglingWelcomeVideo}
                        className="text-xs"
                      >
                        {togglingWelcomeVideo ? "Salvando..." : welcomeVideoEnabled ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Vídeo FREE (usuários sem assinatura)</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=... ou URL do vídeo"
                        value={welcomeVideoUrl}
                        onChange={(e) => setWelcomeVideoUrl(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    {welcomeVideoUrl && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        {(() => {
                          const match = welcomeVideoUrl.match(
                            /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/))([a-zA-Z0-9_-]{11})/
                          );
                          if (match) {
                            return (
                              <div className="aspect-video">
                                <iframe
                                  src={`https://www.youtube.com/embed/${match[1]}`}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }
                          return (
                            <div className="aspect-video">
                              <video src={welcomeVideoUrl} controls className="w-full h-full" preload="metadata" />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <p className="text-xs font-medium text-muted-foreground mb-1 mt-4">Vídeo MARK (assinantes)</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=... ou URL do vídeo MARK"
                        value={welcomeVideoUrlMark}
                        onChange={(e) => setWelcomeVideoUrlMark(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    {welcomeVideoUrlMark && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        {(() => {
                          const match = welcomeVideoUrlMark.match(
                            /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/))([a-zA-Z0-9_-]{11})/
                          );
                          if (match) {
                            return (
                              <div className="aspect-video">
                                <iframe
                                  src={`https://www.youtube.com/embed/${match[1]}`}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }
                          return (
                            <div className="aspect-video">
                              <video src={welcomeVideoUrlMark} controls className="w-full h-full" preload="metadata" />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <Button onClick={saveWelcomeVideo} disabled={savingWelcomeVideo} size="sm" className="mt-2">
                      {savingWelcomeVideo ? "Salvando..." : "Salvar vídeos"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "users" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Gerenciamento de Usuários
                      </CardTitle>
                      <CardDescription>Usuários com cargos ativos na plataforma</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const roleLabels: Record<string, string> = { admin: "Admin", manager: "Manager", viewer: "Viewer", vip: "VIP", aprovacao: "Aprovação", mark: "Mark" };
                        const headers = ["Nome", "Email", "Telefone", "Status"];
                        const rows = users.map((u) => {
                          const activeRoles = u.roles.filter(r => !r.expires_at || new Date(r.expires_at) > new Date());
                          const status = activeRoles.length > 0 ? activeRoles.map(r => roleLabels[r.role] || r.role).join(", ") : "Cadastro no sistema";
                          return [(u.name || "Sem nome").replace(/"/g, '""'), u.email.replace(/"/g, '""'), (u.phone || "Sem telefone").replace(/"/g, '""'), status.replace(/"/g, '""')];
                        });
                        const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
                        const bom = "\uFEFF";
                        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `usuarios_${format(new Date(), "yyyy-MM-dd")}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Planilha exportada com sucesso!");
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Cargos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithActiveRoles.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name || "Sem nome"}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.roles.length > 0 ? u.roles.map((r, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <Badge variant={isRoleExpired(r.expires_at) ? "outline" : getRoleBadgeVariant(r.role)} className={isRoleExpired(r.expires_at) ? "opacity-50 line-through" : ""}>
                                    {getRoleLabel(r.role)}
                                    {r.expires_at && <span className="ml-1 text-xs">({isRoleExpired(r.expires_at) ? "expirado" : format(new Date(r.expires_at), "dd/MM/yy")})</span>}
                                  </Badge>
                                  {(r.role === "vip" || r.role === "aprovacao") && (
                                    <button onClick={() => handleEditExpiry(u.id, r.role, r.expires_at)} className="text-muted-foreground hover:text-primary" title="Editar data de expiração">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button onClick={() => handleRemoveRole(u.id, r.role)} className="text-muted-foreground hover:text-destructive" title="Remover cargo">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )) : <span className="text-sm text-muted-foreground">Sem cargos</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!u.roles.some(r => r.role === "admin") && (
                                <Button variant="outline" size="sm" onClick={() => { setChangeEmailUser(u); setNewEmailValue(""); setChangeEmailDialogOpen(true); }}>
                                  <Mail className="mr-1 h-4 w-4" />
                                  Alterar E-mail
                                </Button>
                              )}
                              {renderAddRoleDialog(u)}
                              {!u.roles.some(r => r.role === "admin") && (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAccount(u)}>
                                  <AlertTriangle className="mr-1 h-4 w-4" />
                                  Excluir
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {usersWithActiveRoles.length === 0 && (
                    <div className="py-12 text-center">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">Nenhum usuário com cargo ativo encontrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "accounts" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserX className="h-5 w-5 text-primary" />
                        Contas Cadastradas
                      </CardTitle>
                      <CardDescription>Contas sem cargo ou com cargos expirados</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const roleLabelsMap: Record<string, string> = { admin: "Admin", manager: "Manager", viewer: "Viewer", vip: "VIP", aprovacao: "Aprovação", mark: "Mark" };
                        const headers = ["Nome", "Email", "Telefone", "Cargo", "Status"];
                        const rows = users.map((u) => {
                          const activeRoles = u.roles.filter(r => !r.expires_at || new Date(r.expires_at) > new Date());
                          const expiredRoles = u.roles.filter(r => r.expires_at && new Date(r.expires_at) <= new Date());
                          const cargoText = activeRoles.length > 0 ? activeRoles.map(r => roleLabelsMap[r.role] || r.role).join(", ") : expiredRoles.length > 0 ? expiredRoles.map(r => roleLabelsMap[r.role] || r.role).join(", ") + " (expirado)" : "Sem cargo";
                          return [(u.name || "Sem nome").replace(/"/g, '""'), u.email.replace(/"/g, '""'), (u.phone || "Sem telefone").replace(/"/g, '""'), cargoText.replace(/"/g, '""'), activeRoles.length > 0 ? "Ativo" : "Inativo"];
                        });
                        const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
                        const bom = "\uFEFF";
                        const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `todas_contas_${format(new Date(), "yyyy-MM-dd")}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Planilha de todas as contas exportada!");
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Exportar Todas
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithoutActiveRoles.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name || "Sem nome"}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            {u.roles.length === 0 ? (
                              <Badge variant="outline" className="text-muted-foreground">Sem cargo</Badge>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {u.roles.map((r, idx) => (
                                  <Badge key={idx} variant="outline" className="opacity-50 line-through text-destructive">
                                    {getRoleLabel(r.role)}
                                    {r.expires_at && <span className="ml-1 text-xs">(expirou {format(new Date(r.expires_at), "dd/MM/yy")})</span>}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {renderAddRoleDialog(u)}
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAccount(u)}>
                                <AlertTriangle className="mr-1 h-4 w-4" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {usersWithoutActiveRoles.length === 0 && (
                    <div className="py-12 text-center">
                      <UserX className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">Todas as contas possuem cargos ativos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "logs" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Histórico de Alterações
                  </CardTitle>
                  <CardDescription>Registro de todas as alterações de cargos</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Cargo Anterior</TableHead>
                        <TableHead>Novo Cargo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roleLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                          <TableCell>{log.actor_email}</TableCell>
                          <TableCell>
                            {log.previous_role ? <Badge variant={getRoleBadgeVariant(log.previous_role)}>{getRoleLabel(log.previous_role)}</Badge> : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {log.new_role ? <Badge variant={getRoleBadgeVariant(log.new_role)}>{getRoleLabel(log.new_role)}</Badge> : <span className="text-muted-foreground">Removido</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {roleLogs.length === 0 && (
                    <div className="py-12 text-center">
                      <History className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">Nenhum registro encontrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "subscriptions" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Assinaturas & Pagamentos
                      </CardTitle>
                      <CardDescription>Pagamentos recebidos via Looma</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {subscriptions.length} registro{subscriptions.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Expira</TableHead>
                        <TableHead>Criado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => {
                        const isExpired = sub.expires_at && new Date(sub.expires_at) <= new Date();
                        const statusIcon = sub.status === "active" && !isExpired
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : sub.status === "pending"
                          ? <Clock className="h-3.5 w-3.5 text-yellow-500" />
                          : <XCircle className="h-3.5 w-3.5 text-destructive" />;
                        const statusLabel = sub.status === "active" && !isExpired
                          ? "Ativo"
                          : sub.status === "pending"
                          ? "Pendente"
                          : isExpired
                          ? "Expirado"
                          : sub.status;
                        const statusVariant = sub.status === "active" && !isExpired
                          ? "default" as const
                          : sub.status === "pending"
                          ? "secondary" as const
                          : "outline" as const;

                        return (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{sub.user_name || "Sem nome"}</p>
                                <p className="text-xs text-muted-foreground">{sub.user_email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{sub.plan_type}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant} className="gap-1">
                                {statusIcon}
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              R$ {(sub.amount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {sub.starts_at ? format(new Date(sub.starts_at), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {sub.expires_at ? (
                                <span className={isExpired ? "text-destructive" : "text-muted-foreground"}>
                                  {format(new Date(sub.expires_at), "dd/MM/yyyy")}
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(sub.created_at), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {subscriptions.length === 0 && (
                    <div className="py-12 text-center">
                      <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">Nenhuma assinatura encontrada</p>
                      <p className="text-xs text-muted-foreground mt-1">Os pagamentos via Looma aparecerão aqui automaticamente</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "promotions" && <PromotionsManager />}
            {activeTab === "courses" && <CoursesManager />}
            {activeTab === "trainings" && <TrainingsManager />}
            {activeTab === "links" && <UsefulLinksManager />}
            {activeTab === "dicas" && <DicasManager />}
          </div>
        </main>
      </div>

      {/* Dialog de edição de data de expiração */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingRole(null); setEditExpiresAt(undefined); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Data de Expiração</DialogTitle>
            <DialogDescription>Altere a data de expiração do cargo {editingRole && getRoleLabel(editingRole.role)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data de expiração</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editExpiresAt && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editExpiresAt ? format(editExpiresAt, "PPP", { locale: ptBR }) : "Sem data de expiração (permanente)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editExpiresAt} onSelect={setEditExpiresAt} initialFocus disabled={(date) => date < new Date()} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {editExpiresAt && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setEditExpiresAt(undefined)}>
                  Remover data (tornar permanente)
                </Button>
              )}
            </div>
            {editingRole?.currentExpiry && (
              <p className="text-xs text-muted-foreground">Data atual: {format(new Date(editingRole.currentExpiry), "PPP", { locale: ptBR })}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveExpiry}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Email Dialog */}
      <Dialog open={changeEmailDialogOpen} onOpenChange={(open) => {
        setChangeEmailDialogOpen(open);
        if (!open) { setChangeEmailUser(null); setNewEmailValue(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar E-mail do Usuário</DialogTitle>
            <DialogDescription>
              O e-mail anterior ({changeEmailUser?.email}) perderá o acesso. Uma nova senha será gerada e enviada para o novo e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <p className="text-sm text-muted-foreground">{changeEmailUser?.name || changeEmailUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>E-mail atual</Label>
              <p className="text-sm text-muted-foreground">{changeEmailUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Novo e-mail</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="novoemail@exemplo.com"
                value={newEmailValue}
                onChange={(e) => setNewEmailValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeEmailDialogOpen(false)} disabled={changingEmail}>Cancelar</Button>
            <Button onClick={handleChangeEmail} disabled={changingEmail || !newEmailValue.trim()}>
              {changingEmail ? "Alterando..." : "Alterar E-mail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default AdminPanel;
