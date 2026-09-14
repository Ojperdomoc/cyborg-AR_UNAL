import type * as VisionNS from "@mediapipe/tasks-vision";
import type { TrackMode } from "./types";

type VisionModule = typeof VisionNS;

const CDN_BASES = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1",
  "https://unpkg.com/@mediapipe/tasks-vision@1.0.1",
];

/** URLs alternativas del módulo ESM (por si un CDN falla o bloquea el import directo) */
const MODULE_URLS = [
  `${CDN_BASES[0]}/vision_bundle.mjs`,
  `${CDN_BASES[1]}/vision_bundle.mjs`,
  "https://esm.sh/@mediapipe/tasks-vision@1.0.1",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm",
];

const MODELS = {
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

let modulePromise: Promise<VisionModule> | null = null;

/** Carga el runtime de MediaPipe Tasks Vision desde CDN (mantiene el bundle liviano). */
export async function loadVisionModule(): Promise<VisionModule> {
  if (modulePromise) return modulePromise;
  modulePromise = (async () => {
    let lastErr: unknown = null;
    for (const url of MODULE_URLS) {
      try {
        const mod = (await import(/* @vite-ignore */ url)) as unknown as VisionModule;
        if (mod?.FilesetResolver && mod?.PoseLandmarker && mod?.HandLandmarker) return mod;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error("No se pudo cargar MediaPipe Vision (revisa tu conexión)");
  })();
  return modulePromise;
}

export type Detectors = {
  pose: VisionNS.PoseLandmarker | null;
  hand: VisionNS.HandLandmarker | null;
};

async function fileset() {
  const mod = await loadVisionModule();
  let lastErr: unknown = null;
  for (const base of CDN_BASES) {
    try {
      return await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("No se pudo cargar el runtime WASM");
}

/** Crea los detectores necesarios según el modo elegido (GPU con fallback a CPU). */
export async function createDetectors(mode: TrackMode): Promise<Detectors> {
  const mod = await loadVisionModule();
  const wasm = await fileset();
  const wantPose = mode !== "hands";
  const wantHands = mode !== "pose";

  const build = async (delegate: "GPU" | "CPU"): Promise<Detectors> => {
    const out: Detectors = { pose: null, hand: null };
    if (wantPose) {
      out.pose = await mod.PoseLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: MODELS.pose, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    }
    if (wantHands) {
      out.hand = await mod.HandLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: MODELS.hand, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    }
    return out;
  };

  try {
    return await build("GPU");
  } catch {
    return await build("CPU");
  }
}
