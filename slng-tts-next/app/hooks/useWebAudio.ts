import { useCallback, useRef } from "react";
import { pcmToFloat32 } from "../lib/audio-utils";

export function useWebAudio(sampleRate: number) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const nextPlayTimeRef = useRef(0);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate });
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(audioContextRef.current.destination);
      analyserNodeRef.current = analyser;
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, [sampleRate]);

  const playPcmChunk = useCallback(
    (bytes: Uint8Array) => {
      const ctx = ensureAudioContext();
      const float32 = pcmToFloat32(bytes);

      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyserNodeRef.current!);

      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now + 0.05;
      }

      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += float32.length / sampleRate;
    },
    [ensureAudioContext, sampleRate]
  );

  const closeAudio = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserNodeRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  }, []);

  const resetPlayTime = useCallback(() => {
    nextPlayTimeRef.current = 0;
  }, []);

  // Milliseconds of audio still scheduled to play. Because chunks are scheduled
  // ahead of `currentTime`, playback continues after the server stops sending.
  const getPlaybackRemainingMs = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return 0;
    return Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000);
  }, []);

  return {
    playPcmChunk,
    closeAudio,
    resetPlayTime,
    getPlaybackRemainingMs,
    analyserNodeRef,
    ensureAudioContext,
  };
}
