import { Game, type GameStats } from "./game";
import { sfx, unlockAudio } from "./audio";
import { drawHand, drawPartBrackets, drawPose, drawSceneFx, handMetrics } from "./render";
import { createDetectors, loadVisionModule, type Detectors } from "./vision";
import type { ArFrame, BodyPart, Cursor, Facing, HandFrame, Pt, TrackMode, View } from "./types";

export type EngineState = {
  status: "idle" | "loading" | "running" | "error";
  message: string;
  fps: number;
  inferMs: number;
  hasPose: boolean;
  handCount: number;
  parts: BodyPart[];
};

type Options = {
  onState: (s: EngineState) => void;
  onStats: (s: GameStats) => void;
  onGameOver: (s: GameStats) => void;
};

const PART_DEFS: { id: string; label: string; idx: number[] }[] = [
  { id: "head", label: "Cabeza", idx: [0, 7, 8] },
  { id: "torso", label: "Torso", idx: [11, 12, 23, 24] },
  { id: "armL", label: "Brazo Izq.", idx: [11, 13, 15] },
  { id: "armR", label: "Brazo Der.", idx: [12, 14, 16] },
  { id: "legL", label: "Pierna Izq.", idx: [23, 25, 27] },
  { id: "legR", label: "Pierna Der.", idx: [24, 26, 28] },
];

export class ArEngine {
  private canvas: HTMLCanvasElement;
  private video: HTMLVideoElement;
  private opts: Options;
  private ctx: CanvasRenderingContext2D;

  private stream: MediaStream | null = null;
  private detectors: Detectors | null = null;
  private raf = 0;
  private running = false;
  private lastVideoTime = -1;
  private lastTs = 0;
  private frame: ArFrame | null = null;
  private view: View | null = null;

  facing: Facing = "user";
  mode: TrackMode = "full";
  skin = true;
  showHud = true;

  private lastT = 0;
  private fps = 0;
  private fpsAcc = 0;
  private fpsCount = 0;
  private inferMs = 0;
  private statTimer = 0;
  private alternate = false;
  private toggle = false;
  private lastPoseTs = -9999;
  private lastHandTs = -9999;

  private pointer: { x: number; y: number; down: boolean } | null = null;

  game: Game;

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement, opts: Options) {
    this.canvas = canvas;
    this.video = video;
    this.opts = opts;
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("Canvas 2D no disponible");
    this.ctx = c;
    this.game = new Game(() => {
      this.opts.onStats(this.game.stats());
    });
    this.bindPointer();
  }

  /* ---------------- entrada táctil de respaldo ---------------- */
  private bindPointer() {
    const el = this.canvas;
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    el.addEventListener("pointerdown", (e) => {
      unlockAudio();
      const p = pos(e);
      this.pointer = { ...p, down: true };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      const p = pos(e);
      if (this.pointer) this.pointer = { ...p, down: this.pointer.down };
      else this.pointer = { ...p, down: false };
    });
    const up = () => {
      if (this.pointer) this.pointer = { ...this.pointer, down: false };
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", () => {
      this.pointer = null;
    });
  }

  /* ---------------- cámara ---------------- */
  async startCamera(facing: Facing) {
    this.facing = facing;
    this.stopStream();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no expone la cámara (requiere HTTPS).");

    const tryGet = (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints);
    let stream: MediaStream;
    const base = { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30, max: 30 } };
    try {
      stream = await tryGet({ video: { facingMode: { exact: facing }, ...base }, audio: false });
    } catch {
      try {
        stream = await tryGet({ video: { facingMode: facing, ...base }, audio: false });
      } catch {
        stream = await tryGet({ video: true, audio: false });
      }
    }
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await new Promise<void>((resolve) => {
      if (this.video.readyState >= 2) return resolve();
      this.video.onloadeddata = () => resolve();
    });
    await this.video.play().catch(() => undefined);
    this.lastVideoTime = -1;
  }

  private stopStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  async switchCamera(facing: Facing) {
    this.frame = null;
    await this.startCamera(facing);
  }

  /** Cambia el conjunto de redes neuronales en caliente (cuerpo / manos / ambos) */
  async setMode(mode: TrackMode) {
    this.mode = mode;
    this.detectors?.pose?.close();
    this.detectors?.hand?.close();
    this.detectors = null;
    this.frame = null;
    this.detectors = await createDetectors(mode);
  }

  /* ---------------- ciclo de vida ---------------- */
  async boot(mode: TrackMode, facing: Facing) {
    this.opts.onState({ ...this.state(), status: "loading", message: "Descargando red neuronal…" });
    await loadVisionModule();
    this.mode = mode;
    this.detectors?.pose?.close();
    this.detectors?.hand?.close();
    this.detectors = await createDetectors(mode);
    this.opts.onState({ ...this.state(), status: "loading", message: "Activando cámara…" });
    await this.startCamera(facing);
    this.running = true;
    this.lastT = performance.now();
    this.opts.onState({ ...this.state(), status: "running", message: "Escaneando cuerpo…" });
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    this.pause();
    this.stopStream();
    this.detectors?.pose?.close();
    this.detectors?.hand?.close();
    this.detectors = null;
  }

  state(): EngineState {
    return {
      status: "idle",
      message: "",
      fps: Math.round(this.fps),
      inferMs: Math.round(this.inferMs),
      hasPose: !!this.frame?.pose,
      handCount: this.frame?.hands.length ?? 0,
      parts: this.computeParts(),
    };
  }

  private computeParts(): BodyPart[] {
    const out: BodyPart[] = [];
    const f = this.frame;
    if (f?.pose) {
      for (const def of PART_DEFS) {
        const vis = def.idx.reduce((a, i) => a + (f.pose!.points[i]?.visibility ?? 0), 0) / def.idx.length;
        out.push({ id: def.id, label: def.label, state: vis > 0.6 ? "ok" : vis > 0.3 ? "scanning" : "locked" });
      }
    }
    f?.hands.forEach((h, i) =>
      out.push({ id: `hand${i}`, label: `Mano ${h.label === "Left" ? "I" : "D"} · 21 pts`, state: "ok" }),
    );
    return out;
  }

  /* ---------------- bucle principal ---------------- */
  private tick = async (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.06, (now - this.lastT) / 1000 || 0.016);
    this.lastT = now;

    // FPS
    this.fpsAcc += dt;
    this.fpsCount++;
    if (this.fpsAcc > 0.5) {
      this.fps = this.fpsCount / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsCount = 0;
    }

    const video = this.video;
    if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime && this.detectors) {
      this.lastVideoTime = video.currentTime;
      await this.detect(video, now);
    }

    this.render(now / 1000, dt);

    this.statTimer += dt;
    if (this.statTimer > 0.2) {
      this.statTimer = 0;
      this.opts.onStats(this.game.stats());
      this.opts.onState(this.state());
    }

    if (this.game.over) {
      this.game.over = false; // se notifica una sola vez
      this.opts.onGameOver(this.game.stats());
    }
  };

  private async detect(video: HTMLVideoElement, now: number) {
    const d = this.detectors;
    if (!d) return;
    let ts = Math.max(this.lastTs + 1, Math.round(now));
    this.lastTs = ts;

    const t0 = performance.now();
    let posePts: Pt[] | null = null;
    let hands: HandFrame[] = [];

    const doPose = async () => {
      if (!d.pose) return;
      const r = d.pose.detectForVideo(video, ts);
      const lm = r.landmarks?.[0];
      if (lm) posePts = lm.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 }));
    };
    const doHands = async () => {
      if (!d.hand) return;
      const r = d.hand.detectForVideo(video, ts);
      if (r.landmarks?.length) {
        hands = r.landmarks.map((lm, i) => ({
          points: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
          label: (r.handedness?.[i]?.[0]?.categoryName as "Left" | "Right") ?? "Right",
          score: r.handedness?.[i]?.[0]?.score ?? 1,
        }));
      }
    };

    try {
      if (this.mode === "pose") await doPose();
      else if (this.mode === "hands") await doHands();
      else if (this.alternate) {
        // presupuesto bajo: alternamos para mantener FPS
        this.toggle = !this.toggle;
        ts = Math.max(this.lastTs + 1, Math.round(performance.now()));
        this.lastTs = ts;
        if (this.toggle) await doPose();
        else await doHands();
      } else {
        await doPose();
        ts = Math.max(this.lastTs + 1, Math.round(performance.now()));
        this.lastTs = ts;
        await doHands();
      }
    } catch {
      /* ignora frames fallidos */
    }

    this.inferMs = this.inferMs * 0.85 + (performance.now() - t0) * 0.15;
    if (this.inferMs > 42) this.alternate = true;

    // Solo se "robotiza" lo que la cámara está viendo ahora mismo:
    // si una parte deja de detectarse ~0.6 s, deja de dibujarse.
    if (posePts) this.lastPoseTs = now;
    if (hands.length) this.lastHandTs = now;
    const keepPose = posePts ? { points: posePts } : now - this.lastPoseTs < 600 ? this.frame?.pose ?? null : null;
    const keepHands = hands.length ? hands : now - this.lastHandTs < 600 ? this.frame?.hands ?? [] : [];
    this.frame = { ts: now, pose: keepPose, hands: keepHands };
  }

  /* ---------------- render ---------------- */
  private computeView(vw: number, vh: number): View {
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    const mirrored = this.facing === "user";
    return {
      w: cw,
      h: ch,
      mirrored,
      map: (p: Pt) => ({
        x: (mirrored ? 1 - p.x : p.x) * dw + ox,
        y: p.y * dh + oy,
      }),
    };
  }

  private drawVideo(vw: number, vh: number) {
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    ctx.save();
    if (this.facing === "user") {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.video, cw - ox - dw, oy, dw, dh);
    } else {
      ctx.drawImage(this.video, ox, oy, dw, dh);
    }
    ctx.restore();

    // tinte cyberpunk sutil
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(46,80,124,0.3)";
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  private cursors(): Cursor[] {
    const out: Cursor[] = [];
    if (this.frame?.hands.length && this.view) {
      this.frame.hands.forEach((h, i) => {
        const m = handMetrics(h, this.view!);
        out.push({
          id: i + 1,
          x: m.pinchPoint.x,
          y: m.pinchPoint.y,
          r: Math.max(16, Math.min(64, m.scale * 0.32)),
          pinching: m.pinch < 0.38,
          hand: i,
          gesture: m.gesture,
        });
      });
    }
    if (!out.length && this.pointer) {
      out.push({
        id: 99,
        x: this.pointer.x,
        y: this.pointer.y,
        r: 26,
        pinching: this.pointer.down,
        hand: -1,
        gesture: this.pointer.down ? "TÁCTIL" : "PUNTERO",
      });
    }
    return out;
  }

  private render(time: number, dt: number) {
    const ctx = this.ctx;
    const video = this.video;
    const vw = video.videoWidth || 960;
    const vh = video.videoHeight || 540;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;

    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, cw, ch);
    if (video.readyState >= 2) this.drawVideo(vw, vh);

    this.view = this.computeView(vw, vh);
    const frame = this.frame;
    const skinOpts = { intensity: 1, showHud: this.showHud, time };

    drawSceneFx(ctx, cw, ch, time, this.skin);

    // capa robótica (con shake al recibir daño)
    ctx.save();
    if (this.game.shake > 0.01) {
      const s = this.game.shake * 12;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    if (frame && this.skin) {
      drawPose(ctx, frame, this.view, time, skinOpts);
      frame.hands.forEach((h) => drawHand(ctx, h, this.view!, time, skinOpts));
      if (this.showHud) drawPartBrackets(ctx, frame, this.view);
    }
    ctx.restore();

    // cursores
    const cursors = this.cursors();
    for (const c of cursors) {
      ctx.save();
      ctx.strokeStyle = c.pinching ? "#fbbf24" : "rgba(103,232,249,0.85)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, time * 1.5, time * 1.5 + Math.PI * 1.7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(4,10,18,0.5)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.pinching ? "#fbbf24" : "#a5f3fc";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (this.showHud) {
        ctx.font = "600 10px ui-monospace, monospace";
        ctx.fillStyle = "rgba(224,254,255,0.85)";
        ctx.fillText(c.gesture, c.x + c.r + 6, c.y + 4);
      }
      ctx.restore();
    }

    // juego
    this.game.update(dt, cursors, cw, ch);
    this.game.render(ctx, time, cw, ch);

    // aviso de "sin objetivo"
    if (!frame && this.skin && this.showHud) {
      ctx.save();
      ctx.font = "700 13px ui-monospace, monospace";
      ctx.fillStyle = "rgba(224,254,255,0.75)";
      ctx.textAlign = "center";
      const msg = this.mode === "hands" ? "MUESTRA TUS MANOS ANTE LA CÁMARA" : "POSICIÓNATE ANTE LA CÁMARA";
      ctx.fillText(msg, cw / 2, ch - 96);
      ctx.restore();
    }
  }
}

export function playBlip() {
  sfx("blip");
}
