import type { Facing, TrackMode } from "@/ar/types";
import { Btn, OptionRow, Panel } from "./Ui";
import hero from "@/assets/robot-hero.jpg";

export function Intro({
  mode,
  setMode,
  facing,
  setFacing,
  practice,
  setPractice,
  onStart,
  loading,
  error,
  best,
}: {
  mode: TrackMode;
  setMode: (m: TrackMode) => void;
  facing: Facing;
  setFacing: (f: Facing) => void;
  practice: boolean;
  setPractice: (v: boolean) => void;
  onStart: () => void;
  loading: boolean;
  error: string | null;
  best: number;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-[#071018] to-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col gap-4 p-5">
        <div className="pt-4 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-400/80">REALIDAD AUMENTADA · WEB AR</div>
          <h1 className="font-display mt-1 text-4xl leading-none font-black tracking-tight text-cyan-50">
            CYBER<span className="text-cyan-400">FLEX</span>
          </h1>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-400">
            Convierte tu cuerpo y tus manos en un <span className="text-cyan-300">exoesqueleto robótico</span> en tiempo
            real. Solo se robotiza lo que la cámara ve.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25">
          <img src={hero} alt="Exoesqueleto robótico" className="h-44 w-full object-cover object-top opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 font-mono text-[10px] tracking-[0.2em] text-cyan-300">
            ◈ MODELO: POSE-33 + HAND-21
          </div>
        </div>

        <Panel className="p-4">
          <div className="flex flex-col gap-4">
            <OptionRow
              label="Qué escanear"
              value={mode}
              onChange={setMode}
              options={[
                { value: "full", label: "Cuerpo + manos", hint: "33 + 42 puntos" },
                { value: "hands", label: "Solo manos", hint: "máx. fluidez" },
                { value: "pose", label: "Solo cuerpo", hint: "esqueleto completo" },
              ]}
            />
            <OptionRow
              label="Cámara"
              value={facing}
              onChange={setFacing}
              options={[
                { value: "user", label: "Frontal", hint: "selfie · espejo" },
                { value: "environment", label: "Trasera", hint: "escanea a alguien más" },
              ]}
            />
            <button
              onClick={() => setPractice(!practice)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-left"
            >
              <span>
                <span className="font-display block text-[11px] font-bold tracking-[0.14em] text-slate-200 uppercase">
                  Modo práctica
                </span>
                <span className="font-mono text-[10px] text-slate-500">sin cronómetro, solo robot</span>
              </span>
              <span
                className={`relative h-6 w-11 rounded-full transition ${practice ? "bg-cyan-400/80" : "bg-slate-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${practice ? "left-5" : "left-0.5"}`}
                />
              </span>
            </button>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="font-mono text-[10px] tracking-[0.28em] text-cyan-300/70 uppercase">Cómo se juega</div>
          <ul className="mt-2 space-y-2 font-mono text-[11px] leading-relaxed text-slate-300">
            <li>
              <span className="text-cyan-300">1.</span> Tu cuerpo aparece como robot: placas cromadas, servos y núcleos
              de energía.
            </li>
            <li>
              <span className="text-cyan-300">2.</span> Haz <span className="text-amber-300">pinza</span> (pulgar +
              índice) para activar el captor: aparece un aro ámbar en tu mano.
            </li>
            <li>
              <span className="text-cyan-300">3.</span> Mantén la pinza sobre un <span className="text-cyan-300">núcleo</span>{" "}
              para cargarlo: +10 × combo. Las <span className="text-amber-300">estrellas</span> valen +30 × combo.
            </li>
            <li>
              <span className="text-cyan-300">4.</span> Evita los <span className="text-rose-400">virus</span>: −25 y
              pierdes el combo.
            </li>
          </ul>
        </Panel>

        {error && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 font-mono text-[11px] leading-relaxed text-rose-200">
            ⚠ {error}
          </div>
        )}

        <Btn onClick={onStart} disabled={loading} className="w-full py-4 text-sm">
          {loading ? "CARGANDO RED NEURONAL…" : "ACTIVAR CÁMARA Y JUGAR"}
        </Btn>
        <div className="pb-6 text-center font-mono text-[10px] leading-relaxed text-slate-500">
          Récord local: <span className="text-cyan-300">{best}</span> pts · Se solicita permiso de cámara. Todo se procesa
          en tu dispositivo, nada se sube a ningún servidor.
          <br />
          Requiere HTTPS (GitHub Pages ya lo sirve cifrado).
        </div>
      </div>
    </div>
  );
}
