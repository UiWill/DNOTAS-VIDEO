/**
 * CanvasCompositor – renders up to 4 display capture streams onto a single
 * <canvas>, producing a composited MediaStream that can be sent over WebRTC.
 *
 * Layout modes:
 *  "grid"  → automatic equal grid (1=full, 2=50/50, 3=2+1, 4=2×2)
 *  "focus" → focusIndex source gets ~70% area, others share remaining space
 *  "custom" → user-defined split ratios per source
 */

export type LayoutMode = "grid" | "focus" | "custom";
export type LayoutOrientation = "vertical" | "horizontal";

export interface CompositorOptions {
  width: number;
  height: number;
  frameRate: number;
}

export interface CompositorSource {
  id: string;
  stream: MediaStream;
  videoElement: HTMLVideoElement;
  label?: string;
  /** Weight for custom layout (default 1). Higher = more space. */
  weight: number;
}

export class CanvasCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sources: CompositorSource[] = [];
  private animFrameId: number | null = null;
  private outputStream: MediaStream;
  private running = false;
  private _layoutMode: LayoutMode = "grid";
  private _focusIndex = 0;
  private _orientation: LayoutOrientation = "horizontal";
  private _onChange?: () => void;
  readonly maxSources = 4;

  constructor(private options: CompositorOptions) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = options.width;
    this.canvas.height = options.height;
    this.ctx = this.canvas.getContext("2d")!;
    this.outputStream = this.canvas.captureStream(options.frameRate);
  }

  /** Register a callback fired whenever sources / layout change. */
  set onChange(cb: (() => void) | undefined) {
    this._onChange = cb;
  }

  private notifyChange() {
    this._onChange?.();
  }

  /** The composited video stream (single video track). */
  getOutputStream(): MediaStream {
    return this.outputStream;
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.outputStream.getVideoTracks()[0] ?? null;
  }

  get count(): number {
    return this.sources.length;
  }

  get layoutMode(): LayoutMode {
    return this._layoutMode;
  }

  get focusIndex(): number {
    return this._focusIndex;
  }

  get orientation(): LayoutOrientation {
    return this._orientation;
  }

  setOrientation(orientation: LayoutOrientation): void {
    this._orientation = orientation;
    this.notifyChange();
  }

  /** Get snapshot of current sources for UI */
  getSources(): ReadonlyArray<{ id: string; label: string; weight: number }> {
    return this.sources.map((s, i) => ({
      id: s.id,
      label: s.label ?? `Tela ${i + 1}`,
      weight: s.weight,
    }));
  }

  // ─── Layout Controls ──────────────────────────────────────

  setLayoutMode(mode: LayoutMode): void {
    this._layoutMode = mode;
    this.notifyChange();
  }

  setFocusIndex(index: number): void {
    if (index >= 0 && index < this.sources.length) {
      this._focusIndex = index;
      if (this._layoutMode !== "focus") this._layoutMode = "focus";
      this.notifyChange();
    }
  }

  /** Set weight for a source (used in custom layout). */
  setSourceWeight(id: string, weight: number): void {
    const src = this.sources.find((s) => s.id === id);
    if (src) {
      src.weight = Math.max(0.1, Math.min(5, weight));
      this.notifyChange();
    }
  }

  /** Swap two sources by index. */
  swapSources(indexA: number, indexB: number): void {
    if (
      indexA < 0 || indexA >= this.sources.length ||
      indexB < 0 || indexB >= this.sources.length ||
      indexA === indexB
    ) return;
    [this.sources[indexA], this.sources[indexB]] = [this.sources[indexB], this.sources[indexA]];
    if (this._focusIndex === indexA) this._focusIndex = indexB;
    else if (this._focusIndex === indexB) this._focusIndex = indexA;
    this.notifyChange();
  }

  /** Move a source to a specific index position. */
  moveSource(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 || fromIndex >= this.sources.length ||
      toIndex < 0 || toIndex >= this.sources.length ||
      fromIndex === toIndex
    ) return;
    const [item] = this.sources.splice(fromIndex, 1);
    this.sources.splice(toIndex, 0, item);
    if (this._focusIndex === fromIndex) {
      this._focusIndex = toIndex;
    } else if (fromIndex < this._focusIndex && toIndex >= this._focusIndex) {
      this._focusIndex--;
    } else if (fromIndex > this._focusIndex && toIndex <= this._focusIndex) {
      this._focusIndex++;
    }
    this.notifyChange();
  }

  // ─── Source Management ─────────────────────────────────────

  /** Replace the stream of an existing source (hot-swap). */
  replaceSource(id: string, newStream: MediaStream, newLabel?: string): void {
    const src = this.sources.find((s) => s.id === id);
    if (!src) return;

    // Stop old tracks
    src.stream.getTracks().forEach((t) => t.stop());
    src.videoElement.srcObject = null;

    // Set new stream
    src.stream = newStream;
    src.videoElement.srcObject = newStream;
    src.videoElement.play().catch(console.error);
    if (newLabel !== undefined) src.label = newLabel;

    // Track ended handler
    const videoTrack = newStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        console.log("[Compositor] Replaced source track ended:", id);
        this.removeSource(id);
      };
    }

    this.notifyChange();
  }

  addSource(stream: MediaStream, label?: string): string {
    if (this.sources.length >= this.maxSources) {
      throw new Error(`Maximum of ${this.maxSources} sources reached`);
    }

    const id = crypto.randomUUID();
    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.play().catch(console.error);

    const source: CompositorSource = { id, stream, videoElement, label, weight: 1 };
    this.sources.push(source);

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        console.log("[Compositor] Source track ended:", id);
        this.removeSource(id);
      };
    }

    if (!this.running) this.startRenderLoop();
    this.notifyChange();
    return id;
  }

  removeSource(id: string): void {
    const idx = this.sources.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const [removed] = this.sources.splice(idx, 1);
    removed.stream.getTracks().forEach((t) => t.stop());
    removed.videoElement.srcObject = null;

    if (this._focusIndex >= this.sources.length) {
      this._focusIndex = Math.max(0, this.sources.length - 1);
    }

    if (this.sources.length === 0) {
      this.stopRenderLoop();
    }
    this.notifyChange();
  }

  destroy(): void {
    this.stopRenderLoop();
    this.sources.forEach((s) => {
      s.stream.getTracks().forEach((t) => t.stop());
      s.videoElement.srcObject = null;
    });
    this.sources = [];
    this._onChange = undefined;
  }

  getAllStreams(): MediaStream[] {
    return this.sources.map((s) => s.stream);
  }

  getSourceIds(): string[] {
    return this.sources.map((s) => s.id);
  }

  // ─── Private ───────────────────────────────────────────────

  private bgWorker: Worker | null = null;
  private bgIntervalId: number | null = null;
  private visibilityHandler: (() => void) | null = null;

  private startRenderLoop(): void {
    this.running = true;

    // Use rAF when tab is visible, Worker-based setInterval when hidden
    const drawRAF = () => {
      if (!this.running) return;
      if (document.hidden) return; // Worker takes over when hidden
      this.render();
      this.animFrameId = requestAnimationFrame(drawRAF);
    };

    const startBackgroundTimer = () => {
      this.stopBackgroundTimer();
      try {
        // Use much lower framerate in background to avoid OOM (5 fps is enough to keep stream alive)
        const bgInterval = 200; // 5 fps in background
        const workerCode = `
          let id = null;
          self.onmessage = (e) => {
            if (e.data === 'start') {
              if (id) clearInterval(id);
              id = setInterval(() => self.postMessage('tick'), ${bgInterval});
            } else if (e.data === 'stop') {
              if (id) { clearInterval(id); id = null; }
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.bgWorker = new Worker(url);
        URL.revokeObjectURL(url);
        this.bgWorker.onmessage = () => {
          if (this.running) this.render();
        };
        this.bgWorker.postMessage('start');
      } catch {
        // Fallback to setInterval if Workers unavailable
        const bgInterval = 200; // 5 fps
        this.bgIntervalId = window.setInterval(() => {
          if (this.running) this.render();
        }, bgInterval);
      }
    };

    const stopBackgroundAndUseRAF = () => {
      this.stopBackgroundTimer();
      if (this.running) {
        this.animFrameId = requestAnimationFrame(drawRAF);
      }
    };

    this.visibilityHandler = () => {
      if (document.hidden) {
        // Tab hidden → stop rAF, start worker timer
        if (this.animFrameId !== null) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }
        startBackgroundTimer();
      } else {
        // Tab visible → stop worker, resume rAF
        stopBackgroundAndUseRAF();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Start with the appropriate mode
    if (document.hidden) {
      startBackgroundTimer();
    } else {
      drawRAF();
    }
  }

  private stopBackgroundTimer(): void {
    if (this.bgWorker) {
      this.bgWorker.postMessage('stop');
      this.bgWorker.terminate();
      this.bgWorker = null;
    }
    if (this.bgIntervalId !== null) {
      clearInterval(this.bgIntervalId);
      this.bgIntervalId = null;
    }
  }

  private stopRenderLoop(): void {
    this.running = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.stopBackgroundTimer();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private render(): void {
    const { width, height } = this.canvas;
    const n = this.sources.length;

    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, width, height);

    if (n === 0) return;

    const gap = 4;
    let cells: { x: number; y: number; w: number; h: number }[];

    if (this._layoutMode === "custom" && n > 1) {
      cells = this.computeCustomLayout(n, width, height, gap);
    } else if (this._layoutMode === "focus" && n > 1) {
      cells = this.computeFocusLayout(n, width, height, gap);
    } else {
      cells = this.computeGrid(n, width, height, gap);
    }

    cells.forEach((cell, i) => {
      if (i >= n) return;
      const src = this.sources[i];
      const vw = src.videoElement.videoWidth || 1;
      const vh = src.videoElement.videoHeight || 1;

      const { dx, dy, dw, dh } = this.fitInto(vw, vh, cell.x, cell.y, cell.w, cell.h);

      try {
        this.ctx.drawImage(src.videoElement, dx, dy, dw, dh);
      } catch {
        // video not ready yet
      }

      // Border
      this.ctx.strokeStyle = "rgba(255,255,255,0.15)";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);

      // Label
      const label = src.label ?? `${i + 1}`;
      this.ctx.fillStyle = "rgba(0,0,0,0.5)";
      const labelW = Math.min(label.length * 8 + 16, cell.w);
      this.ctx.fillRect(cell.x, cell.y, labelW, 22);
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 13px sans-serif";
      this.ctx.fillText(label, cell.x + 8, cell.y + 16);

      // Focus indicator
      if (this._layoutMode === "focus" && i === this._focusIndex) {
        this.ctx.strokeStyle = "rgba(59,130,246,0.7)";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2);
      }
    });
  }

  private computeGrid(
    n: number, W: number, H: number, gap: number
  ): { x: number; y: number; w: number; h: number }[] {
    if (n === 1) return [{ x: 0, y: 0, w: W, h: H }];

    if (this._orientation === "horizontal") {
      // Up to 3 screens side by side horizontally
      if (n <= 3) {
        const cellW = (W - gap * (n - 1)) / n;
        return Array.from({ length: n }, (_, i) => ({
          x: i * (cellW + gap), y: 0, w: cellW, h: H,
        }));
      }
      // 4 screens: 2x2 grid
      const cols = 2;
      const rows = Math.ceil(n / cols);
      const cellW = (W - gap * (cols - 1)) / cols;
      const cellH = (H - gap * (rows - 1)) / rows;
      return Array.from({ length: n }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { x: col * (cellW + gap), y: row * (cellH + gap), w: cellW, h: cellH };
      });
    }

    // Vertical: stack top to bottom
    if (n <= 3) {
      const cellH = (H - gap * (n - 1)) / n;
      return Array.from({ length: n }, (_, i) => ({
        x: 0, y: i * (cellH + gap), w: W, h: cellH,
      }));
    }
    const cols = 2;
    const rows = Math.ceil(n / cols);
    const cellW = (W - gap * (cols - 1)) / cols;
    const cellH = (H - gap * (rows - 1)) / rows;
    return Array.from({ length: n }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { x: col * (cellW + gap), y: row * (cellH + gap), w: cellW, h: cellH };
    });
  }

  /** Focus layout: focusIndex gets ~70% of the main axis, others share the rest. */
  private computeFocusLayout(
    n: number, W: number, H: number, gap: number
  ): { x: number; y: number; w: number; h: number }[] {
    const focusRatio = 0.7;
    const sideCount = n - 1;

    if (this._orientation === "horizontal") {
      const mainW = Math.floor(W * focusRatio) - gap;
      const sideW = W - mainW - gap;
      const sideH = sideCount > 0 ? (H - gap * (sideCount - 1)) / sideCount : H;
      const ordered: { x: number; y: number; w: number; h: number }[] = [];
      let sideIdx = 0;
      for (let i = 0; i < n; i++) {
        if (i === this._focusIndex) {
          ordered.push({ x: 0, y: 0, w: mainW, h: H });
        } else {
          ordered.push({ x: mainW + gap, y: sideIdx * (sideH + gap), w: sideW, h: sideH });
          sideIdx++;
        }
      }
      return ordered;
    }

    const mainH = Math.floor(H * focusRatio) - gap;
    const sideH = H - mainH - gap;
    const sideW = sideCount > 0 ? (W - gap * (sideCount - 1)) / sideCount : W;
    const ordered: { x: number; y: number; w: number; h: number }[] = [];
    let sideIdx = 0;
    for (let i = 0; i < n; i++) {
      if (i === this._focusIndex) {
        ordered.push({ x: 0, y: 0, w: W, h: mainH });
      } else {
        ordered.push({ x: sideIdx * (sideW + gap), y: mainH + gap, w: sideW, h: sideH });
        sideIdx++;
      }
    }
    return ordered;
  }

  /** Custom layout: distribute space proportionally by source weight along main axis. */
  private computeCustomLayout(
    n: number, W: number, H: number, gap: number
  ): { x: number; y: number; w: number; h: number }[] {
    const totalWeight = this.sources.reduce((sum, s) => sum + s.weight, 0);

    if (this._orientation === "horizontal") {
      const availableW = W - gap * (n - 1);
      let x = 0;
      return this.sources.slice(0, n).map((s) => {
        const w = (s.weight / totalWeight) * availableW;
        const cell = { x, y: 0, w, h: H };
        x += w + gap;
        return cell;
      });
    }

    const availableH = H - gap * (n - 1);
    let y = 0;
    return this.sources.slice(0, n).map((s) => {
      const h = (s.weight / totalWeight) * availableH;
      const cell = { x: 0, y, w: W, h };
      y += h + gap;
      return cell;
    });
  }

  /** Get normalized divider positions for custom layout (0-1 range). */
  getDividerPositions(): number[] {
    const n = this.sources.length;
    if (n < 2) return [];
    const totalWeight = this.sources.reduce((sum, s) => sum + s.weight, 0);
    const positions: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < n - 1; i++) {
      cumulative += this.sources[i].weight / totalWeight;
      positions.push(cumulative);
    }
    return positions;
  }

  /** Set divider position by index (0-1 range). Adjusts weights of adjacent sources. */
  setDividerPosition(dividerIndex: number, position: number): void {
    const n = this.sources.length;
    if (dividerIndex < 0 || dividerIndex >= n - 1) return;
    const totalWeight = this.sources.reduce((sum, s) => sum + s.weight, 0);
    
    // Clamp position
    const minPos = 0.1;
    const maxPos = 0.9;
    const clampedPos = Math.max(minPos, Math.min(maxPos, position));
    
    // Calculate cumulative weight before this divider
    let prevCumulative = 0;
    for (let i = 0; i < dividerIndex; i++) {
      prevCumulative += this.sources[i].weight / totalWeight;
    }
    
    // Next divider position (or 1.0 for last)
    let nextCumulative = 1;
    for (let i = dividerIndex + 2; i < n; i++) {
      nextCumulative -= this.sources[i].weight / totalWeight;
    }
    
    const finalPos = Math.max(prevCumulative + 0.05, Math.min(nextCumulative - 0.05, clampedPos));
    
    // Set weights for the two sources around this divider
    this.sources[dividerIndex].weight = (finalPos - prevCumulative) * totalWeight;
    this.sources[dividerIndex + 1].weight = (nextCumulative - finalPos) * totalWeight;
    
    this.notifyChange();
  }

  private fitInto(
    srcW: number, srcH: number,
    bx: number, by: number, bw: number, bh: number
  ): { dx: number; dy: number; dw: number; dh: number } {
    const srcAspect = srcW / srcH;
    const boxAspect = bw / bh;
    let dw: number, dh: number;
    if (srcAspect > boxAspect) {
      dw = bw;
      dh = bw / srcAspect;
    } else {
      dh = bh;
      dw = bh * srcAspect;
    }
    return { dx: bx + (bw - dw) / 2, dy: by + (bh - dh) / 2, dw, dh };
  }
}
