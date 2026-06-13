# TetoVoice V2 Migration Plan

## Replace SpeechT5 with Kokoro and Prepare for Future Teto Voice Conversion

### Objective

The current implementation uses SpeechT5 + HiFiGAN + CMU speaker embeddings. While technically functional, the resulting voice sounds robotic and does not resemble Kasane Teto.

The goal of this migration is to:

* Maintain 100% client-side execution
* Maintain offline capability after initial download
* Improve voice quality significantly
* Create an architecture that can later support Teto voice conversion (RVC / So-VITS / Bert-VITS)
* Remove dependence on SpeechT5 speaker embeddings

---

# Phase 1 — Remove SpeechT5

## Current Architecture

```text
Text
 ↓
SpeechT5
 ↓
CMU Speaker Embedding
 ↓
HiFiGAN
 ↓
WAV
```

## Problems

* Robotic output
* Male speaker voice
* No resemblance to Kasane Teto
* Speaker embeddings only alter identity slightly
* Cannot realistically achieve Teto-like voice

## Tasks

### Delete

* SpeechT5ForTextToSpeech
* SpeechT5HifiGan
* Speaker embedding logic
* cmu_us_awb_arctic speaker profile
* generate_speech pipeline

### Remove

```ts
getSpeakerEmbeddings()
```

```ts
getTTSModel()
```

```ts
getVocoder()
```

Any SpeechT5-specific caching logic should be removed.

---

# Phase 2 — Integrate Kokoro

## Goal

Replace SpeechT5 with Kokoro TTS.

Target architecture:

```text
Text
 ↓
Kokoro
 ↓
PCM Audio
 ↓
WAV Blob
```

## Requirements

### Must remain

* Browser-only
* No backend
* No API calls
* No server processing
* Cloudflare Pages compatible

### Must support

* WebGPU
* WASM fallback
* Offline caching

---

# Phase 3 — Create New TTS Service Layer

Create:

```text
src/lib/tts/
├── kokoro.ts
├── modelLoader.ts
├── audioUtils.ts
```

## Responsibilities

### modelLoader.ts

Responsible for:

* Loading Kokoro model
* Download progress tracking
* Model caching
* IndexedDB/browser caching

### kokoro.ts

Responsible for:

* Text generation
* Voice selection
* Audio generation
* WAV export

---

# Phase 4 — Model Storage Strategy

Store all model assets locally.

Example:

```text
public/
└── models/
    └── kokoro/
        ├── model.onnx
        ├── tokenizer.json
        ├── voices/
```

No runtime dependency on external Hugging Face URLs after deployment.

---

# Phase 5 — Voice Selection System

Create a voice abstraction layer.

Example:

```ts
interface Voice {
  id: string;
  name: string;
  language: string;
}
```

Future-proof the architecture.

Example:

```ts
voices = [
  {
    id: "jp_female_1",
    name: "Japanese Female"
  },
  {
    id: "jp_female_2",
    name: "Japanese Female Soft"
  }
]
```

The UI should allow easy voice switching.

---

# Phase 6 — Quality Testing

Test:

## English

```text
Hello, my name is Kasane Teto.
```

## Japanese

```text
こんにちは、私は重音テトです。
```

Evaluate:

* Naturalness
* Pitch
* Speed
* Female voice quality
* Similarity to anime-style speech

Document findings.

---

# Phase 7 — Audio Post Processing

Add optional effects pipeline.

```text
Generated Audio
 ↓
Pitch Shift
 ↓
EQ
 ↓
Limiter
 ↓
Output
```

Potential controls:

* Pitch
* Speed
* Brightness
* Character

Goal:

Make voices sound more anime-like.

---

# Phase 8 — Future Teto Conversion Preparation

Do NOT implement yet.

Prepare architecture for:

```text
Text
 ↓
Kokoro
 ↓
Neutral Audio
 ↓
Voice Conversion
 ↓
Kasane Teto Voice
```

Future folder structure:

```text
src/lib/rvc/
```

Placeholder only.

No implementation yet.

---

# Phase 9 — Performance Optimization

After Kokoro works:

### Add

* Lazy model loading
* IndexedDB persistence
* Download progress UI
* Memory cleanup
* Audio caching

### Ensure

* Fast repeat generations
* Minimal memory leaks
* Smooth browser experience

---

# Success Criteria

The migration is successful when:

* SpeechT5 is completely removed
* Kokoro generates speech locally
* No external API calls exist
* No backend is required
* Cloudflare Pages deployment works
* Voice quality is significantly better than SpeechT5
* Architecture is prepared for future Teto voice conversion integration

# Important Notes

Do NOT spend time improving SpeechT5.

The project should fully pivot toward Kokoro as the new TTS foundation.

Voice conversion (RVC / So-VITS / Bert-VITS) is a future phase and should not be implemented during this migration.

Focus entirely on:

1. Replacing SpeechT5.
2. Improving base voice quality.
3. Building a clean foundation for future Teto voice conversion.
