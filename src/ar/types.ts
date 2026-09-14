export type Pt = { x: number; y: number; z?: number; visibility?: number };

export type HandFrame = {
  /** 21 landmarks normalizados [0..1] respecto al frame de video */
  points: Pt[];
  label: "Left" | "Right";
  score: number;
};

export type PoseFrame = { points: Pt[] };

export type ArFrame = {
  ts: number;
  pose: PoseFrame | null;
  hands: HandFrame[];
};

/** Mapeo del espacio normalizado del video al espacio CSS px del canvas */
export type View = {
  w: number;
  h: number;
  mirrored: boolean;
  map: (p: Pt) => { x: number; y: number };
};

export type Facing = "user" | "environment";

export type TrackMode = "full" | "pose" | "hands";

export type BodyPart = {
  id: string;
  label: string;
  state: "locked" | "scanning" | "ok";
};

export type Cursor = {
  id: number;
  x: number;
  y: number;
  r: number;
  pinching: boolean;
  hand: number;
  gesture: string;
};
