let transcriberInstance: any = null;

/**
 * Detects if WebGPU is supported and available in the browser.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  // In a Node or non-browser environment, WebGPU is unavailable.
  if (typeof window === "undefined" || typeof navigator === "undefined" || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator.gpu as any).requestAdapter();
    return !!adapter;
  } catch (e) {
    return false;
  }
}

/**
 * Initializes and caches the Whisper transcriber.
 * Tries WebGPU if available, falls back to WASM automatically.
 */
export async function getTranscriber(onProgress?: (msg: string) => void): Promise<any> {
  if (transcriberInstance) {
    return transcriberInstance;
  }

  const { pipeline } = await import("@huggingface/transformers");

  const isWebGPU = await checkWebGPUSupport();
  const device = isWebGPU ? "webgpu" : "wasm";

  onProgress?.(`Initializing Whisper (${device.toUpperCase()})...`);

  try {
    transcriberInstance = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
      {
        device: device as any,
        progress_callback: (data: any) => {
          if (data.status === "progress") {
            const pct = Math.round(data.progress || 0);
            const file = data.file ? ` (${data.file.split("/").pop()})` : "";
            onProgress?.(`Downloading Whisper model${file}: ${pct}%`);
          } else if (data.status === "initiate") {
            onProgress?.("Initiating file load...");
          } else if (data.status === "ready") {
            onProgress?.("Whisper model loaded.");
          }
        },
      }
    );
  } catch (err) {
    console.warn("Failed to load Whisper on device: " + device, err);
    if (device === "webgpu") {
      onProgress?.("WebGPU initialization failed. Falling back to WASM...");
      transcriberInstance = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-tiny.en",
        {
          device: "wasm",
          progress_callback: (data: any) => {
            if (data.status === "progress") {
              const pct = Math.round(data.progress || 0);
              onProgress?.(`Downloading Whisper model (WASM): ${pct}%`);
            }
          },
        }
      );
    } else {
      throw err;
    }
  }

  return transcriberInstance;
}

/**
 * Transcribes a 16kHz Float32 mono channel audio array client-side.
 */
export async function transcribeAudio(
  audioData: Float32Array,
  onProgress?: (msg: string) => void
): Promise<string> {
  const transcriber = await getTranscriber(onProgress);
  onProgress?.("Transcribing audio speech...");

  const response = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });

  const text = Array.isArray(response) ? response[0].text : response.text;
  return text ? text.trim() : "";
}