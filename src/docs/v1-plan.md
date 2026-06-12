# TetoVoice V1 — Implementation Plan

## Goal

Build a **100% client-side** web app that converts a user’s spoken audio into a **Teto-style** voice.

Important:
- No backend.
- No user accounts.
- No audio sent to any server.
- All transcription, synthesis, and post-processing must run in the browser.
- Target modern Chromium browsers first.
- Use WebGPU when available, otherwise fall back to WASM.

## Critical model decision

Do **not** use official Teto UTAU or Synthesizer V voice assets as the base of this app.

Use this instead:
- **Base TTS model:** `onnx-community/Kokoro-82M-v1.0-ONNX`
- **Reason:** it already exists as ONNX, has a permissive license, and has a small quantized variant suitable for browser delivery.
- **Target file:** `model_quantized.onnx` only.

This app is not “true Teto voicebank playback.”
This app is:
- speech → transcript → TTS → post-processing → “Teto-style” output

## Non-negotiable constraints

Cursor must follow these rules exactly:

1. Keep the app fully client-side.
2. Use static hosting only.
3. Do not add any API routes.
4. Do not add any server actions.
5. Do not add database code.
6. Do not add authentication.
7. Do not add analytics that send audio or transcript data anywhere.
8. Do not load ML models on page load.
9. Load models lazily only when the user actually records/uploads and converts.
10. Do not use placeholder TTS code. Implement the real inference path.
11. Do not depend on any official Teto voicebank files.
12. Do not assume “Teto” means an exact clone. The V1 result should be “Teto-style.”

## Recommended stack

- Next.js 15
- React
- TypeScript
- Tailwind CSS
- `@huggingface/transformers`
- `onnxruntime-web`
- `wavesurfer.js`
- Web Audio API
- MediaRecorder API

## Required architecture

### Input path
- Record microphone audio
- Upload `.wav`, `.mp3`, `.m4a`, `.webm`

### Processing path
1. Convert input audio into transcript using Whisper.
2. Allow the user to edit transcript.
3. Generate speech from transcript using Kokoro ONNX.
4. Apply light client-side post-processing to make the voice more “Teto-like.”

### Output path
- Playback generated audio
- Download generated audio as `.wav`

---

# Exact implementation steps

## Step 1 — Create the app shell

Create a single-page layout with these sections:
- Header
- Record button
- Upload area
- Waveform preview
- Transcript editor
- Convert button
- Output audio player
- Download button
- Status / loading indicators

Acceptance criteria:
- Page loads instantly.
- No models load on initial page render.
- UI works on mobile and desktop.

## Step 2 — Implement audio capture and upload

Create:
- `src/hooks/useAudioRecorder.ts`
- `src/components/AudioRecorder.tsx`
- `src/components/AudioUploader.tsx`

Requirements:
- Use `navigator.mediaDevices.getUserMedia()` for microphone access.
- Use `MediaRecorder` for recording.
- Save recorded audio as a `Blob`.
- Accept only supported audio files.
- Reject unsupported files with a clear error.
- Keep recorded/uploaded audio in React state.

Acceptance criteria:
- Recording starts/stops reliably.
- Uploaded files appear in the UI.
- A recording or upload can be used as the conversion source.

## Step 3 — Add waveform preview and playback

Create:
- `src/components/WaveformPlayer.tsx`

Requirements:
- Use `wavesurfer.js`.
- Show waveform for recorded and uploaded audio.
- Provide play, pause, and seek controls.
- Also reuse the same player for generated output audio.

Acceptance criteria:
- User can preview source audio.
- User can preview generated audio.
- Switching between source and output audio works.

## Step 4 — Add Whisper transcription

Create:
- `src/lib/whisper.ts`

Requirements:
- Use `@huggingface/transformers`.
- Default model: `Xenova/whisper-tiny.en`
- Transcribe only after audio input exists.
- Return plain transcript text.
- Show model-loading progress and transcription progress.
- Keep transcription client-side only.

Implementation rules:
- Prefer `device: "webgpu"` when WebGPU is available.
- Fall back to WASM automatically when WebGPU is unavailable.
- Cache the model instance in memory.
- Do not re-download the model after the first use.

Acceptance criteria:
- Audio input produces a transcript.
- Transcript appears in the editor.
- No network request is made after the model is cached, except normal browser model loading from the static host/HF cache path.

## Step 5 — Add transcript editing

Create:
- `src/components/TranscriptEditor.tsx`

Requirements:
- Editable textarea.
- User can fix punctuation, spelling, and wording.
- The edited text must be the text used for synthesis.
- If transcript is empty, block conversion and show an error.

Acceptance criteria:
- Editing text changes the final output.
- Convert button uses the edited version only.

## Step 6 — Implement the TTS engine

Create:
- `src/lib/tetoTTS.ts`

Requirements:
- Use the ONNX model `onnx-community/Kokoro-82M-v1.0-ONNX`.
- Load only `model_quantized.onnx`.
- Use `onnxruntime-web` or `@huggingface/transformers`.
- Return generated audio as a `Blob` or `AudioBuffer`.
- Keep the TTS implementation isolated behind one function:
  - `generateTetoSpeech(text: string): Promise<AudioBlob>`

Important:
- Do not hardcode the voice as “Teto.”
- Make the model choice swappable later.
- For V1, the base voice should be a Japanese female voice that is then post-processed to feel more synthetic and Teto-like.

Acceptance criteria:
- A transcript can be synthesized into speech.
- Output is playable in the browser.
- Output is generated without any server.

## Step 7 — Add Teto-style post-processing

Create:
- `src/lib/audioUtils.ts`

Requirements:
Apply light client-side post-processing to the generated TTS audio to make it more “Teto-style.”

Use:
- slight pitch increase
- slight formant/brightness emphasis
- subtle speed adjustment only if needed
- avoid heavy distortion
- keep speech intelligible

Rules:
- Keep the effect subtle.
- Do not destroy clarity.
- The goal is “Teto-like,” not a broken robot voice.

Acceptance criteria:
- Processed output sounds brighter and more synthetic than the raw TTS output.
- Speech remains intelligible.

## Step 8 — Add conversion controller

Create:
- `src/components/ConversionPanel.tsx`

Requirements:
- Centralize the pipeline:
  1. source audio exists
  2. transcribe it
  3. let the user edit transcript
  4. synthesize audio
  5. post-process output
  6. display playable result
- Disable the Convert button while work is running.
- Show clear progress messages:
  - Loading Whisper
  - Transcribing
  - Loading TTS
  - Synthesizing
  - Applying Teto-style effects
  - Finalizing output

Acceptance criteria:
- One button runs the full flow.
- Errors are shown clearly.
- The UI never freezes without feedback.

## Step 9 — Add download

Requirements:
- Allow downloading the generated audio as `teto-output.wav`.
- Use `URL.createObjectURL()`.
- Add a normal anchor download flow.
- Keep it fully client-side.

Acceptance criteria:
- Downloaded file plays locally.
- Filename is correct.

## Step 10 — Add backend-free deployment safety

Requirements:
- Do not introduce any API endpoints.
- Do not introduce server-side audio handling.
- Ensure deployment works as a static site.
- Confirm the app can be hosted on Cloudflare Pages or similar static hosts.

Acceptance criteria:
- Build succeeds in static export mode if the chosen Next.js setup requires it.
- No server dependency is required to use the app.

## Step 11 — Add model loading policy

Implement this exact loading policy:

- Load Whisper only after the first audio is recorded or uploaded.
- Load TTS only when the user presses Convert.
- Show a model download/loading indicator during the first load.
- Reuse cached model instances after the first load.
- Never load both large models on page open.

Acceptance criteria:
- First page load is fast.
- Model downloads happen only when needed.

## Step 12 — Add runtime detection

Requirements:
- Detect `navigator.gpu`.
- If available, prefer WebGPU.
- Otherwise use WASM.
- Show a small label in the UI:
  - `WebGPU Enabled`
  - `Running on WASM`

Acceptance criteria:
- Label matches runtime behavior.
- App still works without WebGPU.

## Step 13 — Add error handling

Handle these errors:
- Microphone permission denied
- Unsupported browser
- Invalid audio file
- Whisper load failure
- Whisper transcription failure
- TTS model load failure
- TTS synthesis failure
- Empty transcript
- Audio export failure

Rules:
- Show readable messages.
- Do not show stack traces to the user.
- Do not crash the whole page.

## Step 14 — Add verification

Cursor must verify:
- `pnpm build`
- `pnpm lint`

Manual checks:
- Record audio
- Upload audio
- Transcribe audio
- Edit transcript
- Convert audio
- Play output
- Download output
- Confirm no backend requests are required for app function

## Step 15 — Keep V1 scope tight

Do not add these in V1:
- login
- cloud sync
- user accounts
- real-time voice conversion
- singing synthesis
- custom model training UI
- multi-language support
- mixing console
- advanced voice presets

V1 is only:
- speech input
- transcript generation
- editable transcript
- TTS generation
- Teto-style post-processing
- playback
- download

---

# File list Cursor should create

- `src/app/page.tsx`
- `src/components/AudioRecorder.tsx`
- `src/components/AudioUploader.tsx`
- `src/components/WaveformPlayer.tsx`
- `src/components/TranscriptEditor.tsx`
- `src/components/ConversionPanel.tsx`
- `src/hooks/useAudioRecorder.ts`
- `src/lib/whisper.ts`
- `src/lib/tetoTTS.ts`
- `src/lib/audioUtils.ts`
- `src/types/audio.ts`

Optional:
- `next.config.ts`
- `src/lib/modelLoader.ts`

---

# Final acceptance criteria

The app is done when:

1. A user records or uploads audio.
2. The app transcribes it locally.
3. The user can edit the transcript.
4. The app synthesizes speech locally using the ONNX TTS model.
5. The output is post-processed to sound more Teto-like.
6. The output can be played and downloaded.
7. Everything works in the browser without a backend.

That is the exact V1.
