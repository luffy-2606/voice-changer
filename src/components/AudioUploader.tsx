"use client";

import React, { useState, useRef } from "react";
import { Upload, FileAudio, AlertCircle } from "lucide-react";
import { AudioInput } from "@/types/audio";

interface AudioUploaderProps {
  onAudioUpload: (audio: AudioInput) => void;
  audioInput: AudioInput | null;
}

const SUPPORTED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/x-wav", "audio/ogg"];
const SUPPORTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".webm"];

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onAudioUpload,
  audioInput,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);

    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidType = SUPPORTED_TYPES.includes(file.type);
    const isValidExtension = SUPPORTED_EXTENSIONS.includes(fileExtension);

    if (!isValidType && !isValidExtension) {
      setError(`Unsupported file type. Please upload a ${SUPPORTED_EXTENSIONS.join(", ")} file.`);
      return;
    }

    // Load audio file to extract duration
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);

    audio.onloadedmetadata = () => {
      onAudioUpload({
        blob: file,
        url,
        name: file.name,
        duration: audio.duration,
      });
    };

    audio.onerror = () => {
      setError("Failed to parse audio file. The file might be corrupted.");
    };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={`w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-md min-h-[160px] ${
        isDragging
          ? "border-cyan-400 bg-cyan-950/20 scale-[1.01]"
          : audioInput
          ? "border-cyan-500/40 bg-white/[0.03] hover:border-cyan-500/60"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={SUPPORTED_EXTENSIONS.join(",")}
        className="hidden"
      />

      <div className="text-center flex flex-col items-center gap-2">
        <div className={`p-3 rounded-full ${isDragging || audioInput ? "bg-cyan-500/10 text-cyan-400" : "bg-white/5 text-white/50"}`}>
          {audioInput ? <FileAudio className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
            {audioInput ? "Change Audio File" : "Upload Audio"}
          </h3>
          <p className="text-xs text-white/40 mt-1">
            Drag and drop your audio file here, or click to browse
          </p>
        </div>

        <div className="text-xs text-white/30 font-mono mt-1">
          Supports WAV, MP3, M4A, WEBM
        </div>

        {audioInput && (
          <div className="mt-2 text-xs font-semibold text-cyan-400 bg-cyan-950/30 px-3 py-1.5 rounded-full border border-cyan-800/40">
            Selected: {audioInput.name}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 onClick-stop-propagation" onClick={(e) => e.stopPropagation()}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
