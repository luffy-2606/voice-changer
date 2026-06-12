"use client";

import React from "react";
import { Mic, Square, AlertCircle } from "lucide-react";
import { RecordingState, AudioInput } from "@/types/audio";

interface AudioRecorderProps {
  recordingState: RecordingState;
  duration: number;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  audioInput: AudioInput | null;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  recordingState,
  duration,
  error,
  startRecording,
  stopRecording,
  audioInput,
}) => {
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const isRecording = recordingState === "recording";

  return (
    <div className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md p-6 flex flex-col items-center justify-center transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="mb-4 text-center">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
          Record Audio
        </h3>
        <p className="text-xs text-white/40 mt-1">Record your voice directly using the microphone</p>
      </div>

      <div className="relative flex items-center justify-center my-6">
        {isRecording && (
          <span className="absolute inline-flex h-24 w-24 rounded-full bg-pink-500/20 animate-ping" />
        )}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 shadow-lg ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 scale-95"
              : "bg-gradient-to-tr from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-pink-500/30 hover:scale-105"
          }`}
          aria-label={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? (
            <Square className="h-8 w-8 animate-pulse" />
          ) : (
            <Mic className="h-9 w-9" />
          )}
        </button>
      </div>

      <div className="text-center">
        {isRecording ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-mono font-medium tracking-widest text-pink-400">
              {formatTime(duration)}
            </span>
            <span className="text-xs text-white/50 animate-pulse">Recording...</span>
          </div>
        ) : audioInput ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm text-pink-300 font-medium">Recording saved</span>
            <span className="text-xs text-white/40 font-mono">
              Duration: {formatTime(audioInput.duration)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-white/50">Ready to record</span>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
