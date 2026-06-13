/**
 * Voice abstraction layer.
 * All voice IDs are validated against the kokoro-js 1.2.1 VOICES registry.
 * Future-proofed for RVC / So-VITS (Phase 8 — not implemented).
 */

export interface Voice {
  id: string;
  name: string;
  language: string;
  description: string;
}

/**
 * Curated list of female-biased Kokoro voices suited for Teto-style output.
 * All IDs exist in onnx-community/Kokoro-82M-v1.0-ONNX.
 */
export const VOICES: Voice[] = [
  {
    id: "af_heart",
    name: "Heart",
    language: "English (US)",
    description: "Warm, expressive — recommended ✦",
  },
  {
    id: "af_bella",
    name: "Bella",
    language: "English (US)",
    description: "Clear, bright feminine voice",
  },
  {
    id: "af_nova",
    name: "Nova",
    language: "English (US)",
    description: "Energetic, youthful female",
  },
  {
    id: "af_sky",
    name: "Sky",
    language: "English (US)",
    description: "Light, airy female voice",
  },
  {
    id: "af_sarah",
    name: "Sarah",
    language: "English (US)",
    description: "Soft, gentle female voice",
  },
  {
    id: "af_jessica",
    name: "Jessica",
    language: "English (US)",
    description: "Natural, conversational female",
  },
  {
    id: "af_nicole",
    name: "Nicole",
    language: "English (US)",
    description: "Smooth, polished female voice",
  },
  {
    id: "bf_emma",
    name: "Emma",
    language: "English (UK)",
    description: "British female — elegant and clear",
  },
  {
    id: "bf_alice",
    name: "Alice",
    language: "English (UK)",
    description: "British female — crisp and lively",
  },
  {
    id: "bf_lily",
    name: "Lily",
    language: "English (UK)",
    description: "British female — soft and warm",
  },
];

/** Default voice used on first load */
export const DEFAULT_VOICE_ID = "af_heart";
