import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Crop, Check, X, Move, Maximize2 } from "lucide-react";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenCropSelectorProps {
  stream: MediaStream;
  onConfirm: (croppedStream: MediaStream, region: CropRegion) => void;
  onCancel: () => void;
  outputWidth: number;
  outputHeight: number;
  outputFrameRate: number;
  initialRegion?: CropRegion | null;
  isAdjusting?: boolean;
}

type DragMode = "none" | "draw" | "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" | "resize-n" | "resize-s" | "resize-e" | "resize-w";

const HANDLE_SIZE = 10;
const MIN_SIZE = 40;

export function ScreenCropSelector({
  stream,
  onConfirm,
  onCancel,
  outputWidth,
  outputHeight,
  outputFrameRate,
  initialRegion,
  isAdjusting = false,
}: ScreenCropSelectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selection, setSelection] = useState<CropRegion | null>(initialRegion ?? null);
  const [videoReady, setVideoReady] = useState(false);
  const dragMode = useRef<DragMode>("none");
  const dragStart = useRef<{ x: number; y: number; sel: CropRegion | null }>({ x: 0, y: 0, sel: null });

  // Play the stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(console.error);

    // If metadata is already loaded (e.g. reusing an active stream), mark ready immediately
    if (video.readyState >= 1) {
      setVideoReady(true);
    } else {
      const onLoaded = () => setVideoReady(true);
      video.addEventListener("loadedmetadata", onLoaded);
      return () => video.removeEventListener("loadedmetadata", onLoaded);
    }
  }, [stream]);

  // Compute the "letterboxed" video area inside the canvas
  const getVideoArea = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return { ox: 0, oy: 0, dw: 0, dh: 0 };
    const rect = canvas.getBoundingClientRect();
    const canvasAR = rect.width / rect.height;
    const videoAR = video.videoWidth / video.videoHeight;
    let dw: number, dh: number, ox: number, oy: number;
    if (videoAR > canvasAR) {
      dw = rect.width;
      dh = rect.width / videoAR;
      ox = 0;
      oy = (rect.height - dh) / 2;
    } else {
      dh = rect.height;
      dw = rect.height * videoAR;
      ox = (rect.width - dw) / 2;
      oy = 0;
    }
    return { ox, oy, dw, dh };
  }, []);

  // Coordinate conversion helpers
  const getVideoCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { ox, oy, dw, dh } = getVideoArea();
    const relX = clientX - rect.left - ox;
    const relY = clientY - rect.top - oy;
    const scaleX = video.videoWidth / dw;
    const scaleY = video.videoHeight / dh;
    return {
      x: Math.max(0, Math.min(video.videoWidth, relX * scaleX)),
      y: Math.max(0, Math.min(video.videoHeight, relY * scaleY)),
    };
  }, [getVideoArea]);

  // Determine what the cursor is hovering over
  const getHitZone = useCallback((clientX: number, clientY: number): DragMode => {
    if (!selection) return "draw";
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return "draw";

    const rect = canvas.getBoundingClientRect();
    const { ox, oy, dw, dh } = getVideoArea();
    const scaleX = dw / video.videoWidth;
    const scaleY = dh / video.videoHeight;
    const sx = ox + selection.x * scaleX;
    const sy = oy + selection.y * scaleY;
    const sw = selection.width * scaleX;
    const sh = selection.height * scaleY;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const h = HANDLE_SIZE;

    // Corner handles
    if (Math.abs(mx - sx) < h && Math.abs(my - sy) < h) return "resize-nw";
    if (Math.abs(mx - (sx + sw)) < h && Math.abs(my - sy) < h) return "resize-ne";
    if (Math.abs(mx - sx) < h && Math.abs(my - (sy + sh)) < h) return "resize-sw";
    if (Math.abs(mx - (sx + sw)) < h && Math.abs(my - (sy + sh)) < h) return "resize-se";

    // Edge handles
    if (Math.abs(mx - sx) < h && my > sy + h && my < sy + sh - h) return "resize-w";
    if (Math.abs(mx - (sx + sw)) < h && my > sy + h && my < sy + sh - h) return "resize-e";
    if (Math.abs(my - sy) < h && mx > sx + h && mx < sx + sw - h) return "resize-n";
    if (Math.abs(my - (sy + sh)) < h && mx > sx + h && mx < sx + sw - h) return "resize-s";

    // Inside = move
    if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) return "move";

    return "draw";
  }, [selection, getVideoArea]);

  // Cursor style
  const getCursor = useCallback((zone: DragMode) => {
    switch (zone) {
      case "move": return "move";
      case "resize-nw": case "resize-se": return "nwse-resize";
      case "resize-ne": case "resize-sw": return "nesw-resize";
      case "resize-n": case "resize-s": return "ns-resize";
      case "resize-e": case "resize-w": return "ew-resize";
      default: return "crosshair";
    }
  }, []);

  // Draw overlay
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !videoReady) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cw = rect.width;
    const ch = rect.height;

    // Fill black background (for letterbox bars)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    // Compute video drawing area (letterboxed)
    const { ox, oy, dw, dh } = getVideoArea();

    // Draw the video in the correct area
    ctx.drawImage(video, ox, oy, dw, dh);

    if (selection) {
      const scaleX = dw / video.videoWidth;
      const scaleY = dh / video.videoHeight;
      const sx = ox + selection.x * scaleX;
      const sy = oy + selection.y * scaleY;
      const sw = selection.width * scaleX;
      const sh = selection.height * scaleY;

      // Dim outside selection (only within video area)
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(ox, oy, dw, sy - oy); // top
      ctx.fillRect(ox, sy, sx - ox, sh); // left
      ctx.fillRect(sx + sw, sy, ox + dw - sx - sw, sh); // right
      ctx.fillRect(ox, sy + sh, dw, oy + dh - sy - sh); // bottom

      // Border
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(sx, sy, sw, sh);

      // Rule of thirds lines
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + (sw * i) / 3, sy);
        ctx.lineTo(sx + (sw * i) / 3, sy + sh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy + (sh * i) / 3);
        ctx.lineTo(sx + sw, sy + (sh * i) / 3);
        ctx.stroke();
      }

      // Corner handles (larger)
      const h = 12;
      ctx.fillStyle = "hsl(var(--primary))";
      const corners = [
        [sx - h / 2, sy - h / 2],
        [sx + sw - h / 2, sy - h / 2],
        [sx - h / 2, sy + sh - h / 2],
        [sx + sw - h / 2, sy + sh - h / 2],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.roundRect(cx, cy, h, h, 3);
        ctx.fill();
      });

      // Edge midpoint handles
      ctx.fillStyle = "hsl(var(--primary) / 0.8)";
      const edges = [
        [sx + sw / 2 - h / 2, sy - h / 2],
        [sx + sw / 2 - h / 2, sy + sh - h / 2],
        [sx - h / 2, sy + sh / 2 - h / 2],
        [sx + sw - h / 2, sy + sh / 2 - h / 2],
      ];
      edges.forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.roundRect(ex, ey, h, h, 3);
        ctx.fill();
      });

      // Dimensions label
      const label = `${Math.round(selection.width)} × ${Math.round(selection.height)}`;
      ctx.font = "bold 14px system-ui, sans-serif";
      const metrics = ctx.measureText(label);
      const lx = sx + sw / 2 - metrics.width / 2 - 8;
      const ly = sy > 32 ? sy - 12 : sy + sh + 8;
      ctx.fillStyle = "hsl(var(--primary))";
      ctx.beginPath();
      ctx.roundRect(lx, ly - 16, metrics.width + 16, 24, 5);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + 8, ly + 1);
    }
  }, [selection, videoReady, getVideoArea]);

  useEffect(() => {
    let animId: number;
    const loop = () => { drawOverlay(); animId = requestAnimationFrame(loop); };
    if (videoReady) loop();
    return () => cancelAnimationFrame(animId);
  }, [drawOverlay, videoReady]);

  // Clamp selection within video bounds
  const clampSelection = useCallback((s: CropRegion): CropRegion => {
    const video = videoRef.current;
    if (!video) return s;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let { x, y, width, height } = s;
    width = Math.max(MIN_SIZE, Math.min(width, vw));
    height = Math.max(MIN_SIZE, Math.min(height, vh));
    x = Math.max(0, Math.min(x, vw - width));
    y = Math.max(0, Math.min(y, vh - height));
    return { x, y, width, height };
  }, []);

  // Pointer handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const zone = getHitZone(e.clientX, e.clientY);
    const coords = getVideoCoords(e.clientX, e.clientY);
    dragMode.current = zone;
    dragStart.current = { x: coords.x, y: coords.y, sel: selection ? { ...selection } : null };

    if (zone === "draw") {
      setSelection(null);
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Update cursor
    if (dragMode.current === "none") {
      const zone = getHitZone(e.clientX, e.clientY);
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.style.cursor = getCursor(zone);
      return;
    }

    const coords = getVideoCoords(e.clientX, e.clientY);
    const dx = coords.x - dragStart.current.x;
    const dy = coords.y - dragStart.current.y;
    const orig = dragStart.current.sel;

    if (dragMode.current === "draw") {
      const x = Math.min(dragStart.current.x, coords.x);
      const y = Math.min(dragStart.current.y, coords.y);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      if (w > 10 && h > 10) {
        setSelection(clampSelection({ x, y, width: w, height: h }));
      }
    } else if (dragMode.current === "move" && orig) {
      setSelection(clampSelection({ ...orig, x: orig.x + dx, y: orig.y + dy }));
    } else if (orig) {
      // Resize modes
      let { x, y, width, height } = orig;
      const mode = dragMode.current;
      if (mode.includes("w")) { x += dx; width -= dx; }
      if (mode.includes("e")) { width += dx; }
      if (mode.includes("n")) { y += dy; height -= dy; }
      if (mode.includes("s")) { height += dy; }
      if (width < MIN_SIZE) { if (mode.includes("w")) x = orig.x + orig.width - MIN_SIZE; width = MIN_SIZE; }
      if (height < MIN_SIZE) { if (mode.includes("n")) y = orig.y + orig.height - MIN_SIZE; height = MIN_SIZE; }
      setSelection(clampSelection({ x, y, width, height }));
    }
  };

  const handlePointerUp = () => {
    dragMode.current = "none";
  };

  const handleSelectAll = () => {
    const video = videoRef.current;
    if (!video) return;
    setSelection({ x: 0, y: 0, width: video.videoWidth, height: video.videoHeight });
  };

  const handleConfirm = () => {
    if (!selection || !videoRef.current) return;

    // If adjusting an existing crop, just pass the new region (no new stream needed)
    if (isAdjusting) {
      onConfirm(new MediaStream(), selection);
      return;
    }

    const video = videoRef.current;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = outputWidth;
    cropCanvas.height = outputHeight;
    const cropCtx = cropCanvas.getContext("2d")!;
    let running = true;

    const drawCrop = () => {
      if (!running) return;
      cropCtx.drawImage(video, selection.x, selection.y, selection.width, selection.height, 0, 0, outputWidth, outputHeight);
      requestAnimationFrame(drawCrop);
    };
    drawCrop();

    const croppedStream = cropCanvas.captureStream(outputFrameRate);
    const track = croppedStream.getVideoTracks()[0];
    if (track) track.addEventListener("ended", () => { running = false; });
    stream.getVideoTracks()[0]?.addEventListener("ended", () => { running = false; track?.stop(); });

    onConfirm(croppedStream, selection);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2 text-foreground">
          <Crop className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{isAdjusting ? "Ajustar região de recorte" : "Recortar região da tela"}</span>
          {!selection && (
            <span className="text-xs text-muted-foreground ml-2">Clique e arraste para selecionar</span>
          )}
          {selection && (
            <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1">
              <Move className="h-3 w-3" /> Arraste para mover · Handles para redimensionar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs gap-1">
            <Maximize2 className="h-3.5 w-3.5" />
            Tela inteira
          </Button>
          {selection && (
            <Button variant="default" size="sm" onClick={handleConfirm} className="gap-1">
              <Check className="h-4 w-4" />
              {isAdjusting ? "Aplicar" : "Confirmar"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area - fills all available space */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        <video ref={videoRef} className="hidden" />
        <canvas
          ref={overlayCanvasRef}
          className="block"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            cursor: "crosshair",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!selection && videoReady && dragMode.current === "none" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-300">
            <div className="bg-background/80 backdrop-blur-sm rounded-xl px-8 py-5 text-center shadow-lg border border-border/50">
              <Crop className="h-10 w-10 text-primary mx-auto mb-3 opacity-80" />
              <p className="text-sm text-foreground font-medium">Clique e arraste para selecionar a região</p>
              <p className="text-xs text-muted-foreground mt-1.5">Somente a área selecionada será transmitida</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
