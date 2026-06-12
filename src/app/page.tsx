"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Download, RefreshCw, Cpu, Volume2, ShieldCheck, Heart } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioUploader } from "@/components/AudioUploader";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { ConversionPanel } from "@/components/ConversionPanel";
import { AudioInput, OutputAudio, ConversionState } from "@/types/audio";
import { decodeAudioToFloat32 } from "@/lib/audioUtils";
import { transcribeAudio, checkWebGPUSupport } from "@/lib/whisper";

export default function Home() {
  // Main Pipeline States
  const [audioInput, setAudioInput] = useState<AudioInput | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [outputAudio, setOutputAudio] = useState<OutputAudio | null>(null);
  const [conversionState, setConversionState] = useState<ConversionState>("idle");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [webGPUActive, setWebGPUActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Recorder Hook
  const {
    recordingState,
    duration,
    audioInput: recorderAudioInput,
    error: recorderError,
    startRecording,
    stopRecording,
    setAudioInput: setRecorderAudioInput,
    clearRecorder,
  } = useAudioRecorder();

  // Detect WebGPU support on mount
  useEffect(() => {
    const detectGPU = async () => {
      const hasWebGPU = await checkWebGPUSupport();
      setWebGPUActive(hasWebGPU);
    };
    detectGPU();
  }, []);

  // Sync recorder output to main audio input state
  useEffect(() => {
    if (recorderAudioInput) {
      setAudioInput(recorderAudioInput);
      setTranscript("");
      setOutputAudio(null);
      setError(null);
    }
  }, [recorderAudioInput]);

  // Handle errors from the recorder hook
  useEffect(() => {
    if (recorderError) {
      setError(recorderError);
    }
  }, [recorderError]);

  // Trigger ASR (Whisper transcription) automatically when audioInput becomes available
  useEffect(() => {
    if (!audioInput) return;

    const runTranscription = async () => {
      setConversionState("transcribing");
      setProgressMessage("Preparing audio for transcription...");
      setError(null);

      try {
        const float32Data = await decodeAudioToFloat32(audioInput.blob);
        const text = await transcribeAudio(float32Data, (msg) => {
          setProgressMessage(msg);
        });

        if (!text) {
          throw new Error("Transcriber did not return any speech content. Speak louder or upload a clearer file.");
        }

        setTranscript(text);
        setConversionState("idle");
      } catch (err: any) {
        console.error("Transcription pipeline error:", err);
        setError(err.message || "Failed to transcribe input audio.");
        setConversionState("idle");
      }
    };

    runTranscription();
  }, [audioInput]);

  // Handle manual audio upload
  const handleAudioUpload = (uploaded: AudioInput) => {
    // Clear recording state first
    clearRecorder();
    setRecorderAudioInput(null);

    setAudioInput(uploaded);
    setTranscript("");
    setOutputAudio(null);
    setError(null);
  };

  // Start synthesis pipeline
  const handleConvertStart = () => {
    setConversionState("synthesizing");
    setError(null);
  };

  // Synthesis finished successfully
  const handleConvertComplete = (output: OutputAudio) => {
    setOutputAudio(output);
    setConversionState("completed");
  };

  // Handle pipeline errors
  const handleConvertError = (errMsg: string) => {
    setError(errMsg);
    setConversionState("error");
  };

  // Clear/Reset entire app state
  const handleReset = () => {
    clearRecorder();
    setRecorderAudioInput(null);
    setAudioInput(null);
    setTranscript("");
    setOutputAudio(null);
    setConversionState("idle");
    setProgressMessage("");
    setError(null);
  };

  const handleDownload = () => {
    if (!outputAudio) return;
    const a = document.createElement("a");
    a.href = outputAudio.url;
    a.download = "teto-output.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0b0b0e] text-[#f1f1f5] flex flex-col font-sans selection:bg-pink-500/30 selection:text-pink-300">
      {/* Decorative cyber-punk glowing background spots */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/10 blur-[120px] pointer-events-none" />

      {/* Main Header / Navigation */}
      <header className="border-b border-white/[0.06] bg-[#0b0b0e]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Heart className="h-5 w-5 text-white fill-white/10" />
            </div>
            <div>
              <span className="text-lg font-black tracking-wider bg-gradient-to-r from-pink-400 via-rose-300 to-cyan-400 bg-clip-text text-transparent uppercase">
                TetoVoice
              </span>
              <span className="text-[10px] block font-mono text-white/30 tracking-tight uppercase leading-none">
                Local Speech Synth
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* WebGPU Status Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
              webGPUActive
                ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                : "bg-amber-950/20 text-amber-400 border-amber-500/10"
            }`}>
              <Cpu className="h-3.5 w-3.5" />
              {webGPUActive ? "WebGPU Enabled" : "Running on WASM"}
            </div>

            {/* Reset App */}
            {(audioInput || outputAudio) && (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 hover:text-white transition-all duration-200"
                title="Clear and Reset"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
        
        {/* Intro Hero */}
        <div className="text-center max-w-2xl mx-auto mb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            Convert Speech into a{" "}
            <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
              Teto-style
            </span>{" "}
            Voice
          </h1>
          <p className="text-sm md:text-base text-white/55 leading-relaxed">
            Record speech or upload audio to transcribe it, and synthesize it into a cute, high-pitched vocaloid-style output. Everything runs 100% locally in your browser.
          </p>
        </div>

        {/* Error panel */}
        {error && (
          <div className="w-full max-w-4xl mx-auto rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-start gap-3 shadow-lg shadow-red-950/5">
            <span className="font-bold shrink-0 uppercase tracking-wider text-xs bg-red-500/25 px-2 py-0.5 rounded border border-red-500/30">
              Error
            </span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto w-full">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-5 flex flex-col gap-6 w-full">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">
              Source Audio Input
            </h2>

            <AudioRecorder
              recordingState={recordingState}
              duration={duration}
              error={null} // Handled globally above
              startRecording={startRecording}
              stopRecording={stopRecording}
              audioInput={audioInput}
            />

            <div className="relative flex items-center justify-center">
              <span className="absolute left-0 right-0 h-px bg-white/[0.06]" />
              <span className="relative z-10 px-3 bg-[#0b0b0e] text-white/30 font-mono text-[10px] uppercase tracking-widest">
                OR
              </span>
            </div>

            <AudioUploader
              onAudioUpload={handleAudioUpload}
              audioInput={audioInput}
            />
          </div>

          {/* Right Column: Processing & Output */}
          <div className="lg:col-span-7 flex flex-col gap-6 w-full">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">
              Processing & Output
            </h2>

            {/* Step 1: Input Waveform Preview (shows if audio exists) */}
            {audioInput && (
              <WaveformPlayer
                audioUrl={audioInput.url}
                themeColor="cyan"
                title={`Source Preview: ${audioInput.name}`}
              />
            )}

            {/* Step 2: Transcript Box (shows if audio exists or transcription started) */}
            {(audioInput || conversionState === "transcribing") && (
              <TranscriptEditor
                value={transcript}
                onChange={setTranscript}
                isTranscribing={conversionState === "transcribing"}
                modelProgress={progressMessage}
              />
            )}

            {/* Step 3: Conversion Panel */}
            <ConversionPanel
              audioInput={audioInput}
              transcript={transcript}
              onConvertStart={handleConvertStart}
              onConvertComplete={handleConvertComplete}
              onConvertError={handleConvertError}
              conversionState={conversionState}
              progressMessage={progressMessage}
              setProgressMessage={setProgressMessage}
            />

            {/* Step 4: Output Player */}
            {outputAudio && (
              <div className="flex flex-col gap-3 animate-fadeIn">
                <WaveformPlayer
                  audioUrl={outputAudio.url}
                  themeColor="pink"
                  title="Generated Teto-style Voice"
                />

                <button
                  onClick={handleDownload}
                  className="w-full py-3.5 rounded-xl font-bold tracking-wider text-xs uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center gap-2 hover:border-pink-500/40 hover:text-pink-300 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/5 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Download teto-output.wav
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-white/[0.06] py-8 bg-[#070709] mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5 text-xs text-white/40">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>100% Client-Side Audio Processing. No audio or transcript leaves your device.</span>
          </div>
          <div className="text-[10px] text-white/20 leading-relaxed max-w-md">
            TetoVoice V1 uses Xenova/whisper-tiny.en for transcription and Kokoro-82M-v1.0-ONNX for text-to-speech. Post-processing filters are applied in-browser using Web Audio DSP. Kasane Teto is a trademark of Twin Drill.
          </div>
        </div>
      </footer>
    </div>
  );
}
