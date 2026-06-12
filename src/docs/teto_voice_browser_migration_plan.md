# 🧠 Teto Voice Project — Implementation Plan (Browser-Only AI Stack Migration)

This document is meant for Cursor AI / developer execution to fully migrate the project into a 100% client-side compatible AI voice application.

---

# 🚨 CRITICAL CONTEXT (DO NOT SKIP)

The project is currently broken due to an incorrect dependency chain:

kokoro-js
  → @huggingface/transformers
    → onnxruntime-node ❌
      → native .node binaries ❌

### ❌ Root Issue

- `.node` files are native C++ binaries
- Browser cannot execute native binaries
- Webpack cannot convert them into JS
- This is NOT a build config issue — it is a runtime mismatch

---

# 🧠 CORE RULE FOR THIS PROJECT

This is a strictly browser-only AI application.

That means:

- NO Node.js runtime dependencies in frontend
- NO native binaries
- NO file-system based libraries
- NO onnxruntime-node

---

# 🟢 TARGET ARCHITECTURE (FINAL STATE)

Microphone / Audio Input
        ↓
Web Audio API
        ↓
Whisper (onnxruntime-web / WASM)
        ↓
Text Output
        ↓
Browser TTS Model (ONNX WebGPU/WASM)
        ↓
Audio Playback (Web Audio API)

---

# 🧹 STEP 1 — REMOVE ALL BROKEN DEPENDENCIES

npm uninstall kokoro-js
npm uninstall onnxruntime-node
npm uninstall @huggingface/transformers

---

# 🧼 STEP 2 — INSTALL BROWSER-SAFE STACK

npm install onnxruntime-web

Optional:
npm install @huggingface/transformers

---

# 🧨 STEP 3 — DELETE ALL WEBPACK NATIVE CONFIG

Remove:

- file-loader rules for .node
- onnxruntime-node handling
- wasm experimental loaders for node bindings
- resolve.fullySpecified
- alias overrides for ML libs

---

# 🧠 STEP 4 — REPLACE TTS IMPLEMENTATION

import { pipeline } from "@huggingface/transformers";

let ttsPipeline;

export async function initTTS() {
  if (!ttsPipeline) {
    ttsPipeline = await pipeline(
      "text-to-speech",
      "Xenova/speecht5_tts",
      { device: "webgpu" }
    );
  }
  return ttsPipeline;
}

---

# 🔊 STEP 5 — AUDIO OUTPUT

Use:

- Web Audio API
- AudioBufferSourceNode
- Blob URLs

---

# 🧩 STEP 6 — STRICT RULES

Allowed:

- React
- Web Audio API
- transformers.js (browser mode)

NOT allowed:

- onnxruntime-node
- kokoro-js
- fs/path
- native binaries

---

# 🚀 STEP 7 — CLEAN REBUILD

rm -rf node_modules
rm -rf .next
npm install
npm run dev

---

# 🎯 FINAL RESULT

✔ 100% browser AI stack
✔ No Node dependencies
✔ No native binaries
✔ Deployable anywhere