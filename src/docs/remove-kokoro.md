# TetoVoice V3 — Stable Client-Side Migration (Kokoro ONNX + No Node Runtime Leakage)

## Overview

This migration fixes the broken build caused by `kokoro-js` pulling `onnxruntime-node` (native binaries) into the browser bundle.

We will **remove all Node-bound ML wrappers** and replace them with a **clean browser-native ONNX runtime architecture**.

Goal:

* 100% client-side
* No Node runtime dependencies
* No native `.node` binaries
* Works in Next.js + Webpack + Cloudflare Pages
* Keeps future compatibility for RVC-based Teto voice conversion

---

# 🚨 Root Problem Being Fixed

Current failure:

```text
kokoro-js
 → @huggingface/transformers
 → onnxruntime-node ❌ (native binaries)
 → Webpack build crash
```

We will eliminate this entire dependency chain.

---

# 🏗️ Target Architecture

## Final TTS Pipeline

```text
Text Input
 ↓
Kokoro ONNX Model
 ↓
onnxruntime-web (WebGPU / WASM)
 ↓
PCM Float32Array
 ↓
AudioBuffer
 ↓
WAV Blob Output
```

---

# 📦 Phase 1 — Remove Broken Dependencies

## [DELETE]

Remove from `package.json`:

* kokoro-js
* @huggingface/transformers (if only used for Kokoro)
* any direct onnxruntime-node dependency (if present)

## [CLEAN]

```bash
rm -rf node_modules package-lock.json .next
npm install
```

---

# 📁 Phase 2 — Install Correct Runtime

## Install browser-safe ONNX runtime

```bash
npm install onnxruntime-web
```

---

# 🧠 Phase 3 — Add Model Strategy

## Add local model storage

```text
/public/models/kokoro/
  ├── model.onnx
  ├── tokenizer.json
  ├── config.json
```

### Requirements:

* Must be ONNX export of Kokoro model
* Must NOT include node bindings
* Must be compatible with WebGPU/WASM

---

# 🧩 Phase 4 — Create TTS Engine (NEW)

## [NEW FILE] `src/lib/tts/kokoro.ts`

### Responsibilities:

* Load ONNX model using `onnxruntime-web`
* Run inference
* Convert output to PCM audio
* Return WAV Blob

### Core structure:

```ts
import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;

export async function loadModel() {
  if (session) return session;

  session = await ort.InferenceSession.create(
    "/models/kokoro/model.onnx",
    {
      executionProviders: ["webgpu", "wasm"]
    }
  );

  return session;
}
```

---

# ⚙️ Phase 5 — Audio Utilities

## [NEW FILE] `src/lib/tts/audioUtils.ts`

### Responsibilities:

* PCM → AudioBuffer
* AudioBuffer → WAV Blob
* Optional effects (pitch/EQ later)

### Must include:

* `float32ToWav()`
* `audioBufferToWav()`

Reuse existing utilities where possible.

---

# 🎙️ Phase 6 — Speech Generation Pipeline

## Function: `generateSpeech(text, voice?)`

### Flow:

```ts
loadModel()
↓
tokenize text
↓
run inference (ONNX)
↓
get waveform (Float32Array)
↓
convert to AudioBuffer
↓
export WAV Blob
```

---

# 🎛️ Phase 7 — Voice System (Basic Layer)

## [NEW FILE] `src/lib/tts/voices.ts`

```ts
export interface Voice {
  id: string;
  name: string;
  language: string;
}
```

## Initial voices (PLACEHOLDERS — NOT hardcoded assumptions):

```ts
export const voices: Voice[] = [
  { id: "jp_female_1", name: "Japanese Female (Default)", language: "ja" },
  { id: "en_female_1", name: "English Female", language: "en" }
];
```

⚠️ Actual voice behavior depends on Kokoro model export.

---

# 🧑‍💻 Phase 8 — UI Integration

## Modify `ConversionPanel.tsx`

### Replace:

* ❌ SpeechT5 import
* ❌ speaker embedding logic

### Add:

* Kokoro import
* Voice selector dropdown
* Loading state

### New behavior:

```text
Click Convert →
  load ONNX model →
  generate speech →
  play audio
```

---

# 🧪 Phase 9 — Debug & Verification

## Build checks:

```bash
npm run dev
npm run build
```

Must ensure:

* ❌ No `onnxruntime-node` in bundle
* ❌ No `.node` binary imports
* ✔ Only `onnxruntime-web`
* ✔ No SSR crashes

---

## Runtime tests:

### Test 1 — English

```
Hello, this is a test voice.
```

### Test 2 — Japanese

```
こんにちは、私はテストです。
```

### Test 3 — Offline behavior

* Refresh page
* Ensure cached model works

---

# 🚀 Phase 10 — Performance Requirements

Track:

* First load model time
* Cached load time
* Inference latency
* Memory usage

---

# 🔮 Phase 11 — Future RVC (DO NOT IMPLEMENT YET)

Prepare folder only:

```text
src/lib/rvc/
```

Future pipeline:

```text
Kokoro output
↓
RVC Teto model (ONNX/SVC)
↓
Final voice
```

---

# ❗ Critical Rules

* NEVER import `kokoro-js`
* NEVER allow `onnxruntime-node` in frontend
* NEVER rely on Node ML runtimes
* ALWAYS use `onnxruntime-web`
* ALL inference must be client-side

---

# 🎯 Success Criteria

Migration is successful when:

* SpeechT5 is fully removed
* kokoro-js is fully removed
* App builds without Webpack errors
* ONNX model runs in browser
* Voice generation works offline after first load
* Architecture is ready for RVC extension
