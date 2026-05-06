import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MonitorPlay, 
  ExternalLink, 
  Power, 
  Globe2, 
  Users, 
  Play,
  Square,
  Layers
} from "lucide-react";

type AppRole = "admin" | "vip" | "aprovacao";

const roleLabels: Record<AppRole, string> = {
  admin: "ADM",
  vip: "VIP",
  aprovacao: "APROVAÇÃO",
};

interface Room {
  id: string;
  title: string;
  current_path: string | null;
  webrtc_live: boolean;
  webrtc_last_seen_at: string | null;
  allowed_roles: AppRole[];
}

interface RoomPresence {
  [roomId: string]: number;
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

const MAX_SIMULTANEOUS_ROOMS = 3;

export const MultiRoomControl = () => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomUrls, setRoomUrls] = useState<Record<string, string>>({});
  const [presence, setPresence] = useState<RoomPresence>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(true);

  // Count active transmissions (URL or WebRTC recently active)
  const activeTransmissions = rooms.filter(r => r.current_path || isWebrtcRecentlyActive(r)).length;

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, title, current_path, webrtc_live, webrtc_last_seen_at, allowed_roles")
        .order("created_at", { ascending: false });
      
      if (data) {
        setRooms(data as Room[]);
        // Initialize URL inputs with current values
        const urls: Record<string, string> = {};
        data.forEach(room => {
          urls[room.id] = room.current_path || "";
        });
        setRoomUrls(urls);
      }
    };

    fetchRooms();

    // Subscribe to room changes
    const channel = supabase
      .channel("multi-room-control")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Subscribe to presence for each room
  useEffect(() => {
    if (rooms.length === 0) return;

    const presenceChannels = rooms.map(room => {
      const channel = supabase
        .channel(`multi-presence-${room.id}`, { config: { presence: { key: room.id } } })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const entries = Object.values(state) as Array<unknown[]>;
          const total = entries.reduce((acc, curr) => acc + curr.length, 0);
          setPresence(prev => ({ ...prev, [room.id]: total }));
        })
        .subscribe();

      return channel;
    });

    return () => {
      presenceChannels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [rooms.length]);

  const startTransmission = async (roomId: string) => {
    const url = roomUrls[roomId]?.trim();
    
    if (!url) {
      toast({ 
        title: "URL necessária", 
        description: "Digite uma URL para iniciar a transmissão.",
        variant: "destructive" 
      });
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      toast({ 
        title: "URL inválida", 
        description: "Digite uma URL válida (ex: https://exemplo.com).",
        variant: "destructive" 
      });
      return;
    }

    // Check limit
    if (activeTransmissions >= MAX_SIMULTANEOUS_ROOMS && !rooms.find(r => r.id === roomId)?.current_path) {
      toast({ 
        title: "Limite atingido", 
        description: `Você pode ter no máximo ${MAX_SIMULTANEOUS_ROOMS} transmissões simultâneas.`,
        variant: "destructive" 
      });
      return;
    }

    setLoading(prev => ({ ...prev, [roomId]: true }));

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ current_path: url })
        .eq("id", roomId);

      if (error) throw error;
      toast({ title: "Transmissão iniciada", description: `URL configurada para ${new URL(url).hostname}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao iniciar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, [roomId]: false }));
    }
  };

  const stopTransmission = async (roomId: string) => {
    setLoading(prev => ({ ...prev, [roomId]: true }));

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ current_path: null })
        .eq("id", roomId);

      if (error) throw error;
      setRoomUrls(prev => ({ ...prev, [roomId]: "" }));
      toast({ title: "Transmissão encerrada" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao encerrar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, [roomId]: false }));
    }
  };

  const openInNewTab = (roomId: string) => {
    window.open(`/room/${roomId}`, '_blank');
  };

  if (rooms.length === 0) return null;

  return (
    <Card className="glass-panel border-border/80 animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-accent" />
            Controle Multi-Sala
            <Badge variant="outline" className="ml-2 text-[10px]">
              {activeTransmissions}/{MAX_SIMULTANEOUS_ROOMS} ativas
            </Badge>
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? "Recolher" : "Expandir"}
          </Button>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground mb-3">
            Gerencie até {MAX_SIMULTANEOUS_ROOMS} transmissões simultâneas. URLs ficam ativas mesmo quando você sai.
          </p>
          
          {rooms.map(room => {
            const isOnline = !!room.current_path || isWebrtcRecentlyActive(room);
            const hasUrlTransmission = !!room.current_path;
            const viewerCount = presence[room.id] || 0;
            const isLoading = loading[room.id];

            return (
              <div 
                key={room.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isOnline ? "border-accent/50 bg-accent/5" : "border-border/70 bg-card/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{room.title}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        isOnline ? "status-online" : "status-offline"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "status-online-dot" : "bg-muted-foreground"}`} />
                      {isOnline 
                        ? (hasUrlTransmission ? "Ao vivo (URL)" : "Ao vivo (Tela)")
                        : "Offline"}
                    </span>
                    {viewerCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {viewerCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openInNewTab(room.id)}
                      title="Abrir em nova aba"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <Link to={`/room/${room.id}`} title="Entrar na sala">
                        <MonitorPlay className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Globe2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={roomUrls[room.id] || ""}
                      onChange={(e) => setRoomUrls(prev => ({ ...prev, [room.id]: e.target.value }))}
                      placeholder="https://exemplo.com/pagina"
                      className="pl-8 h-8 text-xs bg-card/50"
                      disabled={isLoading}
                    />
                  </div>
                  {isOnline ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => stopTransmission(room.id)}
                      disabled={isLoading}
                      className="h-8 text-xs"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Parar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startTransmission(room.id)}
                      disabled={isLoading || (activeTransmissions >= MAX_SIMULTANEOUS_ROOMS)}
                      className="h-8 text-xs glow-ring"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Iniciar
                    </Button>
                  )}
                </div>

                {isOnline && room.current_path && (
                  <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                    <span>Transmitindo:</span>
                    <span className="font-mono bg-muted px-1 rounded truncate max-w-[200px]">
                      {new URL(room.current_path).hostname}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
};
