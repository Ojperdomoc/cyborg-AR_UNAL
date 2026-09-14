import type { GameStats } from "@/ar/game";
import { Btn, Panel } from "./Ui";

export function GameOver({
  stats,
  best,
  practice,
  onRestart,
  onMenu,
}: {
  stats: GameStats;
  best: number;
  practice: boolean;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const isRecord = stats.score > 0 && stats.score >= best;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm">
      <Panel className="w-full max-w-sm p-6 text-center">
        <div className="font-mono text-[10px] tracking-[0.4em] text-rose-300/80">SESIÓN TERMINADA</div>
        <h2 className="font-display mt-1 text-3xl font-black tracking-tight text-cyan-50">
          {isRecord ? "¡NUEVO RÉCORD!" : "DESACTIVADO"}
        </h2>

        <div className="font-display mt-5 text-6xl leading-none font-black text-cyan-300 tabular-nums">{stats.score}</div>
        <div className="font-mono mt-1 text-[10px] tracking-[0.3em] text-slate-400">PUNTOS</div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { k: "CAPTURAS", v: stats.captures },
            { k: "FALLOS", v: stats.misses },
            { k: "MÁXIMO", v: best },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-white/10 bg-slate-900/60 px-2 py-3">
              <div className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{s.k}</div>
              <div className="font-display text-lg font-bold text-cyan-100 tabular-nums">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Btn onClick={onRestart} className="w-full py-4">
            {practice ? "SEGUIR EN PRÁCTICA" : "JUGAR OTRA VEZ"}
          </Btn>
          <Btn variant="ghost" onClick={onMenu} className="w-full">
            Volver al menú
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
