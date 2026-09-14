import type { ArFrame, HandFrame, View } from "./types";

type Ctx = CanvasRenderingContext2D;
type V = { x: number; y: number };

export const CYAN = "#22d3ee";
export const AMBER = "#fbbf24";
export const ROSE = "#fb7185";
export const LIME = "#a3e635";

const STEEL_STOPS: [number, string][] = [
  [0, "#f8fafc"],
  [0.16, "#cbd5e1"],
  [0.42, "#94a3b8"],
  [0.6, "#5b6879"],
  [0.78, "#a8b3c2"],
  [1, "#39424f"],
];

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist = (a: V, b: V) => Math.hypot(b.x - a.x, b.y - a.y);

function mid(a: V, b: V): V {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Gradiente "cromado" perpendicular al segmento, da volumen cilíndrico metálico */
function chrome(ctx: Ctx, a: V, b: V, w: number): CanvasGradient {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const g = ctx.createLinearGradient(a.x + nx, a.y + ny, a.x - nx, a.y - ny);
  for (const [p, c] of STEEL_STOPS) g.addColorStop(p, c);
  return g;
}

/** Segmento de extremidad robótica: carcasa cromada + núcleo de energía + tornillos */
export function drawLimb(ctx: Ctx, a: V, b: V, wa: number, wb: number, accent = CYAN, alpha = 1, simple = false) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const A1 = { x: a.x + nx * wa, y: a.y + ny * wa };
  const A2 = { x: a.x - nx * wa, y: a.y - ny * wa };
  const B1 = { x: b.x + nx * wb, y: b.y + ny * wb };
  const B2 = { x: b.x - nx * wb, y: b.y - ny * wb };

  ctx.save();
  ctx.globalAlpha = alpha;

  // halo externo oscuro (separa el robot del fondo real)
  ctx.strokeStyle = "rgba(4,10,18,0.5)";
  ctx.lineWidth = Math.max(wa, wb) * 2 + 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // carcasa
  ctx.beginPath();
  ctx.moveTo(A1.x, A1.y);
  ctx.lineTo(B1.x, B1.y);
  ctx.quadraticCurveTo(b.x + ux * wb * 1.7, b.y + uy * wb * 1.7, B2.x, B2.y);
  ctx.lineTo(A2.x, A2.y);
  ctx.quadraticCurveTo(a.x - ux * wa * 1.7, a.y - uy * wa * 1.7, A1.x, A1.y);
  ctx.closePath();
  ctx.fillStyle = chrome(ctx, a, b, wa);
  ctx.fill();
  ctx.strokeStyle = "rgba(8,15,26,0.85)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // panel interior oscuro
  ctx.save();
  if (simple) {
    ctx.restore();
    // brillo especular + núcleo (versión ligera para dedos)
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = Math.max(1, wa * 0.18);
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wa * 0.5, a.y + ny * wa * 0.5);
    ctx.lineTo(b.x + nx * wb * 0.5, b.y + ny * wb * 0.5);
    ctx.stroke();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.2, wa * 0.2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.clip();
  const inner = ctx.createLinearGradient(a.x + nx * wa * 0.55, a.y + ny * wa * 0.55, a.x - nx * wa * 0.55, a.y - ny * wa * 0.55);
  inner.addColorStop(0, "rgba(15,23,42,0.0)");
  inner.addColorStop(0.5, "rgba(15,23,42,0.55)");
  inner.addColorStop(1, "rgba(15,23,42,0.0)");
  ctx.fillStyle = inner;
  ctx.fillRect(Math.min(A1.x, B1.x, A2.x, B2.x) - 4, Math.min(A1.y, B1.y, A2.y, B2.y) - 4, Math.abs(dx) + Math.abs(nx * wa) * 2 + 8, Math.abs(dy) + Math.abs(ny * wa) * 2 + 8);

  // anillos de servo
  const rings = Math.max(1, Math.round(len / Math.max(18, wa * 1.5)));
  ctx.strokeStyle = "rgba(9,16,28,0.55)";
  ctx.lineWidth = 2;
  for (let i = 1; i <= rings; i++) {
    const t = i / (rings + 1);
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const w = lerp(wa, wb, t);
    ctx.beginPath();
    ctx.moveTo(px + nx * w * 0.94, py + ny * w * 0.94);
    ctx.lineTo(px - nx * w * 0.94, py - ny * w * 0.94);
    ctx.stroke();
  }
  ctx.restore();

  // brillo especular
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = Math.max(1.2, wa * 0.16);
  ctx.beginPath();
  ctx.moveTo(a.x + nx * wa * 0.55, a.y + ny * wa * 0.55);
  ctx.lineTo(b.x + nx * wb * 0.55, b.y + ny * wb * 0.55);
  ctx.stroke();

  // núcleo de energía
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1.6, wa * 0.18);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

/** Articulación esférica cromada con anillo energizado */
export function drawJoint(ctx: Ctx, p: V, r: number, accent = CYAN, pulse = 0) {
  if (r <= 0.4) return;
  ctx.save();
  const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.08, p.x, p.y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#cbd5e1");
  g.addColorStop(0.75, "#64748b");
  g.addColorStop(1, "#2b3442");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(8,15,26,0.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.shadowColor = accent;
  ctx.shadowBlur = 12 + pulse * 10;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.75 + pulse * 0.25;
  ctx.lineWidth = Math.max(1.2, r * 0.22);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#eafcff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(1, r * 0.16), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function glowDot(ctx: Ctx, p: V, r: number, color: string, blur = 16) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function polyPath(ctx: Ctx, pts: V[], close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (close) ctx.closePath();
}

export const POSE = {
  nose: 0,
  eyeL: 2,
  eyeR: 5,
  earL: 7,
  earR: 8,
  shoulderL: 11,
  shoulderR: 12,
  elbowL: 13,
  elbowR: 14,
  wristL: 15,
  wristR: 16,
  pinkyL: 17,
  pinkyR: 18,
  indexL: 19,
  indexR: 20,
  thumbL: 21,
  thumbR: 22,
  hipL: 23,
  hipR: 24,
  kneeL: 25,
  kneeR: 26,
  ankleL: 27,
  ankleR: 28,
  heelL: 29,
  heelR: 30,
  footL: 31,
  footR: 32,
} as const;

const LIMBS: [number, number, number, number][] = [
  // [a, b, grosorRelativoA, grosorRelativoB]
  [POSE.shoulderL, POSE.elbowL, 0.2, 0.16],
  [POSE.elbowL, POSE.wristL, 0.16, 0.12],
  [POSE.shoulderR, POSE.elbowR, 0.2, 0.16],
  [POSE.elbowR, POSE.wristR, 0.16, 0.12],
  [POSE.shoulderL, POSE.hipL, 0.24, 0.2],
  [POSE.shoulderR, POSE.hipR, 0.24, 0.2],
  [POSE.hipL, POSE.kneeL, 0.24, 0.18],
  [POSE.kneeL, POSE.ankleL, 0.18, 0.13],
  [POSE.hipR, POSE.kneeR, 0.24, 0.18],
  [POSE.kneeR, POSE.ankleR, 0.18, 0.13],
  [POSE.shoulderL, POSE.shoulderR, 0.2, 0.2],
  [POSE.hipL, POSE.hipR, 0.2, 0.2],
];

const JOINTS: [number, number][] = [
  [POSE.elbowL, 0.13],
  [POSE.elbowR, 0.13],
  [POSE.wristL, 0.12],
  [POSE.wristR, 0.12],
  [POSE.kneeL, 0.16],
  [POSE.kneeR, 0.16],
  [POSE.ankleL, 0.13],
  [POSE.ankleR, 0.13],
];

export type SkinOptions = {
  /** opacidad general del skin robótico */
  intensity: number;
  showHud: boolean;
  time: number;
};

/** ---------- MANOS ---------- */
export function handMetrics(hand: HandFrame, view: View) {
  const p = hand.points.map(view.map);
  const scale = Math.max(18, dist(p[0], p[9]));
  const pinch = dist(p[4], p[8]) / scale;
  const pinchPoint = mid(p[4], p[8]);
  const extended = [8, 12, 16, 20].filter((i, k) => dist(p[i], p[0]) > dist(p[5 + k * 4], p[0]) * 0.92).length;
  let gesture = "MANO";
  if (pinch < 0.38) gesture = "PINZA";
  else if (extended === 0) gesture = "PUÑO";
  else if (extended >= 4) gesture = "ABIERTA";
  else if (dist(p[8], p[0]) > dist(p[12], p[0]) && extended <= 2) gesture = "ÍNDICE";
  return { p, scale, pinch, pinchPoint, gesture, extended };
}

export function drawHand(ctx: Ctx, hand: HandFrame, view: View, time: number, opts: SkinOptions) {
  const m = handMetrics(hand, view);
  const { p, scale } = m;
  const s = scale;
  const alpha = opts.intensity;

  // antebrazo / muñeca: anillo de acople
  const dir = { x: p[0].x - p[9].x, y: p[0].y - p[9].y };
  const dl = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / dl;
  const uy = dir.y / dl;
  const cuff = { x: p[0].x + ux * s * 0.35, y: p[0].y + uy * s * 0.35 };
  drawLimb(ctx, p[0], cuff, s * 0.42, s * 0.3, CYAN, alpha);
  drawJoint(ctx, p[0], s * 0.3, CYAN, 0.5);

  // palma: placa blindada
  const palm = [p[0], p[1], p[5], p[9], p[13], p[17], p[0]];
  const cx = palm.reduce((a, q) => a + q.x, 0) / palm.length;
  const cy = palm.reduce((a, q) => a + q.y, 0) / palm.length;
  const inflated = palm.map((q) => ({ x: cx + (q.x - cx) * 1.12, y: cy + (q.y - cy) * 1.12 }));

  ctx.save();
  ctx.globalAlpha = alpha;
  polyPath(ctx, inflated.slice(0, 6));
  const g = ctx.createLinearGradient(cx, cy - s * 0.6, cx, cy + s * 0.6);
  g.addColorStop(0, "rgba(226,238,248,0.92)");
  g.addColorStop(0.5, "rgba(120,134,152,0.86)");
  g.addColorStop(1, "rgba(43,52,66,0.9)");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(4,10,18,0.6)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(9,16,28,0.9)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // circuito de la palma
  ctx.strokeStyle = "rgba(9,16,28,0.4)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 4; i++) {
    const a = inflated[0];
    const b = inflated[5];
    const q = { x: lerp(a.x, b.x, i / 4), y: lerp(a.y, b.y, i / 4) };
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(lerp(q.x, cx, 0.55), lerp(q.y, cy, 0.55));
    ctx.stroke();
  }
  ctx.restore();

  glowDot(ctx, { x: cx, y: cy }, s * 0.09, CYAN, 18);

  // dedos
  const fingers: number[][] = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  const widths = [0.19, 0.2, 0.19, 0.17, 0.15];
  fingers.forEach((f, fi) => {
    for (let i = 0; i < f.length - 1; i++) {
      const a = p[f[i]];
      const b = p[f[i + 1]];
      const w0 = s * widths[fi] * (1 - i * 0.16);
      const w1 = s * widths[fi] * (1 - (i + 1) * 0.16);
      drawLimb(ctx, a, b, Math.max(2, w0), Math.max(1.5, w1), CYAN, alpha, true);
      if (i > 0) drawJoint(ctx, a, s * 0.075, CYAN, 0);
    }
    // punta de dedo energizada
    glowDot(ctx, p[f[3]], Math.max(2.5, s * 0.075), fi === 1 ? AMBER : CYAN, 14);
  });
  drawJoint(ctx, p[1], s * 0.12, CYAN, 0);
  drawJoint(ctx, p[5], s * 0.12, CYAN, 0);
  drawJoint(ctx, p[17], s * 0.1, CYAN, 0);

  // indicador de pinza
  const pinching = m.pinch < 0.38;
  if (pinching) {
    const mid0 = m.pinchPoint;
    ctx.save();
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(mid0.x, mid0.y, s * 0.3 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const ang = time * 3 + (i * Math.PI) / 3;
      glowDot(ctx, { x: mid0.x + Math.cos(ang) * s * 0.42, y: mid0.y + Math.sin(ang) * s * 0.42 }, 2.2, AMBER, 10);
    }
  }

  if (opts.showHud) {
    label(ctx, `${hand.label === "Left" ? "MANO-I" : "MANO-D"} · ${m.gesture}`, mid(p[0], p[9]), s * 0.9, pinching ? AMBER : CYAN);
  }
}

/** ---------- CUERPO / POSE ---------- */
export function drawPose(ctx: Ctx, frame: ArFrame, view: View, time: number, opts: SkinOptions) {
  if (!frame.pose) return;
  const raw = frame.pose.points;
  const p = raw.map(view.map);
  const vis = (i: number) => (raw[i]?.visibility ?? 1) > 0.45;
  const alpha = opts.intensity;
  const shoulderW = Math.max(40, dist(p[POSE.shoulderL], p[POSE.shoulderR]));
  const k = shoulderW / 100; // factor de escala del cuerpo

  // ----- piernas y brazos (detrás del torso) -----
  for (const [a, b, wa, wb] of LIMBS) {
    if (!vis(a) || !vis(b)) continue;
    drawLimb(ctx, p[a], p[b], wa * k * 42, wb * k * 42, b >= POSE.hipL ? LIME : CYAN, alpha);
  }
  for (const [i, r] of JOINTS) {
    if (!vis(i)) continue;
    drawJoint(ctx, p[i], r * k * 42, i >= POSE.hipL ? LIME : CYAN, 0.3);
  }

  // pies / botas
  for (const side of ["L", "R"] as const) {
    const ankle = side === "L" ? POSE.ankleL : POSE.ankleR;
    const foot = side === "L" ? POSE.footL : POSE.footR;
    const heel = side === "L" ? POSE.heelL : POSE.heelR;
    if (!vis(ankle) || !vis(foot)) continue;
    drawLimb(ctx, p[ankle], p[heel], 0.13 * k * 42, 0.11 * k * 42, LIME, alpha);
    drawLimb(ctx, p[heel], p[foot], 0.11 * k * 42, 0.13 * k * 42, LIME, alpha);
    drawJoint(ctx, p[ankle], 0.12 * k * 42, LIME, 0.2);
  }

  // manos al final de los brazos (si hay pose, dibuja guante aunque no haya hand-tracking fino)
  drawTorso(ctx, p, k, time, opts, vis);

  // ----- cabeza / casco -----
  if (vis(POSE.earL) || vis(POSE.earR) || vis(POSE.nose)) {
    drawHead(ctx, p, k, time, opts, vis);
  }

  if (opts.showHud) {
    const parts: [string, V, boolean][] = [
      ["CABEZA", mid(p[POSE.earL], p[POSE.earR]), vis(POSE.nose)],
      ["TORSO", mid(p[POSE.shoulderL], p[POSE.hipR]), vis(POSE.shoulderL) && vis(POSE.hipR)],
      ["BRAZO-I", mid(p[POSE.elbowL], p[POSE.wristL]), vis(POSE.elbowL) && vis(POSE.wristL)],
      ["BRAZO-D", mid(p[POSE.elbowR], p[POSE.wristR]), vis(POSE.elbowR) && vis(POSE.wristR)],
      ["PIERNA-I", mid(p[POSE.kneeL], p[POSE.ankleL]), vis(POSE.kneeL) && vis(POSE.ankleL)],
      ["PIERNA-D", mid(p[POSE.kneeR], p[POSE.ankleR]), vis(POSE.kneeR) && vis(POSE.ankleR)],
    ];
    for (const [lbl, at, ok] of parts) {
      if (!ok) continue;
      tag(ctx, `◈ ${lbl}`, at, ok ? CYAN : "#64748b");
    }
  }
}

function drawTorso(ctx: Ctx, p: V[], k: number, time: number, opts: SkinOptions, vis: (i: number) => boolean) {
  const { shoulderL: sL, shoulderR: sR, hipL: hL, hipR: hR } = POSE;
  if (!vis(sL) || !vis(sR) || !vis(hL) || !vis(hR)) return;
  const up = { x: (p[sL].x + p[sR].x) / 2, y: (p[sL].y + p[sR].y) / 2 };
  const dn = { x: (p[hL].x + p[hR].x) / 2, y: (p[hL].y + p[hR].y) / 2 };
  const dx = dn.x - up.x;
  const dy = dn.y - up.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 0.13 * k * 42;
  const ny = (dx / len) * 0.13 * k * 42;

  const plate = [
    { x: p[sL].x - nx, y: p[sL].y - ny },
    { x: p[sR].x + nx, y: p[sR].y + ny },
    { x: p[hR].x + nx * 1.1, y: p[hR].y + ny * 1.1 },
    { x: dn.x + nx * 0.4, y: dn.y + ny * 0.4 },
    { x: dn.x - nx * 0.4, y: dn.y - ny * 0.4 },
    { x: p[hL].x - nx * 1.1, y: p[hL].y - ny * 1.1 },
  ];

  ctx.save();
  ctx.globalAlpha = opts.intensity;
  polyPath(ctx, plate);
  const g = ctx.createLinearGradient(up.x, up.y, dn.x, dn.y);
  g.addColorStop(0, "#e8eef6");
  g.addColorStop(0.35, "#9aa8ba");
  g.addColorStop(0.7, "#5c6a7c");
  g.addColorStop(1, "#313b49");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(4,10,18,0.65)";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(9,16,28,0.9)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // costillas / paneles
  ctx.clip();
  ctx.strokeStyle = "rgba(9,16,28,0.42)";
  ctx.lineWidth = 2;
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(lerp(p[sL].x, p[hL].x, t), lerp(p[sL].y, p[hL].y, t));
    ctx.lineTo(lerp(p[sR].x, p[hR].x, t), lerp(p[sR].y, p[hR].y, t));
    ctx.stroke();
  }
  // columna lumínica
  ctx.strokeStyle = CYAN;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(up.x, up.y);
  ctx.lineTo(dn.x, dn.y);
  ctx.stroke();
  ctx.restore();

  // reactor de pecho
  const core = { x: lerp(up.x, dn.x, 0.32), y: lerp(up.y, dn.y, 0.32) };
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  const r = k * 42 * 0.3;
  glowDot(ctx, core, r * (0.75 + pulse * 0.3), CYAN, 26 + pulse * 18);
  ctx.save();
  ctx.strokeStyle = "#e0feff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(core.x, core.y, r * 1.25, time * 1.5, time * 1.5 + Math.PI * 1.3);
  ctx.stroke();
  ctx.restore();
  drawJoint(ctx, core, r * 0.9, CYAN, pulse);
}

function drawHead(ctx: Ctx, p: V[], k: number, time: number, opts: SkinOptions, vis: (i: number) => boolean) {
  const nose = p[POSE.nose];
  const eL = p[POSE.earL];
  const eR = p[POSE.earR];
  const earDist = vis(POSE.earL) && vis(POSE.earR) ? dist(eL, eR) : k * 42 * 0.55;
  const center = vis(POSE.earL) && vis(POSE.earR) ? mid(eL, eR) : nose;
  const r = Math.max(k * 42 * 0.32, earDist * 0.78);

  ctx.save();
  ctx.globalAlpha = opts.intensity;
  // casco hexagonal
  const hex: V[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 3;
    hex.push({ x: center.x + Math.cos(ang) * r, y: center.y + Math.sin(ang) * r * 1.12 });
  }
  polyPath(ctx, hex);
  const g = ctx.createLinearGradient(center.x - r, center.y - r, center.x + r, center.y + r);
  g.addColorStop(0, "#f4f8fc");
  g.addColorStop(0.45, "#8f9dad");
  g.addColorStop(1, "#2c3542");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(4,10,18,0.6)";
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(9,16,28,0.9)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // visor
  ctx.save();
  polyPath(ctx, hex);
  ctx.clip();
  const vw = r * 1.35;
  const vh = r * 0.5;
  ctx.fillStyle = "rgba(8,14,24,0.92)";
  ctx.fillRect(center.x - vw / 2, center.y - vh * 0.75, vw, vh);
  const scanY = center.y - vh * 0.75 + ((time * 40) % vh);
  ctx.strokeStyle = "rgba(34,211,238,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(center.x - vw / 2, scanY);
  ctx.lineTo(center.x + vw / 2, scanY);
  ctx.stroke();
  // ojos láser
  for (const e of [POSE.eyeL, POSE.eyeR]) {
    if (!vis(e)) continue;
    glowDot(ctx, { x: p[e].x, y: p[e].y - r * 0.05 }, r * 0.1, CYAN, 20);
  }
  ctx.restore();

  // antenas
  for (const [i, sgn] of [
    [POSE.earL, -1],
    [POSE.earR, 1],
  ] as [number, number][]) {
    if (!vis(i)) continue;
    const a = p[i];
    const b = { x: a.x + sgn * r * 0.28, y: a.y - r * 1.25 };
    drawLimb(ctx, a, b, r * 0.09, r * 0.05, CYAN, opts.intensity);
    glowDot(ctx, b, r * 0.09, 0.5 + 0.5 * Math.sin(time * 5 + sgn) > 0.5 ? AMBER : CYAN, 16);
  }
  ctx.restore();

  if (opts.showHud) tag(ctx, "◈ UNIDAD OCULAR", { x: center.x, y: center.y - r * 1.5 }, CYAN);
}

/** ---------- HUD genérico ---------- */
function tag(ctx: Ctx, text: string, at: V, color: string) {
  ctx.save();
  ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  const w = ctx.measureText(text).width + 10;
  const x = at.x - w / 2;
  const y = at.y - 7;
  ctx.fillStyle = "rgba(4,10,18,0.55)";
  ctx.fillRect(x, y, w, 14);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillText(text, x + 5, y + 10);
  ctx.restore();
}

export function label(ctx: Ctx, text: string, at: V, offsetY: number, color = CYAN) {
  tag(ctx, text, { x: at.x, y: at.y - offsetY }, color);
}

/** Rejilla + barrido estilo scanner sobre toda la escena */
export function drawSceneFx(ctx: Ctx, w: number, h: number, time: number, active: boolean) {
  if (!active) return;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1;
  const step = 42;
  ctx.beginPath();
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();

  // barrido vertical
  const y = ((time * 0.22) % 1) * h;
  const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
  g.addColorStop(0, "rgba(34,211,238,0)");
  g.addColorStop(0.5, "rgba(34,211,238,0.16)");
  g.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 60, w, 120);
  ctx.strokeStyle = "rgba(34,211,238,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
}

/** Marcos de detección (solo lo captado por la cámara se convierte en robot) */
export function drawPartBrackets(ctx: Ctx, frame: ArFrame, view: View) {
  const boxes: { pts: { x: number; y: number }[]; lbl: string }[] = [];
  if (frame.pose) {
    const raw = frame.pose.points;
    const ok = (i: number) => (raw[i]?.visibility ?? 1) > 0.45;
    const add = (idx: number[], lbl: string) => {
      const valid = idx.filter((i) => ok(i));
      if (valid.length < 2) return;
      boxes.push({ pts: valid.map((i) => view.map(raw[i])), lbl });
    };
    add([11, 12, 23, 24], "TORAX");
    add([0, 7, 8], "CRANEO");
    add([11, 13, 15], "BRAZO-IZQ");
    add([12, 14, 16], "BRAZO-DER");
    add([23, 25, 27], "PIERNA-IZQ");
    add([24, 26, 28], "PIERNA-DER");
  }
  frame.hands.forEach((hand) => boxes.push({ pts: hand.points.map(view.map), lbl: `MANO-${hand.label === "Left" ? "I" : "D"}` }));

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  for (const b of boxes) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const q of b.pts) {
      minX = Math.min(minX, q.x);
      minY = Math.min(minY, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
    const pad = 14;
    const x = minX - pad;
    const y = minY - pad;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    ctx.strokeStyle = "rgba(34,211,238,0.45)";
    ctx.strokeRect(x, y, w, h);
    const text = `◉ ${b.lbl}`;
    const tw = ctx.measureText(text).width + 8;
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(4,10,18,0.6)";
    ctx.fillRect(x, y - 15, tw, 14);
    ctx.fillStyle = "rgba(103,232,249,0.95)";
    ctx.fillText(text, x + 4, y - 5);
    ctx.setLineDash([6, 5]);
  }
  ctx.restore();
}
