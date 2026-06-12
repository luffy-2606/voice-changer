"use client";

import React, { useState, useEffect } from "react";
import { Play, Sparkles, Sliders, Volume2, HelpCircle } from "lucide-react";
import { AudioInput, OutputAudio, ConversionState } from "@/types/audio";
import { generateTetoSpeech, preloadTTSModels } from "@/lib/tetoTTS";
import { decodeAudioToBuffer, applyTetoEffects, audioBufferToWav } from "@/lib/audioUtils";

interface ConversionPanelProps {
  audioInput: AudioInput | null;
  transcript: string;
  onConvertStart: () => void;
  onConvertComplete: (output: OutputAudio) => void;
  onConvertError: (error: string) => void;
  conversionState: ConversionState;
  progressMessage: string;
  setProgressMessage: (msg: string) => void;
}

export const ConversionPanel: React.FC<ConversionPanelProps> = ({
  audioInput,
  transcript,
  onConvertStart,
  onConvertComplete,
  onConvertError,
  conversionState,
  progressMessage,
  setProgressMessage,
}) => {
  // Custom DSP Sliders
  const [pitchShift, setPitchShift] = useState<number>(3.0); // +3 semitones
  const [brightness, setBrightness] = useState<number>(5.0); // +5 dB treble boost
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Pre-warm all TTS models in background on mount
  useEffect(() => {
    preloadTTSModels().catch(() => {
      // Silent — errors will surface properly when the user clicks Convert
    });
  }, []);

  const handleConvert = async () => {
    if (!transcript.trim()) {
      onConvertError("Transcript is empty. Please enter some text to synthesize.");
      return;
    }

    onConvertStart();
    setProgressMessage("Loading TTS Model...");

    try {
      // Step 1: Synthesize Raw Speech (returns raw WAV Blob)
      const rawWavBlob = await generateTetoSpeech(transcript, (msg) => {
        setProgressMessage(msg);
      });

      // Step 2: Decode Raw WAV back to AudioBuffer for DSP post-processing
      setProgressMessage("Decoding audio for DSP...");
      const rawBuffer = await decodeAudioToBuffer(rawWavBlob);

      // Step 3: Apply pitch-shifting and treble/brightness filtering
      setProgressMessage("Applying Teto-style effects...");
      const processedBuffer = await applyTetoEffects(rawBuffer, pitchShift, brightness);

      // Step 4: Encode the processed buffer back to WAV
      setProgressMessage("Finalizing output...");
      const processedBlob = audioBufferToWav(processedBuffer);
      const processedUrl = URL.createObjectURL(processedBlob);

      onConvertComplete({
        blob: processedBlob,
        url: processedUrl,
        duration: processedBuffer.duration,
      });

    } catch (err: any) {
      console.error("Conversion error:", err);
      onConvertError(err.message || "An error occurred during speech conversion.");
    }
  };

  const isIdle = conversionState === "idle" || conversionState === "completed" || conversionState === "error";
  const isProcessing = !isIdle;
  const isInputReady = !!audioInput && !!transcript.trim() && isIdle;

  const getStatusColor = () => {
    switch (conversionState) {
      case "transcribing":
        return "border-cyan-500/20 text-cyan-400";
      case "synthesizing":
      case "processing":
        return "border-pink-500/20 text-pink-400";
      default:
        return "border-white/10 text-white/55";
    }
  };

  return (
    <div className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md p-6 flex flex-col gap-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-pink-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
            Conversion Pipeline
          </h3>
        </div>

        {/* Settings toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          disabled={isProcessing}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border border-white/10 transition-all duration-200 ${
            showSettings
              ? "bg-white/10 text-white"
              : "bg-white/0 text-white/50 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Tuning Parameters
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-xl bg-black/30 border border-white/[0.05] p-4 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs text-white/60 font-semibold uppercase tracking-wider">
            <Sliders className="h-3.5 w-3.5 text-pink-400" />
            Teto voice custom settings
          </div>

          {/* Pitch Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-white/50">Pitch Shift (Semitones)</span>
              <span className="text-pink-400 font-medium">+{pitchShift.toFixed(1)} ST</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.5"
              value={pitchShift}
              onChange={(e) => setPitchShift(parseFloat(e.target.value))}
              className="w-full accent-pink-500 h-1.5 bg-white/10 rounded-lg cursor-pointer appearance-none"
            />
            <span className="text-[10px] text-white/30">
              Higher shifts make the voice sound more high-pitched/robotic. Default is +3.0 ST.
            </span>
          </div>

          {/* Brightness Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-white/50">Vocal Brightness (Formant Treble)</span>
              <span className="text-pink-400 font-medium">+{brightness.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="12.0"
              step="1.0"
              value={brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
              className="w-full accent-pink-500 h-1.5 bg-white/10 rounded-lg cursor-pointer appearance-none"
            />
            <span className="text-[10px] text-white/30">
              Boosts high frequencies to add the characteristic vocaloid metallic sparkle.
            </span>
          </div>
        </div>
      )}

      {/* Pipeline Status Indicator */}
      {isProcessing && (
        <div className={`w-full border rounded-xl bg-white/[0.01] p-4 text-center font-mono text-xs flex flex-col gap-3 items-center justify-center ${getStatusColor()}`}>
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            <span className="font-semibold uppercase tracking-wider animate-pulse">
              {conversionState === "transcribing" ? "Transcribing Input..." : "Converting to Teto..."}
            </span>
          </div>
          <span className="text-white/60 font-sans tracking-normal">{progressMessage}</span>
        </div>
      )}

      {/* Conversion Button */}
      <button
        onClick={handleConvert}
        disabled={!isInputReady}
        className={`w-full py-4 rounded-xl font-bold tracking-wider uppercase text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
          isInputReady
            ? "bg-gradient-to-r from-pink-500 via-rose-500 to-pink-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-pink-500/20 hover:shadow-pink-500/35 hover:-translate-y-0.5 cursor-pointer"
            : "bg-white/5 text-white/20 border border-white/[0.05] cursor-not-allowed"
        }`}
      >
        <Sparkles className="h-4 w-4" />
        Convert to Teto-style Voice
      </button>

      {!audioInput && (
        <p className="text-[11px] text-white/30 text-center">
          *Record or upload an audio file to start.
        </p>
      )}
      {audioInput && !transcript.trim() && isIdle && (
        <p className="text-[11px] text-yellow-500/70 text-center animate-pulse">
          *Waiting for speech transcription to finish.
        </p>
      )}
    </div>
  );
};
