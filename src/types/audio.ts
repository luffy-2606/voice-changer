export type RecordingState = "idle" | "recording" | "paused";

export type ModelState = "idle" | "loading" | "ready" | "error";

export type ConversionState =
  | "idle"
  | "transcribing"
  | "synthesizing"
  | "processing"
  | "completed"
  | "error";

export interface ModelProgress {
  status: "initiate" | "progress" | "done" | "ready";
  progress?: number;
  loaded?: number;
  total?: number;
  file?: string;
}

export interface AudioInput {
  blob: Blob;
  url: string;
  name: string;
  duration: number;
}

export interface OutputAudio {
  blob: Blob;
  url: string;
  duration: number;
}
