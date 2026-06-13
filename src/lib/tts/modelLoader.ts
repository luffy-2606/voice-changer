/**
 * Kokoro TTS model loader using browser-native onnxruntime-web.
 * Manages a single cached InferenceSession.
 *
 * NOTE: WebGPU is intentionally disabled. The Kokoro ONNX model produces
 * all-NaN waveform output when run under WebGPU or WebGL — every sample
 * corrupts silently with no error thrown. WASM is the only reliable backend.
 */
 
import * as ort from "onnxruntime-web";
 
// Singleton InferenceSession
let session: ort.InferenceSession | null = null;
 
/**
 * Returns (and caches) the Kokoro model InferenceSession singleton.
 * Always uses the WASM execution provider.
 *
 * @param onProgress  Optional callback for progress messages.
 */
export async function getKokoroModel(
  onProgress?: (msg: string) => void
): Promise<ort.InferenceSession> {
  if (session) return session;
 
  // Force WASM globals before session creation.
  // These must be set before any InferenceSession.create() call.
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false; // set to true only if running inside a Web Worker
  ort.env.wasm.numThreads = typeof navigator !== "undefined"
    ? Math.min(navigator.hardwareConcurrency ?? 1, 4)
    : 1;
 
  onProgress?.("Loading Kokoro model using WASM...");
 
  session = await ort.InferenceSession.create("/models/kokoro/model.onnx", {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
    enableCpuMemArena: true,
  });
 
  onProgress?.("Kokoro model loaded successfully.");
  console.log("[modelLoader] Session created with WASM.");
  return session;
}
 
/**
 * Pre-warms the model in the background (call on app mount).
 * Errors are caught to prevent breaking the mount cycle.
 */
export async function preloadKokoroModel(): Promise<void> {
  try {
    await getKokoroModel();
  } catch (err) {
    console.warn("Failed to preload Kokoro model:", err);
  }
}