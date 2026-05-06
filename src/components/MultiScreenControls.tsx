import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowUp,
  ArrowDown,
  Maximize2,
  Grid2X2,
  Monitor,
  LayoutPanelLeft,
  X,
  SlidersHorizontal,
  Replace,
  Rows3,
  Columns3,
} from "lucide-react";
import type { CanvasCompositor, LayoutMode, LayoutOrientation } from "@/utils/CanvasCompositor";

interface MultiScreenControlsProps {
  compositor: CanvasCompositor;
  onRemoveSource?: (id: string) => void;
  onSwapSource?: (id: string) => void;
}

export function MultiScreenControls({ compositor, onRemoveSource, onSwapSource }: MultiScreenControlsProps) {
  const getSources = () => {
    if (typeof compositor.getSources === "function") return compositor.getSources();
    const ids = compositor.getSourceIds?.() ?? [];
    return ids.map((id: string, i: number) => ({ id, label: `Tela ${i + 1}`, weight: 1 }));
  };

  const [sources, setSources] = useState(getSources());
  const [layout, setLayout] = useState<LayoutMode>((compositor as any).layoutMode ?? "grid");
  const [focusIdx, setFocusIdx] = useState((compositor as any).focusIndex ?? 0);
  const [orientation, setOrientationState] = useState<LayoutOrientation>((compositor as any).orientation ?? "vertical");
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    setSources([...getSources()]);
    setLayout((compositor as any).layoutMode ?? "grid");
    setFocusIdx((compositor as any).focusIndex ?? 0);
    setOrientationState((compositor as any).orientation ?? "vertical");
    setTick((t) => t + 1);
  }, [compositor]);

  useEffect(() => {
    compositor.onChange = refresh;
    refresh();
    return () => {
      compositor.onChange = undefined;
    };
  }, [compositor, refresh]);

  if (sources.length < 2) return null;

  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    compositor.swapSources(idx, idx - 1);
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= sources.length - 1) return;
    compositor.swapSources(idx, idx + 1);
  };

  const handleFocus = (idx: number) => {
    compositor.setFocusIndex(idx);
  };

  const handleSetLayout = (mode: LayoutMode) => {
    compositor.setLayoutMode(mode);
  };

  const handleSetOrientation = (o: LayoutOrientation) => {
    compositor.setOrientation(o);
  };

  const handleRemove = (id: string) => {
    onRemoveSource?.(id);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <LayoutPanelLeft className="h-4 w-4" />
          Layout
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-3">
          {/* Layout mode toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-auto">Modo</span>
            <Button
              variant={layout === "grid" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleSetLayout("grid")}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              Grade
            </Button>
            <Button
              variant={layout === "focus" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleSetLayout("focus")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Destaque
            </Button>
            <Button
              variant={layout === "custom" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleSetLayout("custom")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Livre
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1 w-full">
              {layout === "custom" ? "Arraste os divisores no vídeo para redimensionar" : ""}
            </p>
          </div>

          {/* Orientation toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-auto">Orientação</span>
            <Button
              variant={orientation === "vertical" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleSetOrientation("vertical")}
            >
              <Rows3 className="h-3.5 w-3.5" />
              Vertical
            </Button>
            <Button
              variant={orientation === "horizontal" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleSetOrientation("horizontal")}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Horizontal
            </Button>
          </div>

          {/* Source list */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Telas ({sources.length})</span>
            {sources.map((src, idx) => (
              <Card
                key={src.id}
                className={`p-2 space-y-1.5 ${
                  layout === "focus" && idx === focusIdx
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">
                    {src.label}
                  </span>

                  {layout === "focus" && idx === focusIdx && (
                    <Badge variant="default" className="text-[9px] h-4 px-1">
                      Principal
                    </Badge>
                  )}

                  <div className="flex items-center gap-0.5 shrink-0">
                    {onSwapSource && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onSwapSource(src.id)}
                        title="Trocar esta tela"
                      >
                        <Replace className="h-3 w-3" />
                      </Button>
                    )}
                    {layout === "focus" && idx !== focusIdx && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleFocus(idx)}
                        title="Destacar esta tela"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === sources.length - 1}
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(src.id)}
                      title="Remover tela"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

              </Card>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
