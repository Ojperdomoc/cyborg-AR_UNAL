import { sfx, vibrate } from "./audio";
import { AMBER, CYAN, ROSE, clamp } from "./render";
import type { Cursor } from "./types";

export type TargetKind = "core" | "virus" | "star";

export type Target = {
  id: number;
  kind: TargetKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  born: number;
  life: number;
  charge: number;
  need: number;
  spin: number;
  armed: number;
  hint: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number };
type FloatText = { x: number; y: number; life: number; text: string; c: string };
type Ring = { x: number; y: number; r: number; max: number; life: number; c: string };

export type GameEvent =
  | { type: "capture"; kind: TargetKind; points: number; combo: number }
  | { type: "penalty"; points: number }
  | { type: "miss" };

export type GameStats = {
  score: number;
  combo: number;
  captures: number;
  misses: number;
  timeLeft: number;
  level: number;
  targets: number;
  over: boolean;
};

const BEST_KEY = "cyberflex.best";

export class Game {
  targets: Target[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  rings: Ring[] = [];

  score = 0;
  combo = 1;
  captures = 0;
  misses = 0;
  elapsed = 0;
  timeLeft = 0;
  roundSeconds = 60;
  running = false;
  over = false;
  best = 0;
  shake = 0;
  flash = 0;
  flashColor = CYAN;

  private spawnTimer = 0.6;
  private seq = 1;
  private onEvent: (e: GameEvent) => void;

  constructor(onEvent: (e: GameEvent) => void) {
    this.onEvent = onEvent;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch {
      this.best = 0;
    }
  }

  get level() {
    return 1 + Math.floor(this.elapsed / 14);
  }

  start(roundSeconds = 60) {
    this.reset();
    this.roundSeconds = roundSeconds;
    this.timeLeft = roundSeconds;
    this.running = true;
    this.over = false;
  }

  stop() {
    this.running = false;
  }

  reset() {
    this.targets = [];
    this.particles = [];
    this.floats = [];
    this.rings = [];
    this.score = 0;
    this.combo = 1;
    this.captures = 0;
    this.misses = 0;
    this.elapsed = 0;
    this.spawnTimer = 0.5;
    this.shake = 0;
    this.flash = 0;
    this.over = false;
  }

  stats(): GameStats {
    return {
      score: this.score,
      combo: this.combo,
      captures: this.captures,
      misses: this.misses,
      timeLeft: this.timeLeft,
      level: this.level,
      targets: this.targets.length,
      over: this.over,
    };
  }

  update(dt: number, cursors: Cursor[], w: number, h: number) {
    dt = Math.min(dt, 0.05);
    if (this.running && !this.over) {
      this.elapsed += dt;
      if (this.roundSeconds > 0) {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (this.timeLeft <= 0) {
          this.over = true;
          this.running = false;
          if (this.score > this.best) {
            this.best = this.score;
            try {
              localStorage.setItem(BEST_KEY, String(this.best));
            } catch {
              /* noop */
            }
          }
          sfx("over");
        }
      }
    }

    // aparición de objetivos
    if (this.running && !this.over) {
      this.spawnTimer -= dt;
      const cap = clamp(2 + Math.floor(this.elapsed / 12), 2, 5);
      if (this.spawnTimer <= 0 && this.targets.length < cap) {
        this.spawn(w, h);
        this.spawnTimer = Math.max(0.5, 1.25 - this.level * 0.07);
      }
    }

    const now = performance.now();

    // movimiento
    for (const t of this.targets) {
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      const m = t.r + 8;
      if (t.x < m) {
        t.x = m;
        t.vx *= -1;
      }
      if (t.x > w - m) {
        t.x = w - m;
        t.vx *= -1;
      }
      if (t.y < m) {
        t.y = m;
        t.vy *= -1;
      }
      if (t.y > h - m) {
        t.y = h - m;
        t.vy *= -1;
      }
      t.spin += dt * (t.kind === "virus" ? 1.8 : 0.9);
      t.charge = Math.max(0, t.charge - dt * 0.7);
      t.hint = Math.max(0, t.hint - dt);
    }

    // interacción con cursores (manos del jugador)
    for (const t of this.targets) {
      const age = (now - t.born) / 1000;
      if (age < 0.35) continue; // materializándose
      for (const c of cursors) {
        const d = Math.hypot(c.x - t.x, c.y - t.y);
        if (d > t.r + c.r) continue;

        if (t.kind === "virus") {
          this.hitVirus(t);
          break;
        }
        if (!c.pinching) {
          t.hint = 0.3;
          continue;
        }
        t.charge += dt * 2.2;
        if (t.charge >= 1) {
          this.capture(t);
          break;
        }
      }
    }

    // expiración
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (now - t.born > t.life * 1000) {
        this.targets.splice(i, 1);
        if (t.kind !== "virus" && this.running) {
          this.misses++;
          if (this.combo > 1) this.combo = 1;
          this.onEvent({ type: "miss" });
          sfx("miss");
        }
      }
    }

    // partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 + 180 * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 9);
      if (r.life <= 0) this.rings.splice(i, 1);
    }

    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  private spawn(w: number, h: number) {
    const level = this.level;
    const roll = Math.random();
    const virusChance = clamp(0.12 + level * 0.05, 0.12, 0.42);
    const starChance = 0.12;
    const kind: TargetKind = roll < virusChance ? "virus" : roll < virusChance + starChance ? "star" : "core";
    const r = kind === "star" ? 26 : kind === "virus" ? 30 : 34;

    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 24; tries++) {
      x = w * (0.12 + Math.random() * 0.76);
      y = h * (0.16 + Math.random() * 0.68);
      const okPos = this.targets.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r + 46);
      if (okPos) break;
    }

    const speed = 26 + level * 9;
    const ang = Math.random() * Math.PI * 2;
    this.targets.push({
      id: this.seq++,
      kind,
      x,
      y,
      vx: Math.cos(ang) * speed * (0.5 + Math.random()),
      vy: Math.sin(ang) * speed * (0.5 + Math.random()) * 0.7,
      r,
      born: performance.now(),
      life: kind === "star" ? 3.4 : kind === "virus" ? 7 : 6.5,
      charge: 0,
      need: 1,
      spin: Math.random() * 6,
      armed: 0.35,
      hint: 0,
    });
  }

  private burst(x: number, y: number, color: string, n = 22, power = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.25 + Math.random() * 0.9);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.45 + Math.random() * 0.5,
        max: 0.95,
        c: color,
        s: 1.6 + Math.random() * 2.8,
      });
    }
    this.rings.push({ x, y, r: 10, max: 110, life: 0.5, c: color });
  }

  private capture(t: Target) {
    this.targets = this.targets.filter((q) => q.id !== t.id);
    const isStar = t.kind === "star";
    const points = Math.round((isStar ? 30 : 10) * this.combo);
    this.score += points;
    this.captures++;
    this.combo = Math.min(9, this.combo + 1);
    this.flash = 0.5;
    this.flashColor = isStar ? AMBER : CYAN;
    this.burst(t.x, t.y, isStar ? AMBER : CYAN, isStar ? 34 : 22, isStar ? 340 : 250);
    this.floats.push({ x: t.x, y: t.y - 26, life: 1, text: `+${points}${this.combo > 2 ? ` x${this.combo - 1}` : ""}`, c: isStar ? AMBER : "#e0feff" });
    sfx(isStar ? "star" : "capture");
    vibrate(isStar ? [18, 40, 24] : 22);
    this.onEvent({ type: "capture", kind: t.kind, points, combo: this.combo });
  }

  private hitVirus(t: Target) {
    this.targets = this.targets.filter((q) => q.id !== t.id);
    const pen = 25;
    this.score = Math.max(0, this.score - pen);
    this.combo = 1;
    this.shake = 1;
    this.flash = 0.6;
    this.flashColor = ROSE;
    this.burst(t.x, t.y, ROSE, 30, 320);
    this.floats.push({ x: t.x, y: t.y - 26, life: 1, text: `-${pen} VIRUS`, c: ROSE });
    sfx("penalty");
    vibrate([60, 30, 60]);
    this.onEvent({ type: "penalty", points: -pen });
  }

  /** Toque de respaldo (mouse/dedo sin tracking) */
  tap(x: number, y: number) {
    for (const t of [...this.targets]) {
      if (Math.hypot(t.x - x, t.y - y) > t.r + 18) continue;
      if (t.kind === "virus") this.hitVirus(t);
      else this.capture(t);
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, _time: number, w = ctx.canvas.width, h = ctx.canvas.height) {
    ctx.save();

    // anillos de onda
    for (const r of this.rings) {
      ctx.save();
      ctx.globalAlpha = clamp(r.life * 1.6, 0, 1) * 0.7;
      ctx.strokeStyle = r.c;
      ctx.lineWidth = 3;
      ctx.shadowColor = r.c;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // objetivos
    for (const t of this.targets) {
      const age = (performance.now() - t.born) / 1000;
      const left = t.life - age;
      const fading = left < 1.4 ? 0.35 + 0.65 * Math.abs(Math.sin(left * 9)) : 1;
      const pop = clamp(age / 0.35, 0, 1);
      const rr = t.r * (0.6 + 0.4 * (1 - Math.pow(1 - pop, 3)));

      ctx.save();
      ctx.globalAlpha = fading;
      ctx.translate(t.x, t.y);

      if (t.kind === "core") {
        ctx.rotate(t.spin);
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 2.6;
        poly(ctx, 6, rr, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
        const g = ctx.createRadialGradient(0, -rr * 0.2, rr * 0.1, 0, 0, rr * 0.75);
        g.addColorStop(0, "#eafcff");
        g.addColorStop(0.4, CYAN);
        g.addColorStop(1, "rgba(8,145,178,0.15)");
        ctx.fillStyle = g;
        poly(ctx, 6, rr * 0.72, 0.2);
        ctx.fill();
        ctx.rotate(-t.spin);
      } else if (t.kind === "star") {
        ctx.rotate(t.spin * 1.4);
        ctx.shadowColor = AMBER;
        ctx.shadowBlur = 30;
        ctx.fillStyle = AMBER;
        poly(ctx, 4, rr * 1.1, 0);
        ctx.fill();
        ctx.fillStyle = "#fffbeb";
        poly(ctx, 4, rr * 0.45, 0.4);
        ctx.fill();
        ctx.rotate(-t.spin * 1.4);
      } else {
        // virus glitcheado
        for (let k = 0; k < 3; k++) {
          ctx.save();
          ctx.globalAlpha = (0.35 - k * 0.1) * fading;
          ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
          ctx.rotate(t.spin * (k === 0 ? 1 : -0.6));
          ctx.strokeStyle = k === 0 ? ROSE : "#7f1d1d";
          ctx.lineWidth = 3;
          poly(ctx, 7, rr, 0.25);
          ctx.stroke();
          ctx.restore();
        }
        ctx.shadowColor = ROSE;
        ctx.shadowBlur = 18;
        ctx.fillStyle = "rgba(24,8,12,0.9)";
        poly(ctx, 7, rr * 0.8, 0.25);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = ROSE;
        ctx.font = "700 18px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 1);
      }

      // anillo de carga
      if (t.kind !== "virus" && t.charge > 0.01) {
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = t.kind === "star" ? AMBER : "#a5f3fc";
        ctx.lineWidth = 4;
        ctx.shadowColor = ctx.strokeStyle as string;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, rr + 8, 0, Math.PI * 2 * clamp(t.charge, 0, 1));
        ctx.stroke();
        ctx.restore();
      }
      // anillo de vida
      ctx.save();
      ctx.globalAlpha = 0.35 * fading;
      ctx.rotate(-Math.PI / 2);
      ctx.strokeStyle = t.kind === "virus" ? ROSE : t.kind === "star" ? AMBER : CYAN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, rr + 13, 0, Math.PI * 2 * clamp(left / t.life, 0, 1));
      ctx.stroke();
      ctx.restore();

      // pista: usa la pinza
      if (t.hint > 0 && t.kind !== "virus") {
        ctx.globalAlpha = clamp(t.hint * 3, 0, 1);
        ctx.fillStyle = "#e0feff";
        ctx.font = "600 10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("PINZA ✋🤏", 0, -rr - 20);
      }
      ctx.restore();
    }

    // partículas
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c;
      ctx.shadowBlur = 10;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s * 2);
      ctx.restore();
    }

    // textos flotantes
    for (const f of this.floats) {
      ctx.save();
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = f.c;
      ctx.font = "800 20px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(4,10,18,0.9)";
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // destello
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.28;
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, this.flashColor);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.restore();
  }
}

function poly(ctx: CanvasRenderingContext2D, sides: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
