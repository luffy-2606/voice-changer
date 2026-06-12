"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";

interface WaveformPlayerProps {
  audioUrl: string;
  themeColor?: "cyan" | "pink";
  title?: string;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioUrl,
  themeColor = "cyan",
  title = "Audio Preview",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [duration, setDuration] = useState("00:00");

  const colors = {
    cyan: {
      waveColor: "rgba(6, 182, 212, 0.25)",
      progressColor: "#06b6d4",
      glowClass: "shadow-[0_0_15px_rgba(6,182,212,0.15)]",
      buttonBg: "from-cyan-500 to-teal-500 shadow-cyan-500/25",
    },
    pink: {
      waveColor: "rgba(236, 72, 153, 0.25)",
      progressColor: "#ec4899",
      glowClass: "shadow-[0_0_15px_rgba(236,72,153,0.15)]",
      buttonBg: "from-pink-500 to-rose-500 shadow-pink-500/25",
    },
  };

  const activeColors = colors[themeColor];

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: activeColors.waveColor,
      progressColor: activeColors.progressColor,
      cursorColor: activeColors.progressColor,
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      height: 64,
      normalize: true,
      backend: "WebAudio",
    });

    waveSurferRef.current = ws;

    // Load Audio URL and ignore abort errors if the component unmounts quickly
    ws.load(audioUrl).catch((err) => {
      if (err.name !== "AbortError") {
        console.error("WaveSurfer load error:", err);
      }
    });

    // Event Listeners
    ws.on("ready", () => {
      setDuration(formatTime(ws.getDuration()));
      setCurrentTime("00:00");
      setIsPlaying(false);
    });

    ws.on("audioprocess", () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    ws.on("interaction", () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => {
      setIsPlaying(false);
      ws.setTime(0);
      setCurrentTime("00:00");
    });

    // Cleanup on unmount
    return () => {
      ws.destroy();
    };
  }, [audioUrl, activeColors]);

  const handlePlayPause = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
    }
  };

  const handleReset = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.setTime(0);
      setCurrentTime("00:00");
      if (isPlaying) {
        waveSurferRef.current.play();
      }
    }
  };

  const handleMuteToggle = () => {
    if (waveSurferRef.current) {
      const currentMute = waveSurferRef.current.getMuted();
      waveSurferRef.current.setMuted(!currentMute);
      setIsMuted(!currentMute);
    }
  };

  return (
    <div className={`w-full rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md p-5 flex flex-col transition-all duration-300 hover:border-white/[0.1] ${activeColors.glowClass}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          {title}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-white/40 font-mono">
          <span className="text-white/70">{currentTime}</span>
          <span>/</span>
          <span>{duration}</span>
        </div>
      </div>

      {/* Waveform Container */}
      <div ref={containerRef} className="w-full my-2 relative" />

      {/* Controls Bar */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr text-white hover:scale-105 transition-all duration-200 shadow-md ${activeColors.buttonBg}`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-white" />
            ) : (
              <Play className="h-4 w-4 fill-white translate-x-0.5" />
            )}
          </button>

          {/* Reset/Restart Button */}
          <button
            onClick={handleReset}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/[0.06] hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200"
            aria-label="Restart Audio"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Volume Mute/Unmute */}
        <button
          onClick={handleMuteToggle}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/[0.06] hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200"
          aria-label={isMuted ? "Unmute Volume" : "Mute Volume"}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
