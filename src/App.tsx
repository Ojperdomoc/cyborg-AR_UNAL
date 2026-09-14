import { useCallback, useEffect, useRef, useState } from "react";
import { ArEngine, type EngineState } from "@/ar/engine";
import type { GameStats } from "@/ar/game";
import { setAudioEnabled, sfx, unlockAudio } from "@/ar/audio";
import type { Facing, TrackMode } from "@/ar/types";
import { GameOver } from "@/components/GameOver";
import { Hud } from "@/components/Hud";
import { Intro } from "@/components/Intro";

type Phase = "intro" | "countdown" | "playing" | "over";

const EMPTY_STATS: GameStats = {
  score: 0,
  combo: 1,
  captures: 0,
  misses: 0,
  timeLeft: 0,
  level: 1,
  targets: 0,
  over: false,
};

const EMPTY_STATE: EngineState = {
  status: "idle",
  message: "",
  fps: 0,
  inferMs: 0,
  hasPose: false,
  handCount: 0,
  parts: [],
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ArEngine | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<TrackMode>("full");
  const [facing, setFacing] = useState<Facing>("user");
  const [practice, setPractice] = useState(false);
  const [skin, setSkin] = useState(true);
  const [showHud, setShowHud] = useState(true);
  const [sound, setSound] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(3);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [arState, setArState] = useState<EngineState>(EMPTY_STATE);
  const [best, setBest] = useState(0);

  /* ---------- crear motor ---------- */
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || engineRef.current) return;
    const engine = new ArEngine(canvasRef.current, videoRef.current, {
      onState: setArState,
      onStats: setStats,
      onGameOver: (s) => {
        setStats(s);
        setBest((b) => Math.max(b, s.score));
        setPhase("over");
      },
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("cyberflex.best") || 0) || 0);
    } catch {
      /* noop */
    }
  }, [phase]);

  useEffect(() => setAudioEnabled(sound), [sound]);

  /* ---------- pausa automática ---------- */
  useEffect(() => {
    const onVis = () => {
      const e = engineRef.current;
      if (!e) return;
      if (document.hidden) {
        e.pause();
        e.game.stop();
      } else if (phase === "playing" || phase === "countdown") {
        e.resume();
        if (!practice && phase === "playing") e.game.start(60);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, practice]);

  /* ---------- arranque ---------- */
  const boot = useCallback(
    async (nextMode: TrackMode, nextFacing: Facing) => {
      const engine = engineRef.current;
      if (!engine) return;
      setLoading(true);
      setError(null);
      unlockAudio();
      sfx("blip");
      try {
        await engine.boot(nextMode, nextFacing);
        setLoading(false);
        setCount(3);
        setPhase("countdown");
      } catch (e) {
        setLoading(false);
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          `${msg} · Revisa que hayas dado permiso a la cámara y que la página se sirva por HTTPS. Si estás en un iframe, permite la cámara en los ajustes del sitio.`,
        );
      }
    },
    [],
  );

  /* ---------- cuenta regresiva ---------- */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count < 0) {
      const engine = engineRef.current;
      engine?.game.start(practice ? 0 : 60);
      sfx("start");
      setPhase("playing");
      return;
    }
    const id = window.setTimeout(() => {
      if (count > 0) sfx("count");
      setCount((c) => c - 1);
    }, 750);
    return () => window.clearTimeout(id);
  }, [phase, count, practice]);

  const flipCamera = useCallback(async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
    sfx("blip");
    try {
      await engineRef.current?.switchCamera(next);
    } catch {
      setError("No se pudo cambiar de cámara.");
    }
  }, [facing]);

  const cycleMode = useCallback(async () => {
    const order: TrackMode[] = ["full", "hands", "pose"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    setLoadingMode(true);
    sfx("blip");
    try {
      await engineRef.current?.setMode(next);
    } catch {
      setError("No se pudo cambiar el modo de escaneo.");
    }
    setLoadingMode(false);
  }, [mode]);

  const restart = useCallback(() => {
    const engine = engineRef.current;
    engine?.game.reset();
    setStats(EMPTY_STATS);
    setCount(3);
    setPhase("countdown");
  }, []);

  const toMenu = useCallback(() => {
    const engine = engineRef.current;
    engine?.game.stop();
    engine?.game.reset();
    setPhase("intro");
  }, []);

  const running = phase !== "intro";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05070d]">
      {/* capa de video (oculta, solo alimenta el motor) */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
        playsInline
        muted
        autoPlay
      />

      {/* lienzo AR */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* viñeta */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 160px 40px rgba(2,6,15,0.9)" }}
      />

      {running && phase !== "over" && (
        <Hud
          state={arState}
          stats={stats}
          mode={mode}
          facing={facing}
          skin={skin}
          sound={sound}
          showHud={showHud}
          loadingMode={loadingMode}
          onFlip={flipCamera}
          onCycleMode={cycleMode}
          onToggleSkin={() => {
            setSkin((v) => !v);
            sfx("blip");
          }}
          onToggleHud={() => setShowHud((v) => !v)}
          onToggleSound={() => {
            unlockAudio();
            setSound((v) => !v);
          }}
          onExit={toMenu}
        />
      )}

      {/* cuenta regresiva */}
      {phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div key={count} className="count-pulse text-center">
            <div className="font-display text-[110px] leading-none font-black text-cyan-200 drop-shadow-[0_0_30px_rgba(34,211,238,0.9)]">
              {count > 0 ? count : "¡GO!"}
            </div>
            <div className="font-mono mt-2 text-xs tracking-[0.3em] text-cyan-300/80">
              {count > 0 ? "ESTIRA LOS BRAZOS Y MUESTRA LAS MANOS" : "HAZ PINZA PARA CAPTURAR"}
            </div>
          </div>
        </div>
      )}

      {phase === "intro" && (
        <Intro
          mode={mode}
          setMode={setMode}
          facing={facing}
          setFacing={setFacing}
          practice={practice}
          setPractice={setPractice}
          onStart={() => void boot(mode, facing)}
          loading={loading}
          error={error}
          best={best}
        />
      )}

      {phase === "over" && (
        <GameOver stats={stats} best={Math.max(best, stats.score)} practice={practice} onRestart={restart} onMenu={toMenu} />
      )}

      {/* aviso de error en partida */}
      {running && error && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-rose-400/40 bg-rose-950/80 px-3 py-2 font-mono text-[11px] text-rose-100 backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
