/**
 * Pure browser-native Kokoro speech synthesis layer.
 *
 * Supports voice blending (weighted mix of multiple style embeddings)
 * and post-inference pitch shifting, enabling character voice approximations
 * like Kasane Teto and Hatsune Miku using only the built-in voice bank.
 */

import * as ort from "onnxruntime-web";
import { getKokoroModel } from "./modelLoader";
import { audioBufferToWav } from "../audioUtils";

// ---------------------------------------------------------------------------
// Vocab
// ---------------------------------------------------------------------------
const VOCAB: Record<string, number> = {
  "$": 0, ";": 1, ":": 2, ",": 3, ".": 4, "!": 5, "?": 6,
  "\u2014": 9, "\u2026": 10, '"': 11, "(": 12, ")": 13,
  "\u201c": 14, "\u201d": 15, " ": 16, "\u0303": 17,
  "\u02a3": 18, "\u02a5": 19, "\u02a6": 20, "\u02a8": 21,
  "\u1d5d": 22, "\uab67": 23,
  A: 24, I: 25, O: 31, Q: 33, S: 35, T: 36, W: 39, Y: 41,
  "\u1d4a": 42,
  a: 43, b: 44, c: 45, d: 46, e: 47, f: 48, h: 50, i: 51, j: 52,
  k: 53, l: 54, m: 55, n: 56, o: 57, p: 58, q: 59, r: 60, s: 61,
  t: 62, u: 63, v: 64, w: 65, x: 66, y: 67, z: 68,
  "\u0251": 69, "\u0250": 70, "\u0252": 71, "\u00e6": 72,
  "\u03b2": 75, "\u0254": 76, "\u0255": 77, "\u00e7": 78,
  "\u0256": 80, "\u00f0": 81, "\u02a4": 82, "\u0259": 83,
  "\u025a": 85, "\u025b": 86, "\u025c": 87, "\u025f": 90,
  "\u0261": 92, "\u0265": 99, "\u0268": 101, "\u026a": 102,
  "\u029d": 103, "\u026f": 110, "\u0270": 111, "\u014b": 112,
  "\u0273": 113, "\u0272": 114, "\u0274": 115, "\u00f8": 116,
  "\u0278": 118, "\u03b8": 119, "\u0153": 120, "\u0279": 123,
  "\u027e": 125, "\u027b": 126, "\u0281": 128, "\u027d": 129,
  "\u0282": 130, "\u0283": 131, "\u0288": 132, "\u02a7": 133,
  "\u028a": 135, "\u028b": 136, "\u028c": 138, "\u0263": 139,
  "\u0264": 140, "\u03c7": 142, "\u028e": 143, "\u0292": 147,
  "\u0294": 148, "\u02c8": 156, "\u02cc": 157, "\u02d0": 158,
  "\u02b0": 162, "\u02b2": 164, "\u2193": 169, "\u2192": 171,
  "\u2197": 172, "\u2198": 173, "\u1d7b": 177,
};

const MODEL_MAX_LENGTH = 510;

// ---------------------------------------------------------------------------
// Voice preset system
// ---------------------------------------------------------------------------

export interface VoicePreset {
  /** Display label */
  label: string;
  /**
   * Weighted voice blend. Each tuple is [voiceId, weight].
   * Weights are normalised automatically — they don't need to sum to 1.
   */
  voices: [string, number][];
  /**
   * Kokoro inference speed. 1.0 = normal.
   * Slightly below 1.0 adds breath; above 1.0 adds energy.
   */
  speed: number;
  /**
   * Semitones to shift pitch AFTER inference via PCM resampling.
   * Positive = higher pitch (shorter output). Negative = lower.
   * Each semitone ≈ 5.9% frequency change.
   * Note: simple resampling shifts pitch AND shortens duration proportionally.
   */
  pitchSemitones: number;
}

/**
 * Built-in voice presets.
 *
 * Standard voices (pitchSemitones: 0) are pass-through — they call the
 * model normally with no post-processing.
 *
 * Character approximations blend voices and apply pitch shifting to push
 * the result into the target character's vocal register.
 *
 * Teto tuning rationale:
 *   af_sky  (70%) — lightest, most airy built-in female voice
 *   af_nova (30%) — adds brightness and energy
 *   +4 semitones  — pushes into Teto's high soprano register (~E5)
 *   speed 0.92    — slightly slower delivery = more deliberate enunciation
 *
 * Miku tuning rationale:
 *   af_sky  (65%) — airy base
 *   af_kore (35%) — adds clarity and slight edge
 *   +6 semitones  — Miku sits even higher than Teto (~G5)
 *   speed 1.0     — Miku's delivery is crisp, not slow
 */
export const VOICE_PRESETS: Record<string, VoicePreset> = {
  // ── Standard built-in voices (no pitch shift) ──────────────────────────────
  af_heart:    { label: "Heart",    voices: [["af_heart", 1]],    speed: 1.0, pitchSemitones: 0 },
  af_bella:    { label: "Bella",    voices: [["af_bella", 1]],    speed: 1.0, pitchSemitones: 0 },
  af_nicole:   { label: "Nicole",   voices: [["af_nicole", 1]],   speed: 1.0, pitchSemitones: 0 },
  af_sarah:    { label: "Sarah",    voices: [["af_sarah", 1]],    speed: 1.0, pitchSemitones: 0 },
  af_sky:      { label: "Sky",      voices: [["af_sky", 1]],      speed: 1.0, pitchSemitones: 0 },
  af_nova:     { label: "Nova",     voices: [["af_nova", 1]],     speed: 1.0, pitchSemitones: 0 },
  af_kore:     { label: "Kore",     voices: [["af_kore", 1]],     speed: 1.0, pitchSemitones: 0 },
  af_jessica:  { label: "Jessica",  voices: [["af_jessica", 1]],  speed: 1.0, pitchSemitones: 0 },
  af_river:    { label: "River",    voices: [["af_river", 1]],    speed: 1.0, pitchSemitones: 0 },
  am_adam:     { label: "Adam",     voices: [["am_adam", 1]],     speed: 1.0, pitchSemitones: 0 },
  am_michael:  { label: "Michael",  voices: [["am_michael", 1]],  speed: 1.0, pitchSemitones: 0 },
  am_echo:     { label: "Echo",     voices: [["am_echo", 1]],     speed: 1.0, pitchSemitones: 0 },
  am_eric:     { label: "Eric",     voices: [["am_eric", 1]],     speed: 1.0, pitchSemitones: 0 },
  am_fenrir:   { label: "Fenrir",   voices: [["am_fenrir", 1]],   speed: 1.0, pitchSemitones: 0 },
  am_liam:     { label: "Liam",     voices: [["am_liam", 1]],     speed: 1.0, pitchSemitones: 0 },
  am_onyx:     { label: "Onyx",     voices: [["am_onyx", 1]],     speed: 1.0, pitchSemitones: 0 },
  am_puck:     { label: "Puck",     voices: [["am_puck", 1]],     speed: 1.0, pitchSemitones: 0 },
  bf_emma:     { label: "Emma",     voices: [["bf_emma", 1]],     speed: 1.0, pitchSemitones: 0 },
  bf_isabella: { label: "Isabella", voices: [["bf_isabella", 1]], speed: 1.0, pitchSemitones: 0 },
  bm_george:   { label: "George",   voices: [["bm_george", 1]],   speed: 1.0, pitchSemitones: 0 },
  bm_lewis:    { label: "Lewis",    voices: [["bm_lewis", 1]],    speed: 1.0, pitchSemitones: 0 },

  // ── Character approximations ───────────────────────────────────────────────
  kasane_teto: {
    label: "Kasane Teto (approx.)",
    voices: [["af_sky", 0.7], ["af_nova", 0.3]],
    speed: 0.92,
    pitchSemitones: 4,
  },
  hatsune_miku: {
    label: "Hatsune Miku (approx.)",
    voices: [["af_sky", 0.65], ["af_kore", 0.35]],
    speed: 1.0,
    pitchSemitones: 6,
  },
  megurine_luka: {
    label: "Megurine Luka (approx.)",
    voices: [["af_heart", 0.5], ["af_bella", 0.5]],
    speed: 0.95,
    pitchSemitones: -1,
  },
  ia: {
    label: "IA (approx.)",
    voices: [["af_sky", 0.8], ["af_river", 0.2]],
    speed: 1.0,
    pitchSemitones: 3,
  },
};

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
function tokenizePhonemes(phonemes: string): Int32Array {
  const normalized = Array.from(phonemes).filter((ch) => ch in VOCAB).join("");
  const charIds = Array.from(normalized).map((ch) => VOCAB[ch] ?? 0);
  return new Int32Array([0, ...charIds.slice(0, MODEL_MAX_LENGTH), 0]);
}

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------
function normalizeNumbers(e: string): string {
  if (e.includes(".")) return e;
  if (e.includes(":")) {
    const [a, t] = e.split(":").map(Number);
    return t === 0 ? `${a} o'clock` : t < 10 ? `${a} oh ${t}` : `${a} ${t}`;
  }
  const a = parseInt(e.slice(0, 4), 10);
  if (a < 1100 || a % 1000 < 10) return e;
  const t = e.slice(0, 2);
  const r = parseInt(e.slice(2, 4), 10);
  const n = e.endsWith("s") ? "s" : "";
  if (a % 1000 >= 100 && a % 1000 <= 999) {
    if (r === 0) return `${t} hundred${n}`;
    if (r < 10) return `${t} oh ${r}${n}`;
  }
  return `${t} ${r}${n}`;
}

function normalizeCurrency(e: string): string {
  const a = e[0] === "$" ? "dollar" : "pound";
  if (isNaN(Number(e.slice(1)))) return `${e.slice(1)} ${a}s`;
  if (!e.includes(".")) {
    const t = e.slice(1) === "1" ? "" : "s";
    return `${e.slice(1)} ${a}${t}`;
  }
  const [t, r] = e.slice(1).split(".");
  const n = parseInt(r.padEnd(2, "0"), 10);
  return `${t} ${a}${t === "1" ? "" : "s"} and ${n} ${
    e[0] === "$" ? (n === 1 ? "cent" : "cents") : n === 1 ? "penny" : "pence"
  }`;
}

function normalizeDecimals(e: string): string {
  const [a, t] = e.split(".");
  return `${a} point ${t.split("").join(" ")}`;
}

const PUNCTUATION_REGEX = /(\s*[\s;:,.!?¡¿—…"«»""(){}[\]]+\s*)+/g;

function cleanText(text: string): string {
  return text
    .replace(/['']/g, "'").replace(/«/g, "\u201c").replace(/»/g, "\u201d")
    .replace(/[""]/g, '"').replace(/\(/g, "«").replace(/\)/g, "»")
    .replace(/、/g, ", ").replace(/。/g, ". ").replace(/！/g, "! ")
    .replace(/，/g, ", ").replace(/：/g, ": ").replace(/；/g, "; ")
    .replace(/？/g, "? ").replace(/[^\S \n]/g, " ").replace(/  +/g, " ")
    .replace(/(?<=\n) +(?=\n)/g, "")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, normalizeNumbers)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?:  hundred|  thousand|  (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, normalizeCurrency)
    .replace(/\d*\.\d+/g, normalizeDecimals)
    .replace(/(?<=\d)-(?=\d)/g, " to ").replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (e => e.replace(/\./g, "-")))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();
}

// ---------------------------------------------------------------------------
// Phonemization
// ---------------------------------------------------------------------------
async function getPhonemes(text: string, voiceId: string): Promise<string> {
  const cleaned = cleanText(text);
  // Use first char of first voice in preset for lang detection
  const firstVoice = VOICE_PRESETS[voiceId]?.voices[0]?.[0] ?? voiceId;
  const lang = firstVoice.charAt(0) === "a" ? "en-us" : "en";
  const { phonemize } = await import("phonemizer");

  const parts: { match: boolean; text: string }[] = [];
  let lastIndex = 0;
  PUNCTUATION_REGEX.lastIndex = 0;
  let match;
  while ((match = PUNCTUATION_REGEX.exec(cleaned)) !== null) {
    if (match.index > lastIndex)
      parts.push({ match: false, text: cleaned.slice(lastIndex, match.index) });
    if (match[0].length > 0)
      parts.push({ match: true, text: match[0] });
    lastIndex = PUNCTUATION_REGEX.lastIndex;
  }
  if (lastIndex < cleaned.length)
    parts.push({ match: false, text: cleaned.slice(lastIndex) });

  const phonemizedParts = await Promise.all(
    parts.map(async (part) => {
      if (part.match) return part.text;
      const res = await phonemize(part.text, lang);
      return res.join(" ");
    })
  );

  let phonemes = phonemizedParts.join("")
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»"" ]|$)/g, "z");

  if (lang === "en-us")
    phonemes = phonemes.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");

  return phonemes.trim();
}

// ---------------------------------------------------------------------------
// Voice style cache and fetching
// ---------------------------------------------------------------------------
const voiceCache = new Map<string, Float32Array>();

async function fetchVoiceStyle(voiceId: string): Promise<Float32Array> {
  if (voiceCache.has(voiceId)) return voiceCache.get(voiceId)!;

  const url = `/models/kokoro/voices/${voiceId}.bin`;
  let cache: Cache | null = null;
  try {
    cache = await caches.open("kokoro-voices");
    const hit = await cache.match(url);
    if (hit) {
      const arr = new Float32Array(await hit.arrayBuffer());
      voiceCache.set(voiceId, arr);
      return arr;
    }
  } catch {}

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch voice "${voiceId}": ${res.status}`);
  const buf = await res.arrayBuffer();
  const arr = new Float32Array(buf);
  voiceCache.set(voiceId, arr);
  try { await cache?.put(url, new Response(buf.slice(0), { headers: res.headers })); } catch {}
  return arr;
}

// ---------------------------------------------------------------------------
// Voice blending
// ---------------------------------------------------------------------------

/**
 * Fetches and blends multiple voice style arrays into a single one.
 * Weights are normalised so they don't need to sum to 1.
 */
async function blendVoiceStyles(
  voices: [string, number][]
): Promise<Float32Array> {
  if (voices.length === 1) return fetchVoiceStyle(voices[0][0]);

  const arrays = await Promise.all(voices.map(([id]) => fetchVoiceStyle(id)));
  const totalWeight = voices.reduce((s, [, w]) => s + w, 0);

  const blended = new Float32Array(arrays[0].length);
  for (let i = 0; i < arrays.length; i++) {
    const w = voices[i][1] / totalWeight;
    for (let j = 0; j < blended.length; j++) {
      blended[j] += arrays[i][j] * w;
    }
  }
  return blended;
}

// ---------------------------------------------------------------------------
// Float16 → Float32
// ---------------------------------------------------------------------------
function float16ArrayToFloat32(uint16: Uint16Array): Float32Array {
  const out = new Float32Array(uint16.length);
  for (let i = 0; i < uint16.length; i++) {
    const h = uint16[i];
    const sign = (h >> 15) & 0x1;
    const exp  = (h >> 10) & 0x1f;
    const mant = h & 0x3ff;
    let val: number;
    if (exp === 0)       val = Math.pow(2, -14) * (mant / 1024);
    else if (exp === 31) val = mant ? NaN : Infinity;
    else                 val = Math.pow(2, exp - 15) * (1 + mant / 1024);
    out[i] = sign ? -val : val;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pitch shifting
// ---------------------------------------------------------------------------

/**
 * Shifts the pitch of a PCM buffer by `semitones` using linear interpolation
 * resampling. Positive = higher pitch (output is shorter). Negative = lower.
 *
 * This is a simple time-domain resample — it shifts pitch and duration
 * together (no phase vocoder). For ±6 semitones the quality is very
 * acceptable for TTS output.
 */
function pitchShiftPCM(pcm: Float32Array, semitones: number): Float32Array {
  if (semitones === 0) return pcm;
  // ratio > 1 means we sample source faster → higher pitch, shorter output
  const ratio = Math.pow(2, semitones / 12);
  const outLength = Math.floor(pcm.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const src = i * ratio;
    const lo  = Math.floor(src);
    const hi  = Math.min(lo + 1, pcm.length - 1);
    const f   = src - lo;
    out[i] = pcm[lo] * (1 - f) + pcm[hi] * f;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates speech from text using the local Kokoro ONNX model.
 *
 * `voiceId` can be:
 *   - Any key from VOICE_PRESETS (e.g. "kasane_teto", "hatsune_miku", "af_heart")
 *   - Any raw Kokoro voice ID with a matching .bin file in /models/kokoro/voices/
 *
 * Character presets (kasane_teto, hatsune_miku, etc.) automatically blend
 * voice embeddings and apply pitch shifting to approximate the target voice.
 */
export async function generateSpeech(
  text: string,
  voiceId: string,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  // Resolve preset (fall back to raw voiceId as a single-voice preset)
  const preset: VoicePreset = VOICE_PRESETS[voiceId] ?? {
    label: voiceId,
    voices: [[voiceId, 1]],
    speed: 1.0,
    pitchSemitones: 0,
  };

  console.log(`[kokoro] Preset: "${voiceId}"`, preset);

  onProgress?.("Phonemizing text...");
  const phonemes = await getPhonemes(text, voiceId);
  console.log("[kokoro] Phonemes:", phonemes);

  onProgress?.("Tokenizing phonemes...");
  const inputIds = tokenizePhonemes(phonemes);
  console.log("[kokoro] inputIds length:", inputIds.length);

  onProgress?.("Loading Kokoro TTS model...");
  const session = await getKokoroModel(onProgress);

  onProgress?.(
    preset.voices.length > 1
      ? `Blending ${preset.voices.length} voices...`
      : "Fetching voice style embedding..."
  );
  const voiceStyleData = await blendVoiceStyles(preset.voices);
  console.log("[kokoro] Voice style length:", voiceStyleData.length,
              "| blend:", preset.voices);

  onProgress?.("Preparing inference inputs...");
  const styleIdx    = Math.min(Math.max(inputIds.length - 1, 0), 509);
  const styleOffset = 256 * styleIdx;
  const styleData   = voiceStyleData.slice(styleOffset, styleOffset + 256);

  if (Array.from(styleData).some((v) => isNaN(v) || !isFinite(v))) {
    throw new Error(`Blended style embedding contains NaN/Inf at index ${styleIdx}.`);
  }

  const feeds = {
    input_ids: new ort.Tensor(
      "int64",
      BigInt64Array.from(Array.from(inputIds).map(BigInt)),
      [1, inputIds.length]
    ),
    style: new ort.Tensor("float32", styleData, [1, 256]),
    speed: new ort.Tensor("float32", new Float32Array([preset.speed]), [1]),
  };

  console.log("[kokoro] speed:", preset.speed,
              "| pitchSemitones:", preset.pitchSemitones);

  onProgress?.("Running ONNX model inference...");
  const outputs = await session.run(feeds);

  if (!outputs.waveform)
    throw new Error("ONNX model output is missing 'waveform' tensor.");

  let pcm: Float32Array;
  if (outputs.waveform.type === "float16") {
    console.log("[kokoro] Detected float16 — converting.");
    pcm = float16ArrayToFloat32(outputs.waveform.data as unknown as Uint16Array);
  } else {
    pcm = outputs.waveform.data as Float32Array;
  }

  if (Array.from(pcm.slice(0, 100)).some((v) => isNaN(v))) {
    throw new Error(
      "PCM output contains NaN. Ensure modelLoader.ts uses executionProviders: ['wasm']."
    );
  }

  console.log("[kokoro] Raw PCM length:", pcm.length);

  // Apply pitch shift if requested
  if (preset.pitchSemitones !== 0) {
    onProgress?.(`Applying pitch shift (${preset.pitchSemitones > 0 ? "+" : ""}${preset.pitchSemitones} semitones)...`);
    pcm = pitchShiftPCM(pcm, preset.pitchSemitones);
    console.log("[kokoro] Post-shift PCM length:", pcm.length);
  }

  const sampleRate = 24000;
  onProgress?.("Encoding audio output...");

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio API not supported.");

  const audioContext = new AudioContextClass();
  const audioBuffer  = audioContext.createBuffer(1, pcm.length, sampleRate);
  audioBuffer.copyToChannel(pcm, 0);
  audioContext.close();

  return audioBufferToWav(audioBuffer);
}