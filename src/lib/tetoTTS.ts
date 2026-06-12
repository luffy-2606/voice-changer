import { KokoroTTS } from "kokoro-js";
import { checkWebGPUSupport } from "./whisper";
import { audioBufferToWav } from "./audioUtils";

let ttsInstance: KokoroTTS | null = null;

/**
 * Initializes and caches the Kokoro TTS engine.
 * Selects WebGPU or WASM based on hardware availability.
 */
export async function getTTS(onProgress?: (msg: string) => void): Promise<KokoroTTS> {
  if (ttsInstance) {
    return ttsInstance;
  }

  const isWebGPU = await checkWebGPUSupport();
  const device = isWebGPU ? "webgpu" : "wasm";

  onProgress?.(`Initializing Kokoro TTS (${device.toUpperCase()})...`);

  try {
    // onnx-community/Kokoro-82M-v1.0-ONNX with dtype q8 loads the model_quantized.onnx file.
    ttsInstance = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: device as any,
      progress_callback: (data: any) => {
        if (data.status === "progress") {
          const pct = Math.round(data.progress || 0);
          const file = data.file ? ` (${data.file.split("/").pop()})` : "";
          onProgress?.(`Downloading TTS model${file}: ${pct}%`);
        } else if (data.status === "ready") {
          onProgress?.("TTS model loaded.");
        }
      },
    });
  } catch (err) {
    console.warn("Failed to load TTS on device: " + device, err);
    if (device === "webgpu") {
      onProgress?.("WebGPU TTS load failed. Falling back to WASM...");
      ttsInstance = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (data: any) => {
          if (data.status === "progress") {
            const pct = Math.round(data.progress || 0);
            onProgress?.(`Downloading TTS model (WASM): ${pct}%`);
          }
        },
      });
    } else {
      throw err;
    }
  }

  return ttsInstance!;
}

/**
 * Synthesizes text to speech using Kokoro-82M with the "af_sky" female voice.
 * Returns a raw WAV Audio Blob.
 */
export async function generateTetoSpeech(
  text: string,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const tts = await getTTS(onProgress);
  onProgress?.("Synthesizing speech...");

  const response = await tts.generate(text, {
    voice: "af_sky",
  });

  const sampleRate = response.sampling_rate || 24000;
  const audioData = response.audio;

  // Convert raw Float32Array PCM to AudioBuffer
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
