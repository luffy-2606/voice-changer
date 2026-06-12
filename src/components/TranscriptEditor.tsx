"use client";

import React from "react";
import { Edit2, Sparkles } from "lucide-react";

interface TranscriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  isTranscribing: boolean;
  modelProgress?: string;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  value,
  onChange,
  isTranscribing,
  modelProgress,
}) => {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <div className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md p-6 flex flex-col transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Edit2 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
            Transcript Editor
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/40 font-mono">
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} characters</span>
        </div>
      </div>

      <div className="relative w-full">
        {isTranscribing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl border border-cyan-500/20 z-10 transition-all duration-300">
            <div className="h-8 w-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-3" />
            <span className="text-sm text-cyan-300 font-medium animate-pulse flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Transcribing audio...
            </span>
            {modelProgress && (
              <span className="text-[10px] text-white/40 font-mono mt-1 px-4 text-center max-w-[80%] truncate">
                {modelProgress}
              </span>
            )}
          </div>
        ) : null}

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isTranscribing}
          placeholder="Your speech transcript will appear here. You can manually edit it before converting to Teto-style voice..."
          className="w-full h-32 rounded-xl bg-black/35 border border-white/[0.06] p-4 text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200 resize-none font-sans leading-relaxed"
        />
      </div>

      <p className="text-[11px] text-white/40 mt-2 italic">
        *Tip: Edit the transcript directly in this box. Teto will speak the updated text exactly.
      </p>
    </div>
  );
};
