import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasCompositor } from "@/utils/CanvasCompositor";

interface CompositorResizeOverlayProps {
  compositor: CanvasCompositor;
}

/**
 * Transparent overlay that renders draggable dividers (horizontal or vertical)
 * on top of the admin's video preview for the "custom" layout mode.
 */
export function CompositorResizeOverlay({ compositor }: CompositorResizeOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<number[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    if (typeof compositor.getDividerPositions === "function") {
      setPositions(compositor.getDividerPositions());
    }
    setTick((t) => t + 1);
  }, [compositor]);

  useEffect(() => {
    const prev = compositor.onChange;
    compositor.onChange = () => {
      prev?.();
      refresh();
    };
    refresh();
    return () => {
      compositor.onChange = prev;
    };
  }, [compositor, refresh]);

  const isCustom = compositor.layoutMode === "custom";
  if (!isCustom || positions.length === 0) return null;

  const isHorizontal = compositor.orientation === "horizontal";
  const cursorStyle = isHorizontal ? "col-resize" : "row-resize";

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(idx);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const normalized = isHorizontal
      ? (e.clientX - rect.left) / rect.width
      : (e.clientY - rect.top) / rect.height;
    compositor.setDividerPosition(dragging, normalized);
  };

  const handlePointerUp = () => {
    setDragging(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ cursor: dragging !== null ? cursorStyle : undefined }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {positions.map((pos, idx) => {
        if (isHorizontal) {
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 flex items-center justify-center group"
              style={{
                left: `${pos * 100}%`,
                transform: "translateX(-50%)",
                width: "20px",
                cursor: "col-resize",
              }}
              onPointerDown={(e) => handlePointerDown(idx, e)}
            >
              <div
                className={`h-full w-[3px] transition-colors ${
                  dragging === idx
                    ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                    : "bg-primary/40 group-hover:bg-primary/70"
                }`}
              />
              <div
                className={`absolute flex items-center justify-center rounded-full border-2 w-8 h-8 transition-all ${
                  dragging === idx
                    ? "bg-primary border-primary scale-110"
                    : "bg-background/80 border-primary/50 group-hover:border-primary group-hover:bg-background"
                }`}
              >
                <svg width="10" height="14" viewBox="0 0 10 14" fill="none" className="text-primary">
                  <path d="M3 1v12M7 1v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="absolute left-0 right-0 flex items-center justify-center group"
            style={{
              top: `${pos * 100}%`,
              transform: "translateY(-50%)",
              height: "20px",
              cursor: "row-resize",
            }}
            onPointerDown={(e) => handlePointerDown(idx, e)}
          >
            <div
              className={`w-full h-[3px] transition-colors ${
                dragging === idx
                  ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                  : "bg-primary/40 group-hover:bg-primary/70"
              }`}
            />
            <div
              className={`absolute flex items-center justify-center rounded-full border-2 w-8 h-8 transition-all ${
                dragging === idx
                  ? "bg-primary border-primary scale-110"
                  : "bg-background/80 border-primary/50 group-hover:border-primary group-hover:bg-background"
              }`}
            >
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="text-primary">
                <path d="M1 3h12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
