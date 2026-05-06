import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface VideoProtectionProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  lessonId?: string;
  roomId?: string;
  /** If true, don't pause on tab leave (used for VPS broadcast) */
  disablePauseOnBlur?: boolean;
  children: React.ReactNode;
}

/**
 * Anti-piracy wrapper:
 * 1. Watermark overlay with user email
 * 2. Pause on tab/window blur (screen recording detection)
 * 3. Block PrintScreen / screenshot shortcuts
 * 4. Log attempts to database
 */
const VideoProtection = ({ videoRef, lessonId, roomId, disablePauseOnBlur, children }: VideoProtectionProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const logThrottleRef = useRef<Record<string, number>>({});

  const userLabel = user?.email || user?.id?.slice(0, 8) || "";

  const logEvent = useCallback(
    async (eventType: string) => {
      if (!user) return;
      // Throttle: max 1 log per event type per 30s
      const now = Date.now();
      const lastLog = logThrottleRef.current[eventType] || 0;
      if (now - lastLog < 30000) return;
      logThrottleRef.current[eventType] = now;

      try {
        await supabase.from("piracy_logs").insert({
          user_id: user.id,
          event_type: eventType,
          lesson_id: lessonId || null,
          room_id: roomId || null,
        });
      } catch (err) {
        console.error("Failed to log piracy event:", err);
      }
    },
    [user, lessonId, roomId]
  );

  // Pause video when tab loses focus
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      logEvent("tab_leave");
      if (!disablePauseOnBlur && videoRef?.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [videoRef, disablePauseOnBlur, logEvent]);

  // Block common screenshot shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        logEvent("screenshot_attempt");
        if (videoRef?.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
      if (
        (e.ctrlKey && e.shiftKey && e.key === "S") ||
        (e.ctrlKey && e.key === "p") ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5"))
      ) {
        e.preventDefault();
        logEvent(e.key === "p" ? "print_attempt" : "screenshot_attempt");
      }
    },
    [videoRef, logEvent]
  );

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleVisibilityChange, handleKeyDown]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none"
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {children}

      {/* Watermark overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-24 gap-y-14 rotate-[-20deg] scale-125 opacity-[0.12]">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="text-white font-semibold whitespace-nowrap tracking-widest"
              style={{ fontSize: "16px", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
            >
              {userLabel}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoProtection;
