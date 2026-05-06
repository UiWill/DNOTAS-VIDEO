import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useHeartbeatWorker } from "@/hooks/useHeartbeatWorker";
import { ArrowLeft, MonitorPlay, Users, Maximize, Minimize, Send, ScreenShare, ScreenShareOff, ShieldAlert, RefreshCw, MessageCircleOff, Settings2, Mic, MicOff, MonitorUp, PlusCircle, X, Crop } from "lucide-react";
import VideoProtection from "@/components/VideoProtection";
import { RoomPromotions } from "@/components/RoomPromotions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/logo.png";
import { RoomAudioPanel } from "@/components/RoomAudioPanel";
import AudioWaveIndicator from "@/components/AudioWaveIndicator";
import { CanvasCompositor } from "@/utils/CanvasCompositor";
import { MultiScreenControls } from "@/components/MultiScreenControls";
import { CompositorResizeOverlay } from "@/components/CompositorResizeOverlay";

import { ScreenCropSelector } from "@/components/ScreenCropSelector";

type AppRole = "admin" | "mark";

const roleLabels: Record<AppRole, string> = {
  admin: "ADM",
  mark: "MARK",
};

// Quality presets for streaming
type StreamQuality = "low" | "medium" | "high" | "ultra";

interface QualityPreset {
  label: string;
  resolution: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

const qualityPresets: Record<StreamQuality, QualityPreset> = {
  low: {
    label: "Baixa (720p)",
    resolution: "720p",
    width: 1280,
    height: 720,
    frameRate: 24,
    bitrate: 2000000, // 2 Mbps
  },
  medium: {
    label: "Média (1080p)",
    resolution: "1080p",
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrate: 4000000, // 4 Mbps
  },
  high: {
    label: "Alta (1080p 60fps)",
    resolution: "1080p60",
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrate: 8000000, // 8 Mbps
  },
  ultra: {
    label: "Ultra (1440p)",
    resolution: "1440p",
    width: 2560,
    height: 1440,
    frameRate: 30,
    bitrate: 12000000, // 12 Mbps
  },
};

interface RoomDetail {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  team: string | null;
  scheduled_at: string | null;
  current_path: string | null;
  allowed_roles: AppRole[];
  owner_id: string;
  chat_enabled: boolean;
}

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name?: string;
}

interface UserProfile {
  id: string;
  name: string | null;
}

const pathSchema = z.object({
  current_path: z.string().trim().url("Informe uma URL válida"),
});

type PathFormValues = z.infer<typeof pathSchema>;

const RoomPage = () => {
  const { roomId: id } = useParams<{ roomId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [presenceCount, setPresenceCount] = useState(0);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});
  const [newMessage, setNewMessage] = useState("");
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAdminLive, setIsAdminLive] = useState(false);
  const [waitingForAdmin, setWaitingForAdmin] = useState(false);
  const [streamQuality, setStreamQuality] = useState<StreamQuality>("high");

  // Viewer playback (Chrome blocks autoplay with audio)
  const [viewerMuted, setViewerMuted] = useState(true);
  const [remotePlayBlocked, setRemotePlayBlocked] = useState(false);

  const statusTimeoutRef = useRef<number | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const theaterContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const webrtcChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const viewerJoinIntervalRef = useRef<number | null>(null);
  const isSharingScreenRef = useRef(false);
  const isAdminRef = useRef(false);
  const knownViewersRef = useRef<Set<string>>(new Set()); // Track known viewers for instant streaming
  const viewerWatchdogRef = useRef<number | null>(null); // Watchdog timer for viewer reconnection
  const visibilityCleanupRef = useRef<(() => void) | null>(null); // Cleanup for visibility listener
  const displayStreamRef = useRef<MediaStream | null>(null); // Current display stream for hot-swap
  const compositorRef = useRef<CanvasCompositor | null>(null); // Multi-screen compositor
  const [screenCount, setScreenCount] = useState(0); // Number of active screen captures
  const [clientId] = useState(() => crypto.randomUUID());
  const [cropSelectorStream, setCropSelectorStream] = useState<MediaStream | null>(null); // Full screen stream waiting for crop selection

  // Live crop state
  const [isCropMode, setIsCropMode] = useState(false); // Whether currently broadcasting a cropped region
  const cropRegionRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const cropVideoRef = useRef<HTMLVideoElement | null>(null); // Hidden video element for the full capture
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null); // Offscreen canvas for cropping
  const cropRunningRef = useRef(false);
  const [cropInitialRegion, setCropInitialRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Audio interaction state
  const [adminMicEnabled, setAdminMicEnabled] = useState(true);
  const [viewerMicEnabled, setViewerMicEnabled] = useState(false);
  const [isForceMuted, setIsForceMuted] = useState(false);
  const [activeMics, setActiveMics] = useState<Record<string, { userId: string; name: string; muted: boolean }>>({});

  // Audio interaction refs
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const adminMicGainRef = useRef<GainNode | null>(null);
  const viewerMicPCRef = useRef<RTCPeerConnection | null>(null);
  const viewerMicPCsRef = useRef<Record<string, RTCPeerConnection>>({});
  const viewerAudioNodesRef = useRef<Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode; audioEl?: HTMLAudioElement }>>(new Map());

  const form = useForm<PathFormValues>({
    resolver: zodResolver(pathSchema),
    defaultValues: { current_path: "" },
  });

  useEffect(() => {
    if (!id) return;

    const loadRoom = async () => {
      try {
        // First check if user has access to this room
        const { data: hasAccess, error: accessError } = await supabase.rpc("can_access_room", {
          _room_id: id,
          _user_id: user?.id ?? "",
        });

        if (accessError) {
          console.error("Access check error:", accessError);
        }

        if (!hasAccess) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const [{ data: roomData, error: roomError }, { data: messagesData }] = await Promise.all([
          supabase
            .from("rooms")
            .select("id, title, description, project, team, scheduled_at, current_path, allowed_roles, owner_id, chat_enabled")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("room_messages")
            .select(`id, user_id, message, created_at`)
            .eq("room_id", id)
            .order("created_at", { ascending: true })
            .limit(100),
        ]);

        if (roomError) throw roomError;
        if (!roomData) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setRoom(roomData as RoomDetail);
        form.reset({ current_path: roomData.current_path ?? "" });

        if (messagesData && messagesData.length > 0) {
          setMessages(messagesData as ChatMessage[]);
          
          // Fetch user profiles for messages
          const userIds = [...new Set(messagesData.map((m) => m.user_id))];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds);
          
          if (profilesData) {
            const profileMap: Record<string, string> = {};
            profilesData.forEach((p) => {
              // Use name if available, otherwise use email prefix
              const displayName = p.name?.trim() || p.email.split("@")[0];
              profileMap[p.id] = displayName;
            });
            setUserProfiles(profileMap);
          }
        }
      } catch (error) {
        console.error(error);
        toast({ title: "Erro", description: "Não foi possível carregar a sala.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
    isAdminRef.current = isAdmin;

    // Presence channel
    const presenceChannel = supabase
      .channel(`room-presence-${id}`, { config: { presence: { key: id } } })
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const entries = Object.values(state) as Array<unknown[]>;
        const total = entries.reduce((acc, curr) => acc + curr.length, 0);
        setPresenceCount(total);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ joined_at: new Date().toISOString() });
        }
      });

    // Room updates channel
    const roomChannel = supabase
      .channel(`room-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${id}` },
        (payload) => {
          const newRoom = payload.new as RoomDetail;
          setRoom(newRoom);
          form.reset({ current_path: newRoom.current_path ?? "" });
        }
      )
      .subscribe();

    // Chat messages channel
    const chatChannel = supabase
      .channel(`room-chat-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
          
          // Fetch user name if not in cache
          if (!userProfiles[newMsg.user_id]) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id, name, email")
              .eq("id", newMsg.user_id)
              .maybeSingle();
            
            if (profileData) {
              const displayName = profileData.name?.trim() || profileData.email.split("@")[0];
              setUserProfiles((prev) => ({
                ...prev,
                [profileData.id]: displayName,
              }));
            }
          }
        }
      )
      .subscribe();

    // WebRTC signaling channel
    const webrtcChannel = supabase.channel(`room-webrtc-${id}`);
    webrtcChannelRef.current = webrtcChannel;

    webrtcChannel
      .on("broadcast", { event: "webrtc" }, ({ payload }) => {
        const msg = payload as {
          type: string;
          from: string;
          to?: string;
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
          streaming?: boolean;
          enabled?: boolean;
          userId?: string;
          userName?: string;
        };

        console.log("[WebRTC] Received broadcast:", msg?.type, "from:", msg?.from, "isAdmin:", isAdminRef.current);

        if (!msg || msg.from === clientId) {
          console.log("[WebRTC] Ignoring own message or empty");
          return;
        }
        if (msg.to && msg.to !== clientId) {
          console.log("[WebRTC] Message not for us, ignoring");
          return;
        }

        const stopViewerRetries = () => {
          if (viewerJoinIntervalRef.current) {
            window.clearInterval(viewerJoinIntervalRef.current);
            viewerJoinIntervalRef.current = null;
          }
        };

        const clearViewerWatchdog = () => {
          if (viewerWatchdogRef.current) {
            window.clearTimeout(viewerWatchdogRef.current);
            viewerWatchdogRef.current = null;
          }
        };

        const ensureViewerRetries = () => {
          // Only viewers need to retry joins
          if (isAdminRef.current) return;
          if (remoteStreamRef.current) return;

          // Always send a fresh join request (cheap) to reduce "missed event" issues
          sendSignal({ type: "viewer-join" });

          // If a retry loop is already running, keep it
          if (viewerJoinIntervalRef.current) return;

          let tries = 0;
          viewerJoinIntervalRef.current = window.setInterval(() => {
            if (remoteStreamRef.current) {
              console.log("[WebRTC] Stream received, stopping retries");
              stopViewerRetries();
              return;
            }

            tries += 1;
            if (tries > 20) {
              console.log("[WebRTC] Viewer join retries exhausted");
              stopViewerRetries();
              setWaitingForAdmin(false);
              return;
            }

            console.log("[WebRTC] Retrying viewer-join, attempt", tries);
            sendSignal({ type: "viewer-join" });
          }, 500);
        };

        switch (msg.type) {
          case "viewer-join": {
            console.log(
              "[WebRTC] viewer-join received. isAdmin:",
              isAdminRef.current,
              "isSharingScreen:",
              isSharingScreenRef.current,
              "hasLocalStream:",
              !!localStreamRef.current,
              "from:",
              msg.from
            );
            
            if (!isAdminRef.current) {
              console.log("[WebRTC] Not admin, ignoring viewer-join");
              return;
            }
            
            // Always track this viewer for instant streaming when we start
            knownViewersRef.current.add(msg.from);
            console.log("[WebRTC] Added viewer to known list:", msg.from, "total:", knownViewersRef.current.size);
            
            // If not streaming yet, just acknowledge and wait
            if (!isSharingScreenRef.current || !localStreamRef.current) {
              console.log("[WebRTC] Not streaming yet, viewer registered for later");
              // Send status so viewer knows admin is online but not streaming
              sendSignal({ type: "admin-status", streaming: false } as any);
              return;
            }
            
            // Close existing peer connection for this viewer if any (handles reconnect)
            const existingPc = peerConnectionsRef.current[msg.from];
            if (existingPc) {
              console.log("[WebRTC] Closing existing peer connection for reconnecting viewer:", msg.from);
              existingPc.close();
              delete peerConnectionsRef.current[msg.from];
            }
            console.log("[WebRTC] Creating peer connection for viewer:", msg.from);
            createPeerConnectionForViewer(msg.from, localStreamRef.current);
            break;
          }
          case "viewer-leave": {
            if (isAdminRef.current) {
              knownViewersRef.current.delete(msg.from);
              console.log("[WebRTC] Viewer left, removed from list:", msg.from);
              const pc = peerConnectionsRef.current[msg.from];
              if (pc) {
                pc.close();
                delete peerConnectionsRef.current[msg.from];
              }
              // Cleanup viewer mic
              setActiveMics(prev => { const c = {...prev}; delete c[msg.from]; return c; });
              const micPc = viewerMicPCsRef.current[msg.from];
              if (micPc) { micPc.close(); delete viewerMicPCsRef.current[msg.from]; }
              removeViewerAudioFromMix(msg.from);
            }
            break;
          }
          case "start-sharing":
            console.log("[WebRTC] start-sharing received, isAdmin:", isAdminRef.current);
            setIsAdminLive(true);
            setWaitingForAdmin(false);
            if (statusTimeoutRef.current) {
              window.clearTimeout(statusTimeoutRef.current);
              statusTimeoutRef.current = null;
            }
            if (!isAdminRef.current) {
              console.log("[WebRTC] Viewer detected start-sharing; ensuring join retries");
              ensureViewerRetries();
            }
            break;
          case "offer":
            console.log("[WebRTC] Received offer from:", msg.from);
            setWaitingForAdmin(false);
            stopViewerRetries();
            if (statusTimeoutRef.current) {
              window.clearTimeout(statusTimeoutRef.current);
              statusTimeoutRef.current = null;
            }
            handleOffer(msg.from, msg.sdp!);
            break;
          case "answer":
            console.log("[WebRTC] Received answer from:", msg.from);
            handleAnswer(msg.from, msg.sdp!);
            break;
          case "ice-candidate":
            console.log("[WebRTC] Received ICE candidate from:", msg.from);
            handleIceCandidate(msg.from, msg.candidate!);
            break;
          case "stop-sharing":
            console.log("[WebRTC] stop-sharing received");
            stopViewerRetries();
            setRemoteStream(null);
            setIsAdminLive(false);
            break;
          case "admin-status": {
            console.log("[WebRTC] admin-status received:", msg.streaming);
            const streaming = msg.streaming ?? false;
            setIsAdminLive(streaming);
            setWaitingForAdmin(false);
            if (streaming) {
              // If admin is live but we still don't have a stream, keep trying to join
              if (!remoteStreamRef.current) {
                console.log("[WebRTC] Admin is live; ensuring join retries");
                ensureViewerRetries();
              }
            }
            if (statusTimeoutRef.current) {
              window.clearTimeout(statusTimeoutRef.current);
              statusTimeoutRef.current = null;
            }
            break;
          }
          case "status-request":
            if (isAdminRef.current) {
              console.log("[WebRTC] Responding to status request, streaming:", isSharingScreenRef.current);
              sendSignal({ type: "admin-status", streaming: isSharingScreenRef.current } as any);
              // If already streaming, re-announce start-sharing (covers late-join + race conditions)
              if (isSharingScreenRef.current) {
                sendSignal({ type: "start-sharing" });
              }
            }
            break;
          case "mic-state": {
            if (isAdminRef.current && msg.enabled !== undefined) {
              if (msg.enabled) {
                setActiveMics(prev => ({
                  ...prev,
                  [msg.from]: { userId: msg.userId || msg.from, name: msg.userName || "Aluno", muted: false },
                }));
                // Restore audio gain for this viewer
                const node = viewerAudioNodesRef.current.get(msg.from);
                if (node) node.gain.gain.value = 1;
              } else {
                // Mute the viewer's audio node in the mix immediately
                const node = viewerAudioNodesRef.current.get(msg.from);
                if (node) node.gain.gain.value = 0;
                setActiveMics(prev => { const c = {...prev}; delete c[msg.from]; return c; });
              }
            }
            break;
          }
          case "mic-offer": {
            if (!isAdminRef.current) break;
            console.log("[Audio] Received mic offer from viewer:", msg.from);
            handleViewerMicOffer(msg.from, msg.sdp!);
            break;
          }
          case "mic-answer": {
            if (isAdminRef.current) break;
            console.log("[Audio] Received mic answer from admin");
            handleViewerMicAnswer(msg.sdp!);
            break;
          }
          case "mic-ice": {
            if (isAdminRef.current) {
              const mpc = viewerMicPCsRef.current[msg.from];
              if (mpc && msg.candidate) mpc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(console.error);
            } else {
              if (viewerMicPCRef.current && msg.candidate) viewerMicPCRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(console.error);
            }
            break;
          }
          case "force-mute": {
            if (!isAdminRef.current && (!msg.to || msg.to === clientId)) {
              setIsForceMuted(true);
              setViewerMicEnabled(false);
              if (micStreamRef.current) micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
              toast({ title: "Microfone silenciado", description: "O administrador desativou seu microfone." });
            }
            break;
          }
          case "force-unmute": {
            if (!isAdminRef.current && (!msg.to || msg.to === clientId)) {
              setIsForceMuted(false);
              toast({ title: "Microfone liberado", description: "Você pode ativar seu microfone." });
            }
            break;
          }
        }
      })
      .subscribe(async (status) => {
        console.log("[WebRTC] Channel status:", status, "isAdmin:", isAdmin);

        if (status !== "SUBSCRIBED") return;

        // Admin: announce current status to avoid race conditions when viewers join.
        if (isAdmin) {
          sendSignal({ type: "admin-status", streaming: isSharingScreenRef.current } as any);
          if (isSharingScreenRef.current) {
            sendSignal({ type: "start-sharing" });
          }
          return;
        }

        // Viewer: request status + keep retrying viewer-join for a short window until we get an offer.
        console.log("[WebRTC] Viewer subscribed, requesting status and sending viewer-join");
        setWaitingForAdmin(true);

        if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = window.setTimeout(() => {
          console.log("[WebRTC] No admin response - admin appears offline");
          setWaitingForAdmin(false);
          setIsAdminLive(false);
        }, 5000);

        const requestOnce = async () => {
          await webrtcChannel.send({
            type: "broadcast",
            event: "webrtc",
            payload: { type: "status-request", from: clientId },
          });
          await webrtcChannel.send({
            type: "broadcast",
            event: "webrtc",
            payload: { type: "viewer-join", from: clientId },
          });
        };

        await requestOnce();

        if (viewerJoinIntervalRef.current) window.clearInterval(viewerJoinIntervalRef.current);
        let tries = 0;
        // Faster retry interval (500ms instead of 2000ms) for quicker connection
        viewerJoinIntervalRef.current = window.setInterval(() => {
          if (remoteStreamRef.current) {
            console.log("[WebRTC] Stream received, stopping retries");
            window.clearInterval(viewerJoinIntervalRef.current!);
            viewerJoinIntervalRef.current = null;
            return;
          }

          tries += 1;
          if (tries > 20) { // More attempts but faster (20 * 500ms = 10s total)
            console.log("[WebRTC] Viewer join retries exhausted");
            window.clearInterval(viewerJoinIntervalRef.current!);
            viewerJoinIntervalRef.current = null;
            setWaitingForAdmin(false);
            return;
          }

          console.log("[WebRTC] Retrying viewer-join, attempt", tries);
          webrtcChannel.send({
            type: "broadcast",
            event: "webrtc",
            payload: { type: "viewer-join", from: clientId },
          });
        }, 500); // 500ms instead of 2000ms
      });

    return () => {
      // Notify admin that viewer is leaving (for instant streaming cleanup)
      if (!isAdmin && webrtcChannelRef.current) {
        webrtcChannelRef.current.send({
          type: "broadcast",
          event: "webrtc",
          payload: { type: "viewer-leave", from: clientId },
        });
      }
      
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(webrtcChannel);
      webrtcChannelRef.current = null;

      if (viewerJoinIntervalRef.current) {
        window.clearInterval(viewerJoinIntervalRef.current);
        viewerJoinIntervalRef.current = null;
      }

      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }

      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());

      const stream = localStreamRef.current;
      stream?.getTracks().forEach((t) => t.stop());
      
      // Cleanup visibility listener if active
      if (visibilityCleanupRef.current) {
        visibilityCleanupRef.current();
        visibilityCleanupRef.current = null;
      }

      // Cleanup audio interaction
      if (viewerMicPCRef.current) { viewerMicPCRef.current.close(); viewerMicPCRef.current = null; }
      Object.values(viewerMicPCsRef.current).forEach(pc => { try { pc.close(); } catch {} });
      viewerMicPCsRef.current = {};
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
      if (audioContextRef.current) { audioContextRef.current.close().catch(console.error); audioContextRef.current = null; mixedDestinationRef.current = null; }
    };
  }, [id, form, navigate, toast, isAdmin, clientId]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Connect local stream to video element
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(console.error);
    }
  }, [localStream]);

  // Keep backend live status fresh while screen sharing (prevents "offline" on Dashboard)
  // Using Web Worker for heartbeat - NOT throttled when browser tab is in background (critical for VPS/RDP)
  const handleHeartbeatPing = useCallback(async () => {
    if (!id) return;
    console.log("[webrtc_live] Heartbeat ping via Web Worker");
    const { error } = await supabase.functions.invoke("set-room-webrtc-live", {
      body: { room_id: id, live: true },
    });
    if (error) console.error("[webrtc_live] Heartbeat error:", error);
  }, [id]);

  useHeartbeatWorker({
    enabled: !!id && isAdmin && isSharingScreen,
    interval: 8000, // 8 seconds (more frequent than before to account for potential drops)
    onPing: handleHeartbeatPing,
  });

  // Brave: periodically resume AudioContext if it gets suspended (Brave aggressively suspends)
  useEffect(() => {
    if (!isSharingScreen) return;
    const interval = window.setInterval(() => {
      if (audioContextRef.current?.state === "suspended") {
        console.log("[Audio] AudioContext suspended, resuming (Brave fix)");
        audioContextRef.current.resume().catch(console.error);
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isSharingScreen]);

  // Connect remote stream to video element
  useEffect(() => {
    remoteStreamRef.current = remoteStream;

    // Stop viewer retries as soon as we get any stream
    if (remoteStream && viewerJoinIntervalRef.current) {
      window.clearInterval(viewerJoinIntervalRef.current);
      viewerJoinIntervalRef.current = null;
    }

    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;

    // Clear UI state when stream changes
    setRemotePlayBlocked(false);

    videoEl.srcObject = remoteStream;

    if (!remoteStream) return;

    // Ensure we start muted for viewers to satisfy Chrome/Brave autoplay policies
    videoEl.muted = isAdmin || viewerMuted;

    const tryPlay = async () => {
      try {
        // Resume AudioContext if suspended (Brave suspends on tab switch)
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }
        await videoEl.play();
      } catch (err) {
        console.warn("[WebRTC] remote video play blocked:", err);
        setRemotePlayBlocked(true);
      }
    };

    // Retry after metadata is ready and after the element is painted
    videoEl.onloadedmetadata = () => {
      void tryPlay();
    };

    void tryPlay();

    // Brave/Firefox: when tab regains visibility, check if stream is still alive
    // and re-try playback (Brave may pause video when tab is backgrounded)
    const handleVisibility = () => {
      if (!document.hidden && remoteStream) {
        const videoTracks = remoteStream.getVideoTracks();
        const allEnded = videoTracks.length > 0 && videoTracks.every(t => t.readyState === "ended");
        
        if (allEnded) {
          console.log("[WebRTC] Remote tracks ended while hidden, requesting reconnect");
          setRemoteStream(null);
          setWaitingForAdmin(true);
          if (webrtcChannelRef.current) {
            webrtcChannelRef.current.send({
              type: "broadcast",
              event: "webrtc",
              payload: { type: "viewer-join", from: clientId },
            });
          }
        } else {
          // Just try to resume playback
          void tryPlay();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [remoteStream, isAdmin, viewerMuted, clientId]);

  const sendSignal = (message: { type: string; to?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    if (!webrtcChannelRef.current) return;
    webrtcChannelRef.current.send({
      type: "broadcast",
      event: "webrtc",
      payload: { ...message, from: clientId },
    });
  };

  // Optimized ICE servers for better connectivity (including TURN fallback for Brave/strict NAT)
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // OpenRelay TURN servers (free, for fallback when STUN fails — common in Brave)
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];

  // Configure sender parameters for better quality based on selected preset
  const configureSenderForQuality = (pc: RTCPeerConnection) => {
    const preset = qualityPresets[streamQuality];
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === "video") {
        const params = sender.getParameters();
        if (!params.encodings) {
          params.encodings = [{}];
        }
        // Use bitrate and framerate from selected quality preset
        params.encodings[0].maxBitrate = preset.bitrate;
        params.encodings[0].maxFramerate = preset.frameRate;
        // Prefer high resolution - don't scale down
        params.encodings[0].scaleResolutionDownBy = 1;
        sender.setParameters(params).catch(console.error);
        console.log(`[WebRTC] Configured sender with quality: ${preset.label}, bitrate: ${preset.bitrate / 1000000}Mbps`);
      }
    });
  };

  const createPeerConnectionForViewer = (viewerId: string, stream: MediaStream) => {
    console.log("[WebRTC] Creating peer connection for viewer:", viewerId);
    console.log("[WebRTC] Stream has tracks:", stream.getTracks().length, stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(", "));
    
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      // Use aggressive ICE nomination for faster connection
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    stream.getTracks().forEach((track) => {
      console.log("[WebRTC] Adding track to peer connection:", track.kind, "enabled:", track.enabled, "readyState:", track.readyState);
      pc.addTrack(track, stream);
    });
    
    console.log("[WebRTC] Added", pc.getSenders().length, "senders to peer connection");

    // Queue to collect ICE candidates before sending offer
    const pendingCandidates: RTCIceCandidate[] = [];
    let offerSent = false;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] ICE candidate gathered for viewer:", viewerId);
        if (offerSent) {
          // Send immediately if offer already sent
          sendSignal({ type: "ice-candidate", to: viewerId, candidate: event.candidate });
        } else {
          // Queue for later
          pendingCandidates.push(event.candidate);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state:", pc.iceConnectionState, "for viewer:", viewerId);
      // Brave aggressively drops ICE connections — attempt ICE restart instead of full reconnect
      if (pc.iceConnectionState === "disconnected") {
        console.log("[WebRTC] ICE disconnected for viewer, attempting ICE restart in 2s:", viewerId);
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" && pc.connectionState !== "closed") {
            console.log("[WebRTC] Performing ICE restart for viewer:", viewerId);
            pc.createOffer({ iceRestart: true })
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                sendSignal({ type: "offer", to: viewerId, sdp: pc.localDescription! });
              })
              .catch((err) => console.error("[WebRTC] ICE restart failed:", err));
          }
        }, 2000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState, "for viewer:", viewerId);
      if (pc.connectionState === "failed") {
        console.log("[WebRTC] Connection failed for viewer, cleaning up:", viewerId);
        pc.close();
        delete peerConnectionsRef.current[viewerId];
        knownViewersRef.current.delete(viewerId);
      } else if (pc.connectionState === "closed") {
        delete peerConnectionsRef.current[viewerId];
      }
    };

    peerConnectionsRef.current[viewerId] = pc;

    pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
      .then((offer) => {
        console.log("[WebRTC] Created offer for viewer:", viewerId, "type:", offer.type);
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        // Configure quality after setting local description
        configureSenderForQuality(pc);
        console.log("[WebRTC] Local description set. Sending offer to viewer:", viewerId);
        console.log("[WebRTC] Offer SDP preview:", pc.localDescription?.sdp?.substring(0, 200));
        sendSignal({ type: "offer", to: viewerId, sdp: pc.localDescription! });
        offerSent = true;
        
        // Send any queued ICE candidates immediately
        pendingCandidates.forEach((candidate) => {
          sendSignal({ type: "ice-candidate", to: viewerId, candidate });
        });
        console.log("[WebRTC] Sent offer + ", pendingCandidates.length, "queued ICE candidates to viewer:", viewerId);
      })
      .catch((error) => {
        console.error("[WebRTC] Error creating offer for viewer:", viewerId, error);
      });
  };

  const handleOffer = async (fromId: string, sdp: RTCSessionDescriptionInit) => {
    console.log("[WebRTC] Handling offer from:", fromId);
    
    // CRITICAL: Close and remove any existing connection from this admin before creating a new one
    // This prevents duplicate connections from interfering with each other
    const existingPc = peerConnectionsRef.current[fromId];
    if (existingPc) {
      console.log("[WebRTC] Closing existing viewer connection before handling new offer");
      existingPc.close();
      delete peerConnectionsRef.current[fromId];
    }
    
    // Also clear remote stream to ensure fresh state
    setRemoteStream(null);
    
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      // Use aggressive ICE nomination for faster connection (same as admin side)
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    pc.ontrack = (event) => {
      console.log("[WebRTC] Received track:", event.track.kind, "readyState:", event.track.readyState);
      const [stream] = event.streams;
      if (stream) {
        console.log("[WebRTC] Setting remote stream with tracks:", stream.getTracks().length);
        // Log each track for debugging
        stream.getTracks().forEach((t, i) => {
          console.log(`[WebRTC] Track ${i}: kind=${t.kind}, enabled=${t.enabled}, readyState=${t.readyState}`);
        });
        setRemoteStream(stream);
        setWaitingForAdmin(false);
      } else {
        console.warn("[WebRTC] ontrack fired but no stream in event.streams");
      }
    };

    // Queue ICE candidates before answer is sent
    const pendingCandidates: RTCIceCandidate[] = [];
    let answerSent = false;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Viewer ICE candidate gathered");
        if (answerSent) {
          sendSignal({ type: "ice-candidate", to: fromId, candidate: event.candidate });
        } else {
          pendingCandidates.push(event.candidate);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] Viewer ICE connection state:", pc.iceConnectionState);
      // Brave: handle ICE disconnections gracefully — wait before triggering watchdog
      if (pc.iceConnectionState === "disconnected") {
        console.log("[WebRTC] Viewer ICE disconnected, waiting for recovery...");
      } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        cancelWatchdog();
      }
    };

    // Watchdog: detect disconnected/failed and auto-reconnect
    // Use longer delay for Brave (it recovers ICE more slowly due to relay restrictions)
    let watchdogTimeout: number | null = null;
    const WATCHDOG_DELAY_MS = 5000; // 5s instead of 3s for Brave compatibility
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const startWatchdog = () => {
      if (watchdogTimeout) return;
      console.log("[WebRTC] Starting viewer watchdog (5s)");
      watchdogTimeout = window.setTimeout(() => {
        watchdogTimeout = null;
        reconnectAttempts++;
        
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.log("[WebRTC] Max reconnect attempts reached, giving up");
          pc.close();
          delete peerConnectionsRef.current[fromId];
          setRemoteStream(null);
          setWaitingForAdmin(false);
          setIsAdminLive(false);
          return;
        }

        console.log("[WebRTC] Watchdog triggered - reconnecting (attempt", reconnectAttempts, ")");
        pc.close();
        delete peerConnectionsRef.current[fromId];
        setRemoteStream(null);
        setWaitingForAdmin(true);
        if (webrtcChannelRef.current) {
          webrtcChannelRef.current.send({
            type: "broadcast",
            event: "webrtc",
            payload: { type: "viewer-join", from: clientId },
          });
        }
      }, WATCHDOG_DELAY_MS);
      viewerWatchdogRef.current = watchdogTimeout;
    };

    const cancelWatchdog = () => {
      if (watchdogTimeout) {
        window.clearTimeout(watchdogTimeout);
        watchdogTimeout = null;
      }
      if (viewerWatchdogRef.current) {
        window.clearTimeout(viewerWatchdogRef.current);
        viewerWatchdogRef.current = null;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Viewer connection state:", pc.connectionState);
      
      if (pc.connectionState === "connected") {
        cancelWatchdog();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        startWatchdog();
      } else if (pc.connectionState === "closed") {
        cancelWatchdog();
      }
    };

    peerConnectionsRef.current[fromId] = pc;

    try {
      console.log("[WebRTC] Setting remote description from offer...");
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[WebRTC] Remote description set successfully. signalingState:", pc.signalingState);
      console.log("[WebRTC] Creating answer...");
      const answer = await pc.createAnswer();
      console.log("[WebRTC] Answer created. Setting local description...");
      await pc.setLocalDescription(answer);
      console.log("[WebRTC] Local description set. Sending answer to admin:", fromId);
      sendSignal({ type: "answer", to: fromId, sdp: answer });
      answerSent = true;
      
      // Send queued ICE candidates immediately after answer
      pendingCandidates.forEach((candidate) => {
        sendSignal({ type: "ice-candidate", to: fromId, candidate });
      });
      console.log("[WebRTC] Sent answer +", pendingCandidates.length, "queued viewer ICE candidates to admin:", fromId);
    } catch (error) {
      console.error("[WebRTC] Error handling offer:", error);
    }
  };

  const handleAnswer = async (fromId: string, sdp: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current[fromId];
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      // Apply quality settings after connection is established
      configureSenderForQuality(pc);
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };


  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current[fromId];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  };

  const startScreenShare = async () => {
    try {
      const preset = qualityPresets[streamQuality];
      console.log(`[WebRTC] Starting screen share with quality: ${preset.label}`);
      
      // Request screen capture with selected quality settings
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
      } as DisplayMediaStreamOptions);

      // Also capture microphone audio for the broadcaster's voice
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          },
          video: false,
        });
        micStreamRef.current = micStream;
        console.log("[WebRTC] Microphone captured successfully");
      } catch (micError) {
        console.warn("[WebRTC] Could not capture microphone:", micError);
        toast({ 
          title: "Microfone não disponível", 
          description: "A transmissão continuará apenas com o áudio do sistema.",
          variant: "default" 
        });
      }

      // Create AudioContext for mixing all audio (admin + viewer mics)
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      // Brave may auto-suspend AudioContext — force resume
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      const mixDest = audioCtx.createMediaStreamDestination();
      mixedDestinationRef.current = mixDest;

      // Add system audio to mix
      if (displayStream.getAudioTracks().length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks()));
        sysSource.connect(mixDest);
      }

      // Add mic audio to mix (with gain node for mute toggle)
      if (micStream) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const micGain = audioCtx.createGain();
        micGain.gain.value = 1;
        micSource.connect(micGain);
        micGain.connect(mixDest);
        adminMicGainRef.current = micGain;
      }

      // Create CanvasCompositor for multi-screen support
      const compositor = new CanvasCompositor({
        width: preset.width,
        height: preset.height,
        frameRate: preset.frameRate,
      });
      compositorRef.current = compositor;
      compositor.addSource(displayStream);
      setScreenCount(compositor.count);

      // Store display stream ref
      displayStreamRef.current = displayStream;

      // Build combined stream: compositor video + single mixed audio track
      const combinedStream = new MediaStream();
      const compositorVideoTrack = compositor.getVideoTrack();
      if (compositorVideoTrack) {
        combinedStream.addTrack(compositorVideoTrack);
      }
      mixDest.stream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log("[WebRTC] Added mixed audio track");
      });

      setLocalStream(combinedStream);
      localStreamRef.current = combinedStream;
      setIsSharingScreen(true);
      isSharingScreenRef.current = true;

      // INSTANT STREAMING: Create connections for all known viewers immediately
      const knownViewers = Array.from(knownViewersRef.current);
      console.log("[WebRTC] Instantly streaming to", knownViewers.length, "known viewers");
      
      knownViewers.forEach((viewerId) => {
        const existingPc = peerConnectionsRef.current[viewerId];
        if (existingPc) {
          existingPc.close();
          delete peerConnectionsRef.current[viewerId];
        }
        createPeerConnectionForViewer(viewerId, combinedStream);
      });

      sendSignal({ type: "start-sharing" });

      // Update backend to mark room as webrtc_live
      if (id) {
        supabase.functions
          .invoke("set-room-webrtc-live", {
            body: { room_id: id, live: true },
          })
          .then(({ error }) => {
            if (error) console.error("[webrtc_live] Error setting live=true:", error);
          });
      }

      // When the first video track ends, remove from compositor (auto-cleanup)
      displayStream.getVideoTracks()[0].onended = () => {
        if (document.hidden) return;
        console.log("[WebRTC] Display track ended");
        // Compositor handles removal automatically via track onended
        // Update screen count
        setScreenCount(compositorRef.current?.count ?? 0);
        // If no more sources, stop sharing
        if (compositorRef.current && compositorRef.current.count === 0) {
          stopScreenShare();
        }
      };

      displayStream.getVideoTracks().forEach(track => {
        track.addEventListener('mute', () => {
          console.log("[WebRTC] Track muted - window minimized. NOT stopping.");
        });
        track.addEventListener('unmute', () => {
          console.log("[WebRTC] Track unmuted - window restored");
        });
      });

      const audioSources = [];
      if (displayStream.getAudioTracks().length > 0) audioSources.push("sistema");
      if (micStream) audioSources.push("microfone");
      
      toast({ 
        title: "Transmissão iniciada", 
        description: audioSources.length > 0 
          ? `Compartilhando tela com áudio: ${audioSources.join(" + ")}. Use "Adicionar tela" para mais fontes.`
          : "Compartilhando tela (sem áudio). Use 'Adicionar tela' para mais fontes."
      });
    } catch (error) {
      console.error("Error starting screen share:", error);
      toast({ title: "Erro", description: "Não foi possível iniciar o compartilhamento.", variant: "destructive" });
    }
  };


  // Add another screen source to the compositor
  const addScreen = async () => {
    if (!compositorRef.current) return;
    if (compositorRef.current.count >= compositorRef.current.maxSources) {
      toast({ title: "Limite atingido", description: `Máximo de ${compositorRef.current.maxSources} telas simultâneas.`, variant: "default" });
      return;
    }

    const preset = qualityPresets[streamQuality];
    try {
      const newDisplayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
      } as DisplayMediaStreamOptions);

      compositorRef.current.addSource(newDisplayStream);
      setScreenCount(compositorRef.current.count);

      // Add system audio from new source to mix
      if (audioContextRef.current && mixedDestinationRef.current && newDisplayStream.getAudioTracks().length > 0) {
        const sysSource = audioContextRef.current.createMediaStreamSource(
          new MediaStream(newDisplayStream.getAudioTracks())
        );
        sysSource.connect(mixedDestinationRef.current);
      }

      // Auto-update count when track ends
      newDisplayStream.getVideoTracks()[0].onended = () => {
        setScreenCount(compositorRef.current?.count ?? 0);
        if (compositorRef.current && compositorRef.current.count === 0) {
          stopScreenShare();
        }
      };

      toast({ title: "Tela adicionada", description: `${compositorRef.current.count} tela(s) ativas na transmissão.` });
    } catch (error) {
      console.log("[WebRTC] User cancelled screen add or error:", error);
    }
  };


  // Start screen crop share: capture full screen, then let admin select a region
  const startCropShare = async () => {
    try {
      const preset = qualityPresets[streamQuality];
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
      } as DisplayMediaStreamOptions);

      setCropInitialRegion(null);
      setCropSelectorStream(displayStream);

      displayStream.getVideoTracks()[0].onended = () => {
        setCropSelectorStream(null);
      };
    } catch (error) {
      console.log("[WebRTC] User cancelled crop screen share:", error);
    }
  };

  // Open crop adjuster during a live broadcast (reuse existing full stream)
  const adjustCropRegion = () => {
    const fullStream = displayStreamRef.current;
    if (!fullStream || fullStream.getVideoTracks().length === 0) return;
    setCropInitialRegion(cropRegionRef.current);
    setCropSelectorStream(fullStream);
  };

  const handleCropConfirm = async (croppedStream: MediaStream, region: { x: number; y: number; width: number; height: number }) => {
    // If already in crop mode, just update the region (live adjustment)
    if (isCropMode && cropRunningRef.current) {
      cropRegionRef.current = region;
      setCropSelectorStream(null);
      toast({ title: "Recorte ajustado", description: "A região de transmissão foi atualizada em tempo real." });
      return;
    }

    // First-time crop: set up everything
    const fullStream = cropSelectorStream;
    setCropSelectorStream(null);

    if (!fullStream) return;

    const preset = qualityPresets[streamQuality];

    // Create hidden video for full capture
    const cropVideo = document.createElement("video");
    cropVideo.srcObject = fullStream;
    cropVideo.muted = true;
    cropVideo.playsInline = true;
    await cropVideo.play();
    cropVideoRef.current = cropVideo;

    // Create offscreen crop canvas
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = preset.width;
    cropCanvas.height = preset.height;
    cropCanvasRef.current = cropCanvas;
    const cropCtx = cropCanvas.getContext("2d")!;

    // Set the region
    cropRegionRef.current = region;
    cropRunningRef.current = true;

    // Crop loop: reads from cropRegionRef on each frame (throttled to preset framerate)
    const targetInterval = Math.round(1000 / (preset.frameRate || 30));
    let lastCropTime = 0;
    const drawCrop = (timestamp: number) => {
      if (!cropRunningRef.current) return;
      if (timestamp - lastCropTime >= targetInterval) {
        lastCropTime = timestamp;
        const r = cropRegionRef.current;
        if (r) {
          cropCtx.drawImage(cropVideo, r.x, r.y, r.width, r.height, 0, 0, preset.width, preset.height);
        }
      }
      requestAnimationFrame(drawCrop);
    };
    requestAnimationFrame(drawCrop);

    const croppedCanvasStream = cropCanvas.captureStream(preset.frameRate);

    // Capture microphone
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 },
        video: false,
      });
      micStreamRef.current = micStream;
    } catch (micError) {
      console.warn("[WebRTC] Could not capture microphone:", micError);
      toast({ title: "Microfone não disponível", description: "A transmissão continuará sem microfone.", variant: "default" });
    }

    // Audio mixing
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const mixDest = audioCtx.createMediaStreamDestination();
    mixedDestinationRef.current = mixDest;

    if (fullStream.getAudioTracks().length > 0) {
      const sysSource = audioCtx.createMediaStreamSource(new MediaStream(fullStream.getAudioTracks()));
      sysSource.connect(mixDest);
    }

    if (micStream) {
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micGain = audioCtx.createGain();
      micGain.gain.value = 1;
      micSource.connect(micGain);
      micGain.connect(mixDest);
      adminMicGainRef.current = micGain;
    }

    // Create compositor with cropped canvas stream
    const compositor = new CanvasCompositor({
      width: preset.width,
      height: preset.height,
      frameRate: preset.frameRate,
    });
    compositorRef.current = compositor;
    compositor.addSource(croppedCanvasStream, "Corte de Tela");
    setScreenCount(compositor.count);

    displayStreamRef.current = fullStream;

    // Build combined stream
    const combinedStream = new MediaStream();
    const compositorVideoTrack = compositor.getVideoTrack();
    if (compositorVideoTrack) combinedStream.addTrack(compositorVideoTrack);
    mixDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

    setLocalStream(combinedStream);
    localStreamRef.current = combinedStream;
    setIsSharingScreen(true);
    isSharingScreenRef.current = true;
    setIsCropMode(true);

    const knownViewers = Array.from(knownViewersRef.current);
    knownViewers.forEach((viewerId) => {
      const existingPc = peerConnectionsRef.current[viewerId];
      if (existingPc) { existingPc.close(); delete peerConnectionsRef.current[viewerId]; }
      createPeerConnectionForViewer(viewerId, combinedStream);
    });

    sendSignal({ type: "start-sharing" });

    if (id) {
      supabase.functions
        .invoke("set-room-webrtc-live", { body: { room_id: id, live: true } })
        .then(({ error }) => {
          if (error) console.error("[webrtc_live] Error setting live=true:", error);
        });
    }

    fullStream.getVideoTracks()[0].onended = () => {
      cropRunningRef.current = false;
      setIsCropMode(false);
      setScreenCount(compositorRef.current?.count ?? 0);
      if (compositorRef.current && compositorRef.current.count === 0) stopScreenShare();
    };

    toast({ title: "Transmissão iniciada", description: "Transmitindo região selecionada. Use 'Ajustar recorte' para alterar a área." });
  };

  const handleCropCancel = () => {
    // Only stop tracks if this is a NEW capture (not adjusting an existing one)
    if (cropSelectorStream && !isCropMode) {
      cropSelectorStream.getTracks().forEach(t => t.stop());
    }
    setCropSelectorStream(null);
  };

  const swapScreenSource = async (sourceId: string) => {
    if (!compositorRef.current) return;
    
    const preset = qualityPresets[streamQuality];
    try {
      const newDisplayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
      } as DisplayMediaStreamOptions);

      // Replace only the selected source
      compositorRef.current.replaceSource(sourceId, newDisplayStream);
      displayStreamRef.current = newDisplayStream;

      // Add new system audio
      if (audioContextRef.current && mixedDestinationRef.current && newDisplayStream.getAudioTracks().length > 0) {
        const sysSource = audioContextRef.current.createMediaStreamSource(
          new MediaStream(newDisplayStream.getAudioTracks())
        );
        sysSource.connect(mixedDestinationRef.current);
      }

      newDisplayStream.getVideoTracks()[0].onended = () => {
        setScreenCount(compositorRef.current?.count ?? 0);
        if (compositorRef.current && compositorRef.current.count === 0) {
          stopScreenShare();
        }
      };

      toast({ title: "Tela trocada", description: "A transmissão continua sem interrupção." });
    } catch (error) {
      console.log("[WebRTC] User cancelled screen swap or error:", error);
    }
  };

  const stopScreenShare = () => {
    // Cleanup visibility listener if it exists
    if (visibilityCleanupRef.current) {
      visibilityCleanupRef.current();
      visibilityCleanupRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    localStreamRef.current = null;
    displayStreamRef.current = null;
    if (compositorRef.current) {
      compositorRef.current.destroy();
      compositorRef.current = null;
    }
    setScreenCount(0);
    setIsSharingScreen(false);
    isSharingScreenRef.current = false;
    // Cleanup crop state
    cropRunningRef.current = false;
    cropRegionRef.current = null;
    cropVideoRef.current = null;
    cropCanvasRef.current = null;
    setIsCropMode(false);

    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};

    // Cleanup AudioContext and audio mixing
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
      mixedDestinationRef.current = null;
      adminMicGainRef.current = null;
      viewerAudioNodesRef.current.clear();
    }
    Object.values(viewerMicPCsRef.current).forEach(pc => pc.close());
    viewerMicPCsRef.current = {};
    setActiveMics({});
    setAdminMicEnabled(true);

    sendSignal({ type: "stop-sharing" });

    // Update backend to mark room as not webrtc_live
    if (id) {
      supabase.functions
        .invoke("set-room-webrtc-live", {
          body: { room_id: id, live: false },
        })
        .then(({ error }) => {
          if (error) console.error("[webrtc_live] Error setting live=false:", error);
        });
    }

    toast({ title: "Transmissão encerrada" });
  };

  // === Audio interaction functions ===

  const addViewerAudioToMix = async (viewerClientId: string, stream: MediaStream) => {
    console.log("[Audio] addViewerAudioToMix called for:", viewerClientId, "tracks:", stream.getAudioTracks().length);
    
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) {
      console.warn("[Audio] No audio tracks in stream for:", viewerClientId);
      return;
    }
    console.log("[Audio] Track details:", tracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState, muted: t.muted })));
    
    // Force track enabled
    tracks.forEach(t => { t.enabled = true; });
    
    if (!audioContextRef.current) {
      console.log("[Audio] Creating new AudioContext for viewer audio");
      audioContextRef.current = new AudioContext();
      mixedDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
    }
    const ctx = audioContextRef.current;
    
    // Ensure AudioContext is running (browsers may suspend it)
    if (ctx.state === "suspended") {
      console.log("[Audio] AudioContext suspended, resuming...");
      await ctx.resume();
    }
    console.log("[Audio] AudioContext state:", ctx.state);
    
    // Remove existing nodes for this viewer if any (reconnect scenario)
    const existing = viewerAudioNodesRef.current.get(viewerClientId);
    if (existing) {
      try { existing.gain.disconnect(); } catch {}
      try { existing.source.disconnect(); } catch {}
      if (existing.audioEl) { existing.audioEl.pause(); existing.audioEl.srcObject = null; }
      viewerAudioNodesRef.current.delete(viewerClientId);
    }
    
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    
    // Connect to mixed destination (goes to broadcast for all viewers)
    if (mixedDestinationRef.current) {
      gain.connect(mixedDestinationRef.current);
      console.log("[Audio] Connected viewer audio to mixedDestination for broadcast");
    } else {
      console.warn("[Audio] mixedDestinationRef is null! Viewer audio won't reach broadcast");
    }
    
    // Use an Audio element for guaranteed local playback (more reliable than ctx.destination)
    const audioEl = new Audio();
    audioEl.srcObject = stream;
    audioEl.volume = 1;
    audioEl.autoplay = true;
    audioEl.play().then(() => {
      console.log("[Audio] ✅ Audio element playing for viewer:", viewerClientId);
    }).catch(err => {
      console.warn("[Audio] Audio element play failed, falling back to ctx.destination:", err);
      gain.connect(ctx.destination);
    });
    
    // Diagnostic: check audio levels after 1 second
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    setTimeout(() => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const maxLevel = Math.max(...data);
      const avgLevel = data.reduce((a, b) => a + b, 0) / data.length;
      console.log("[Audio] 📊 Viewer audio levels after 1s:", viewerClientId, "max:", maxLevel, "avg:", avgLevel.toFixed(1));
      if (maxLevel === 0) {
        console.warn("[Audio] ⚠️ No audio data detected from viewer:", viewerClientId, "- mic may not be capturing");
      }
    }, 1500);
    
    viewerAudioNodesRef.current.set(viewerClientId, { source, gain, audioEl });
    console.log("[Audio] ✅ Viewer audio added to mix:", viewerClientId, "total active:", viewerAudioNodesRef.current.size);
  };

  const removeViewerAudioFromMix = (viewerClientId: string) => {
    const node = viewerAudioNodesRef.current.get(viewerClientId);
    if (node) {
      try { node.gain.disconnect(); } catch {}
      try { node.source.disconnect(); } catch {}
      if (node.audioEl) { node.audioEl.pause(); node.audioEl.srcObject = null; }
      viewerAudioNodesRef.current.delete(viewerClientId);
    }
  };

  const handleViewerMicOffer = async (viewerClientId: string, sdp: RTCSessionDescriptionInit) => {
    console.log("[Audio] handleViewerMicOffer from:", viewerClientId);
    
    // Close existing mic PC for this viewer if any
    const existingPc = viewerMicPCsRef.current[viewerClientId];
    if (existingPc) {
      console.log("[Audio] Closing existing mic PC for viewer:", viewerClientId);
      existingPc.close();
      delete viewerMicPCsRef.current[viewerClientId];
      removeViewerAudioFromMix(viewerClientId);
    }
    
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
    
    pc.ontrack = (event) => {
      console.log("[Audio] ontrack fired! kind:", event.track.kind, "from:", viewerClientId, "readyState:", event.track.readyState);
      if (event.track.kind === "audio") {
        console.log("[Audio] Received viewer audio track:", viewerClientId);
        const audioStream = new MediaStream([event.track]);
        addViewerAudioToMix(viewerClientId, audioStream);
        
        // Monitor track state
        event.track.onended = () => {
          console.log("[Audio] Viewer audio track ended:", viewerClientId);
          removeViewerAudioFromMix(viewerClientId);
        };
        event.track.onmute = () => console.log("[Audio] Viewer audio track muted:", viewerClientId);
        event.track.onunmute = () => console.log("[Audio] Viewer audio track unmuted:", viewerClientId);
      }
    };
    
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ type: "mic-ice" as any, to: viewerClientId, candidate: event.candidate });
    };
    
    pc.onconnectionstatechange = () => {
      console.log("[Audio] Mic PC connection state:", pc.connectionState, "for:", viewerClientId);
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        removeViewerAudioFromMix(viewerClientId);
        delete viewerMicPCsRef.current[viewerClientId];
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log("[Audio] Mic PC ICE state:", pc.iceConnectionState, "for:", viewerClientId);
    };
    
    viewerMicPCsRef.current[viewerClientId] = pc;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[Audio] Sending mic-answer to viewer:", viewerClientId);
      sendSignal({ type: "mic-answer" as any, to: viewerClientId, sdp: answer });
    } catch (err) {
      console.error("[Audio] Error handling mic offer:", err);
    }
  };

  const handleViewerMicAnswer = async (sdp: RTCSessionDescriptionInit) => {
    if (viewerMicPCRef.current) {
      try {
        await viewerMicPCRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log("[Audio] Mic answer set, connection state:", viewerMicPCRef.current.connectionState);
      } catch (err) {
        console.error("[Audio] Error handling mic answer:", err);
      }
    }
  };

  const toggleAdminMic = () => {
    if (adminMicGainRef.current) {
      const newVal = !adminMicEnabled;
      adminMicGainRef.current.gain.value = newVal ? 1 : 0;
      setAdminMicEnabled(newVal);
    }
  };

  const toggleViewerMic = async () => {
    if (isForceMuted) return;
    if (viewerMicEnabled) {
      // Disable ALL audio tracks: both on micStreamRef AND on the PeerConnection senders
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      // Also disable on RTP senders to guarantee silence over WebRTC
      if (viewerMicPCRef.current) {
        viewerMicPCRef.current.getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === "audio") {
            sender.track.enabled = false;
          }
        });
      }
      setViewerMicEnabled(false);
      sendSignal({ type: "mic-state", enabled: false, userId: user?.id, userName: user?.email?.split("@")[0] } as any);
    } else {
      try {
        if (!micStreamRef.current || micStreamRef.current.getAudioTracks().every(t => t.readyState === "ended")) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          micStreamRef.current = stream;

          // If PC exists and is connected, replace the track on the sender
          if (viewerMicPCRef.current && !["closed", "failed"].includes(viewerMicPCRef.current.connectionState)) {
            const newTrack = stream.getAudioTracks()[0];
            const sender = viewerMicPCRef.current.getSenders().find(s => s.track?.kind === "audio" || !s.track);
            if (sender) {
              await sender.replaceTrack(newTrack);
              console.log("[Audio] Replaced track on existing sender");
            }
          }
        } else {
          micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
        }
        // Also enable on RTP senders
        if (viewerMicPCRef.current) {
          viewerMicPCRef.current.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === "audio") {
              sender.track.enabled = true;
            }
          });
        }
        setViewerMicEnabled(true);
        sendSignal({ type: "mic-state", enabled: true, userId: user?.id, userName: user?.email?.split("@")[0] } as any);

        if (!viewerMicPCRef.current || viewerMicPCRef.current.connectionState === "closed" || viewerMicPCRef.current.connectionState === "failed") {
          if (viewerMicPCRef.current) viewerMicPCRef.current.close();
          const pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
          const tracks = micStreamRef.current!.getAudioTracks();
          console.log("[Audio] Adding", tracks.length, "audio tracks to mic PC. Track states:", tracks.map(t => t.readyState));
          tracks.forEach(track => { pc.addTrack(track, micStreamRef.current!); });
          pc.onicecandidate = (event) => {
            if (event.candidate) sendSignal({ type: "mic-ice" as any, candidate: event.candidate });
          };
          pc.onconnectionstatechange = () => {
            console.log("[Audio] Viewer mic PC state:", pc.connectionState);
            if (["failed", "closed"].includes(pc.connectionState)) viewerMicPCRef.current = null;
          };
          pc.oniceconnectionstatechange = () => {
            console.log("[Audio] Viewer mic ICE state:", pc.iceConnectionState);
          };
          viewerMicPCRef.current = pc;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log("[Audio] Sending mic-offer to admin");
          sendSignal({ type: "mic-offer" as any, sdp: offer });
        }
      } catch (error) {
        console.error("[Audio] Mic capture error:", error);
        toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
      }
    }
  };

  const muteViewer = (viewerClientId: string) => {
    const node = viewerAudioNodesRef.current.get(viewerClientId);
    if (node) node.gain.gain.value = 0;
    setActiveMics(prev => prev[viewerClientId] ? { ...prev, [viewerClientId]: { ...prev[viewerClientId], muted: true } } : prev);
    sendSignal({ type: "force-mute" as any, to: viewerClientId });
  };

  const unmuteViewer = (viewerClientId: string) => {
    const node = viewerAudioNodesRef.current.get(viewerClientId);
    if (node) node.gain.gain.value = 1;
    setActiveMics(prev => prev[viewerClientId] ? { ...prev, [viewerClientId]: { ...prev[viewerClientId], muted: false } } : prev);
    sendSignal({ type: "force-unmute" as any, to: viewerClientId });
  };

  const muteAllViewers = () => {
    viewerAudioNodesRef.current.forEach(node => { node.gain.gain.value = 0; });
    setActiveMics(prev => {
      const u = { ...prev };
      Object.keys(u).forEach(k => { u[k] = { ...u[k], muted: true }; });
      return u;
    });
    sendSignal({ type: "force-mute" as any });
  };

  const unmuteAllViewers = () => {
    viewerAudioNodesRef.current.forEach(node => { node.gain.gain.value = 1; });
    setActiveMics(prev => {
      const u = { ...prev };
      Object.keys(u).forEach(k => { u[k] = { ...u[k], muted: false }; });
      return u;
    });
    sendSignal({ type: "force-unmute" as any });
  };

  const onSubmitPath = async (values: PathFormValues) => {
    if (!id) return;
    try {
      const { error } = await supabase.from("rooms").update({ current_path: values.current_path }).eq("id", id);
      if (error) throw error;
      toast({ title: "URL atualizada" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !id || !user) return;

    try {
      const { error } = await supabase.from("room_messages").insert({
        room_id: id,
        user_id: user.id,
        message: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleTheaterMode = () => {
    if (!theaterContainerRef.current) return;

    if (!isTheaterMode) {
      theaterContainerRef.current.requestFullscreen?.().catch(console.error);
      setIsTheaterMode(true);
    } else {
      document.exitFullscreen?.().catch(console.error);
      setIsTheaterMode(false);
    }
  };

  // Force reload transmission - reconnect WebRTC
  const forceReloadTransmission = async () => {
    toast({ title: "Recarregando...", description: "Reconectando à transmissão." });

    // For WebRTC: close existing connections and request new stream
    if (!isAdmin) {
      // Close all existing peer connections
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      setRemoteStream(null);

      // Request new stream from admin
      if (webrtcChannelRef.current) {
        await webrtcChannelRef.current.send({
          type: "broadcast",
          event: "webrtc",
          payload: { type: "viewer-join", from: clientId },
        });
      }
      
      toast({ title: "Solicitação enviada", description: "Aguardando transmissão do administrador." });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isTheaterMode) {
        setIsTheaterMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isTheaterMode]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (accessDenied || !room) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="glass-panel border-border/80 max-w-md w-full animate-fade-in">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Acesso negado</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Você não tem permissão para acessar esta sala. Verifique se seu cargo permite o acesso ou entre em contato com um administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao painel
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const hasStream = isAdmin ? !!localStream : !!remoteStream;
  const showWebRTC = hasStream;
  const isWebRTCLive = isAdmin ? isSharingScreen : (!!remoteStream || isAdminLive);
  const isLive = isWebRTCLive;

  return (
    <>
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b border-border/50 bg-card/50 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <img src={logo} alt="Logo" className="h-6 w-6" decoding="async" width={24} height={24} />
            <div>
              <h1 className="text-sm font-semibold">{room.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{presenceCount} conectados</span>
                {room.allowed_roles.map((role) => (
                  <Badge key={role} variant="outline" className="text-[10px]">
                    {roleLabels[role]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quality selector - only for admin, only when not streaming */}
            {isAdmin && !isSharingScreen && (
              <div className="flex items-center gap-1.5">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={streamQuality}
                  onValueChange={(value: StreamQuality) => setStreamQuality(value)}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs bg-card/50">
                    <SelectValue placeholder="Qualidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(qualityPresets) as StreamQuality[]).map((key) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {qualityPresets[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Streaming quality indicator - show current quality when streaming */}
            {isAdmin && isSharingScreen && (
              <Badge variant="outline" className="text-[10px] bg-accent/10">
                {qualityPresets[streamQuality].label}
              </Badge>
            )}

            {/* Audio controls */}
            <RoomAudioPanel
              isAdmin={isAdmin}
              isBroadcasting={isSharingScreen}
              adminMicEnabled={adminMicEnabled}
              onToggleAdminMic={toggleAdminMic}
              activeMics={Object.entries(activeMics).map(([cid, info]) => ({ clientId: cid, ...info }))}
              onMuteViewer={muteViewer}
              onUnmuteViewer={unmuteViewer}
              onMuteAll={muteAllViewers}
              onUnmuteAll={unmuteAllViewers}
              viewerMicEnabled={viewerMicEnabled}
              onToggleViewerMic={toggleViewerMic}
              isForceMuted={isForceMuted}
            />
            
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                {isSharingScreen && (
                  <div className="flex items-center gap-1.5">
                    {screenCount > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10">
                        {screenCount} tela{screenCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addScreen().catch(console.error)}
                      title="Adicionar mais uma tela à transmissão (máx. 4)"
                      disabled={screenCount >= 4}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Adicionar tela
                    </Button>
                    {isCropMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={adjustCropRegion}
                        title="Ajustar a região de recorte em tempo real"
                      >
                        <Crop className="h-4 w-4 mr-1" />
                        Ajustar recorte
                      </Button>
                    )}
                    {screenCount === 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const ids = compositorRef.current?.getSourceIds() ?? [];
                          if (ids[0]) swapScreenSource(ids[0]).catch(console.error);
                        }}
                        title="Trocar tela/janela sem interromper a transmissão"
                      >
                        <MonitorUp className="h-4 w-4 mr-1" />
                        Trocar tela
                      </Button>
                    )}
                    {compositorRef.current && screenCount >= 2 && (
                      <MultiScreenControls
                        compositor={compositorRef.current}
                        onRemoveSource={(id) => {
                          compositorRef.current?.removeSource(id);
                          setScreenCount(compositorRef.current?.count ?? 0);
                          if (compositorRef.current && compositorRef.current.count === 0) {
                            stopScreenShare();
                          }
                        }}
                        onSwapSource={(id) => swapScreenSource(id).catch(console.error)}
                      />
                    )}
                  </div>
                )}
                {isSharingScreen ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={stopScreenShare}
                  >
                    <ScreenShareOff className="h-4 w-4 mr-1" />
                    Parar transmissão
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={startScreenShare}
                      className="glow-ring"
                    >
                      <ScreenShare className="h-4 w-4 mr-1" />
                      Compartilhar tela
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startCropShare().catch(console.error)}
                      className="gap-1.5"
                    >
                      <Crop className="h-4 w-4" />
                      Recortar Tela
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 gap-4 p-4 lg:grid lg:grid-cols-[1fr_300px] overflow-hidden">
          {/* Video/Iframe area */}
          <div ref={theaterContainerRef} className="flex flex-col gap-4 min-h-0 overflow-hidden flex-1">
            <Card className="glass-panel border-border/80 overflow-hidden flex-1 min-h-0">
              <div className="relative h-full w-full bg-gradient-to-br from-primary/10 via-background to-accent/10">
                {showWebRTC ? (
                  <VideoProtection roomId={id} disablePauseOnBlur={isAdmin}>
                    <div className="relative h-full w-full">
                      <video
                        ref={isAdmin ? localVideoRef : remoteVideoRef}
                        autoPlay
                        muted={isAdmin || viewerMuted}
                        playsInline
                        className="h-full w-full object-contain"
                      />
                      {isAdmin && compositorRef.current && screenCount >= 2 && (
                        <CompositorResizeOverlay compositor={compositorRef.current} />
                      )}
                    </div>
                  </VideoProtection>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      {waitingForAdmin ? (
                        <>
                          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                          <p className="mt-4 text-sm text-muted-foreground">
                            Conectando à transmissão...
                          </p>
                        </>
                      ) : (
                        <>
                          <MonitorPlay className="mx-auto h-16 w-16 text-muted-foreground/30" />
                          <p className="mt-4 text-sm text-muted-foreground">
                            {isAdmin 
                              ? "Configure uma URL abaixo ou inicie a transmissão de tela" 
                              : "Nenhuma transmissão ativa no momento"}
                          </p>
                          {!isAdmin && (
                            <p className="mt-2 text-xs text-muted-foreground/70">
                              O administrador não está transmitindo. Tente novamente mais tarde.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Overlay controls */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  {!isAdmin && showWebRTC && remoteStream && (viewerMuted || remotePlayBlocked) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        const videoEl = remoteVideoRef.current;
                        if (!videoEl) return;

                        try {
                          if (!remotePlayBlocked) {
                            setViewerMuted(false);
                            videoEl.muted = false;
                          }

                          await videoEl.play();
                          setRemotePlayBlocked(false);
                        } catch (err) {
                          console.warn("[WebRTC] User-initiated play failed:", err);
                          setRemotePlayBlocked(true);
                          toast({
                            title: "Ação necessária",
                            description: "O navegador bloqueou a reprodução automática. Clique em 'Iniciar vídeo' novamente ou interaja com o player.",
                          });
                        }
                      }}
                      title={remotePlayBlocked ? "Iniciar vídeo" : "Ativar áudio"}
                    >
                      {remotePlayBlocked ? "Iniciar vídeo" : "Ativar áudio"}
                    </Button>
                  )}

                  <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={forceReloadTransmission}
                    title="Recarregar transmissão"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" onClick={toggleTheaterMode}>
                    {isTheaterMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Status indicator */}
                <div className="absolute left-4 top-4">
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur " +
                      (isLive ? "status-online" : "status-offline")
                    }
                  >
                    <span className={"h-1.5 w-1.5 rounded-full " + (isLive ? "status-online-dot animate-pulse" : "bg-muted-foreground")} />
                    {isLive 
                      ? "Ao vivo"
                      : (isAdminLive && !remoteStream ? "Conectando..." : "Offline")
                    }
                  </span>
                </div>
              </div>
            </Card>

            {/* Promotions section */}
            <RoomPromotions />
          </div>

          {/* Chat - collapsible on mobile */}
          <div className="flex flex-col min-h-0 lg:h-auto">
            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden flex items-center gap-2 mb-2 self-start text-xs"
              onClick={() => setShowChat(!showChat)}
            >
              <Send className="h-3.5 w-3.5" />
              {showChat ? "Esconder chat" : "Mostrar chat"}
              {!showChat && messages.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{messages.length}</Badge>
              )}
            </Button>

            <Card className={`glass-panel border-border/80 flex flex-col ${showChat ? 'h-64 lg:h-[calc(100vh-200px)]' : 'hidden lg:flex lg:h-[calc(100vh-200px)]'}`}>
              <CardHeader className="pb-2 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Chat da sala</CardTitle>
                  {isAdmin && (
                    <Button
                      variant={room.chat_enabled ? "ghost" : "destructive"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={async () => {
                        const newState = !room.chat_enabled;
                        const { error } = await supabase
                          .from("rooms")
                          .update({ chat_enabled: newState })
                          .eq("id", id);
                        if (error) {
                          toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
                        } else {
                          toast({ title: newState ? "Chat ativado" : "Chat desativado" });
                        }
                      }}
                    >
                      {room.chat_enabled ? "Desativar chat" : "Ativar chat"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              {!room.chat_enabled && !isAdmin ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center text-muted-foreground">
                    <MessageCircleOff className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Chat desativado pelo administrador</p>
                  </div>
                </div>
              ) : (
                <>
                  <ScrollArea ref={chatScrollRef} className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground">Nenhuma mensagem ainda</p>
                      ) : (
                        messages.map((msg) => {
                          const isSpeaking = Object.values(activeMics).some(
                            (m) => m.userId === msg.user_id && !m.muted
                          );
                          return (
                            <div key={msg.id} className="text-xs flex items-start gap-1">
                              <span className="font-medium text-accent inline-flex items-center gap-1">
                                {isSpeaking && <AudioWaveIndicator className="mr-0.5" />}
                                {userProfiles[msg.user_id] || "Carregando..."}:
                              </span>{" "}
                              <span className="text-foreground">{msg.message}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                  <div className="border-t border-border/50 p-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendChatMessage();
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={room.chat_enabled ? "Digite sua mensagem..." : "Chat desativado"}
                        className="flex-1 bg-card/50 text-sm"
                        disabled={!room.chat_enabled}
                      />
                      <Button type="submit" size="icon" disabled={!newMessage.trim() || !room.chat_enabled}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>

      {/* Screen Crop Selector Overlay */}
      {cropSelectorStream && (
        <ScreenCropSelector
          stream={cropSelectorStream}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          outputWidth={qualityPresets[streamQuality].width}
          outputHeight={qualityPresets[streamQuality].height}
          outputFrameRate={qualityPresets[streamQuality].frameRate}
          initialRegion={cropInitialRegion}
          isAdjusting={isCropMode}
        />
      )}
    </>
  );
};

export default RoomPage;
