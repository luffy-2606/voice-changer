import { useState, useRef, useEffect, useCallback } from "react";
import { RecordingState, AudioInput } from "@/types/audio";

export function useAudioRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState<number>(0);
  const [audioInput, setAudioInput] = useState<AudioInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Failed to stop media recorder during cleanup:", err);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    cleanup();
    setError(null);
    chunksRef.current = [];
    setDuration(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported by your browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine MIME type
      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/mp4" };
        if (!MediaRecorder.isTypeSupported("audio/mp4")) {
          // Fallback to default
          options = { mimeType: "" };
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const name = `Recording_${new Date().toLocaleTimeString()}.webm`;

        setAudioInput({
          blob,
          url,
          name,
          duration: durationRef.current, // Use ref to capture latest duration
        });

        // Clean up tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250); // Slice every 250ms
      setRecordingState("recording");

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(() => {
          const seconds = Math.round((Date.now() - startTime) / 1000);
          durationRef.current = seconds; // sync ref
          return seconds;
        });
      }, 1000);

    } catch (err: any) {
      console.error("Error starting recording:", err);
      setError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone permission denied. Please allow microphone access to record."
          : err.message || "Failed to start recording. Please try again."
      );
      setRecordingState("idle");
    }
  }, [cleanup]);

  // Use a ref to capture the absolute latest duration across async boundaries
  const durationRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingState("idle");
    }
  }, [recordingState]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    recordingState,
    duration,
    audioInput,
    error,
    startRecording,
    stopRecording,
    setAudioInput,
    clearRecorder: cleanup,
  };
}
