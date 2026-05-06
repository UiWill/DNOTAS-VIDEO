import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  lesson_id: string;
  comment_id: string;
  commenter_user_id: string;
  is_read: boolean;
  created_at: string;
  lesson_title?: string;
  commenter_name?: string;
}

const AdminNotificationBell = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user || !isAdmin) return;

    const { data, error } = await supabase
      .from("admin_notifications")
      .select("id, lesson_id, comment_id, commenter_user_id, is_read, created_at")
      .eq("admin_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data) return;

    // Enrich with lesson titles and commenter names
    const lessonIds = [...new Set(data.map((n) => n.lesson_id))];
    const userIds = [...new Set(data.map((n) => n.commenter_user_id))];

    const [lessonsRes, profilesRes] = await Promise.all([
      lessonIds.length > 0
        ? supabase.from("course_lessons").select("id, title").in("id", lessonIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from("profiles").select("id, name, email").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const lessonMap = new Map((lessonsRes.data || []).map((l: any) => [l.id, l.title]));
    const profileMap = new Map(
      (profilesRes.data || []).map((p: any) => [p.id, p.name || p.email?.split("@")[0] || "Aluno"])
    );

    setNotifications(
      data.map((n) => ({
        ...n,
        lesson_title: lessonMap.get(n.lesson_id) || "Aula",
        commenter_name: profileMap.get(n.commenter_user_id) || "Aluno",
      }))
    );
  }, [user, isAdmin]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
          filter: `admin_user_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("admin_user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = async (notif: Notification) => {
    // Mark as read
    if (!notif.is_read) {
      await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .eq("id", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setOpen(false);
    navigate("/aulas");
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d`;
  };

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-accent hover:text-accent/80 flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar tudo como lido
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma notificação
            </p>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 ${
                  !notif.is_read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <MessageCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold">{notif.commenter_name}</span>{" "}
                      perguntou em{" "}
                      <span className="font-medium">{notif.lesson_title}</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(notif.created_at)}
                    </span>
                  </div>
                  {!notif.is_read && (
                    <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AdminNotificationBell;
