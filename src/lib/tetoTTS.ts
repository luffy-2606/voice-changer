import {
  AutoTokenizer,
  SpeechT5ForTextToSpeech,
  SpeechT5HifiGan,
  Tensor,
  env,
} from "@huggingface/transformers";
import { audioBufferToWav } from "./audioUtils";

// Disable local models to prevent 404s and fallback aborts
env.allowLocalModels = false;

// ─── Cached singletons ───────────────────────────────────────────────────────
let tokenizerPromise: Promise<any> | null = null;
let modelPromise: Promise<any> | null = null;
let vocoderPromise: Promise<any> | null = null;
let speakerEmbeddingsCache: Float32Array | null = null;

// ─── Speaker embeddings ──────────────────────────────────────────────────────
async function getSpeakerEmbeddings(
  onProgress?: (msg: string) => void
): Promise<Float32Array> {
  if (speakerEmbeddingsCache) return speakerEmbeddingsCache;

  onProgress?.("Downloading speaker voice profile...");
  const url = "/models/speaker.bin";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch speaker voice profile: ${res.statusText}`);
  }
  speakerEmbeddingsCache = new Float32Array(await res.arrayBuffer());
  return speakerEmbeddingsCache;
}

// ─── Progress callback shim ──────────────────────────────────────────────────
function makeProgressCb(label: string, onProgress?: (msg: string) => void) {
  return (data: any) => {
    if (data.status === "progress") {
      const pct = Math.round(data.progress || 0);
      const file = data.file ? ` (${data.file.split("/").pop()})` : "";
      onProgress?.(`${label}${file}: ${pct}%`);
    } else if (data.status === "ready") {
      onProgress?.(`${label} ready.`);
    }
  };
}

// ─── Lazy loaders ────────────────────────────────────────────────────────────
export function getTokenizer(onProgress?: (msg: string) => void) {
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained("Xenova/speecht5_tts", {
      progress_callback: makeProgressCb("Tokenizer", onProgress),
    }).catch((e: any) => {
      tokenizerPromise = null;
      throw e;
    });
  }
  return tokenizerPromise;
}

export function getTTSModel(onProgress?: (msg: string) => void) {
  if (!modelPromise) {
    onProgress?.("Initializing SpeechT5 TTS model (WASM)...");
    modelPromise = SpeechT5ForTextToSpeech.from_pretrained(
      "Xenova/speecht5_tts",
      {
        device: "wasm" as any,
        dtype: "fp32" as any,
        progress_callback: makeProgressCb("Downloading TTS model", onProgress),
      }
    ).catch((e: any) => {
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
}

export function getVocoder(onProgress?: (msg: string) => void) {
  if (!vocoderPromise) {
    onProgress?.("Initializing HiFi-GAN vocoder (WASM)...");
    vocoderPromise = SpeechT5HifiGan.from_pretrained(
      "Xenova/speecht5_hifigan",
      {
        device: "wasm" as any,
        dtype: "fp32" as any,
        progress_callback: makeProgressCb("Downloading vocoder", onProgress),
      }
    ).catch((e: any) => {
      vocoderPromise = null;
      throw e;
    });
  }
  return vocoderPromise;
}

// ─── Pre-warm all models in parallel ─────────────────────────────────────────
export async function preloadTTSModels(onProgress?: (msg: string) => void) {
  await Promise.all([
    getTokenizer(onProgress),
    getTTSModel(onProgress),
    getVocoder(onProgress),
  ]);
}

// ─── Main synthesis function ──────────────────────────────────────────────────
/**
 * Synthesizes text to speech using SpeechT5 + HiFi-GAN vocoder.
 * Returns a raw WAV Audio Blob.
 */
export async function generateTetoSpeech(
  text: string,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  // Load all components in parallel for speed
  onProgress?.("Loading TTS models...");
  const [tokenizer, model, vocoder, speakerEmbeddingsData] = await Promise.all([
    getTokenizer(onProgress),
    getTTSModel(onProgress),
    getVocoder(onProgress),
    getSpeakerEmbeddings(onProgress),
  ]);

  onProgress?.("Tokenizing text...");
  const { input_ids } = tokenizer(text);

  // Wrap Float32Array as a proper Tensor of shape [1, 512]
  const speaker_embeddings = new Tensor("float32", speakerEmbeddingsData, [
    1,
    speakerEmbeddingsData.length,
  ]);

  onProgress?.("Synthesizing speech...");
  const { waveform } = await model.generate_speech(
    input_ids,
    speaker_embeddings,
    { vocoder }
  );

  // waveform.data is a Float32Array
  const audioData: Float32Array = waveform.data;
  const sampleRate = 16000; // SpeechT5 always outputs 16 kHz

  // Convert raw Float32Array PCM to AudioBuffer
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }
  const audioContext = new AudioContextClass();
  const buffer = audioContext.createBuffer(1, audioData.length, sampleRate);
  buffer.copyToChannel(audioData, 0);
  audioContext.close();

  // Convert buffer to WAV Blob
  return audioBufferToWav(buffer);
}
