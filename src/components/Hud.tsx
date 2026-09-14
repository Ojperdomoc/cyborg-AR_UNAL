import type { GameStats } from "@/ar/game";
import type { EngineState } from "@/ar/engine";
import type { Facing, TrackMode } from "@/ar/types";
import { IconBtn, PartChip } from "./Ui";

const MODE_LABEL: Record<TrackMode, string> = {
  full: "CUERPO + MANOS",
  pose: "SOLO CUERPO",
  hands: "SOLO MANOS",
};

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function Hud({
  state,
  stats,
  mode,
  facing,
  skin,
  sound,
  showHud,
  onFlip,
  onCycleMode,
  onToggleSkin,
  onToggleHud,
  onToggleSound,
  onExit,
  loadingMode,
}: {
  state: EngineState;
  stats: GameStats;
  mode: TrackMode;
  facing: Facing;
  skin: boolean;
  sound: boolean;
  showHud: boolean;
  onFlip: () => void;
  onCycleMode: () => void;
  onToggleSkin: () => void;
  onToggleHud: () => void;
  onToggleSound: () => void;
  onExit: () => void;
  loadingMode: boolean;
}) {
  const timePct = stats.timeLeft > 0 ? stats.timeLeft / 60 : 0;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 select-none">
      {/* ------- barra superior ------- */}
      <div className="flex items-start gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-cyan-400/25 bg-slate-950/70 px-3 py-2 backdrop-blur-md">
          <div className="font-display text-[13px] leading-none font-black tracking-[0.16em] text-cyan-200">
            CYBER<span className="text-cyan-400">FLEX</span>
          </div>
          <div className="h-4 w-px bg-cyan-400/25" />
          <div className="font-mono text-[10px] leading-none text-slate-400">
            {state.fps} FPS · {state.inferMs}ms
          </div>
        </div>

        <div className="flex-1" />

        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <IconBtn title="Cambiar cámara" onClick={onFlip}>
            {facing === "user" ? "🤳" : "📷"}
          </IconBtn>
          <IconBtn title="Modo de escaneo" onClick={onCycleMode} active={loadingMode}>
            <span className="font-display text-[9px] leading-none">
              {loadingMode ? "…" : mode === "full" ? "🤖" : mode === "pose" ? "🧍" : "✋"}
            </span>
          </IconBtn>
          <IconBtn title="Skin robótico" onClick={onToggleSkin} active={skin}>
            🦾
          </IconBtn>
          <IconBtn title="Etiquetas AR" onClick={onToggleHud} active={showHud}>
            📟
          </IconBtn>
          <IconBtn title="Sonido" onClick={onToggleSound} active={sound}>
            {sound ? "🔊" : "🔇"}
          </IconBtn>
          <IconBtn title="Salir" onClick={onExit}>
            ✕
          </IconBtn>
        </div>
      </div>

      {/* ------- marcador ------- */}
      <div className="pointer-events-none mt-2 flex items-start justify-between gap-3">
        <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/65 px-3 py-2 backdrop-blur-md">
          <div className="font-mono text-[9px] tracking-[0.3em] text-cyan-300/70">PUNTAJE</div>
          <div className="font-display text-3xl leading-none font-black text-cyan-50 tabular-nums">
            {stats.score.toString().padStart(4, "0")}
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-400">
            COMBO <span className="text-amber-300">x{stats.combo}</span> · NIVEL {stats.level}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/65 px-3 py-2 text-right backdrop-blur-md">
            <div className="font-mono text-[9px] tracking-[0.3em] text-cyan-300/70">TIEMPO</div>
            <div className="font-display text-2xl leading-none font-black text-cyan-50 tabular-nums">
              {timePct === 0 ? "∞" : fmtTime(stats.timeLeft)}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 px-2 py-1 font-mono text-[9px] text-slate-300 backdrop-blur-md">
            {MODE_LABEL[mode]} · {facing === "user" ? "FRONTAL" : "TRASERA"}
          </div>
        </div>
      </div>

      {/* ------- inferior: partes detectadas ------- */}
      <div className="flex flex-col gap-2">
        {stats.timeLeft > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 transition-[width] duration-200"
              style={{ width: `${Math.max(0, timePct * 100)}%` }}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {state.parts.length === 0 ? (
            <span className="font-mono rounded-md border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200 backdrop-blur-sm">
              ◌ BUSCANDO CUERPO / MANOS…
            </span>
          ) : (
            state.parts.map((p) => <PartChip key={p.id} part={p} />)
          )}
          {state.handCount > 0 && (
            <span className="font-mono rounded-md border border-amber-300/50 bg-amber-400/15 px-2 py-1 text-[10px] text-amber-100 backdrop-blur-sm">
              🤏 PINZA PARA CAPTURAR
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
