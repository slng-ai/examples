import { useCallback, useRef, useState } from "react";
import { floatTo16BitPCM } from "../lib/audio-utils";

type MicrophoneCallbacks = {
  onAudioData: (pcmData: ArrayBuffer) => void;
  onLog: (message: string) => void;
  onStatusChange: (message: string, isError?: boolean) => void;
};

export function useMicrophone(callbacks: MicrophoneCallbacks) {
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const stopRecording = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(
    async (sampleRate: number) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = stream;

        const audioContext = new AudioContext({ sampleRate });
        audioContextRef.current = audioContext;

        // Load the audio worklet processor
        await audioContext.audioWorklet.addModule("/audio-processor.js");

        const source = audioContext.createMediaStreamSource(stream);

        // Create analyser for waveform visualization
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event) => {
          const float32Data = event.data as Float32Array;
          const pcmData = floatTo16BitPCM(float32Data);
          callbacksRef.current.onAudioData(pcmData);
        };

        source.connect(analyser);
        analyser.connect(workletNode);
        workletNode.connect(audioContext.destination);

        setIsRecording(true);
        callbacksRef.current.onLog(
          `Microphone started: ${audioContext.sampleRate}Hz`
        );
        callbacksRef.current.onStatusChange("Recording...");
      } catch (err) {
        callbacksRef.current.onLog(
          `Microphone error: ${(err as Error).message}`
        );
        callbacksRef.current.onStatusChange(
          `Microphone access denied: ${(err as Error).message}`,
          true
        );
      }
    },
    []
  );

  return {
    startRecording,
    stopRecording,
    isRecording,
    analyserNode: analyserRef.current,
    analyserRef,
  };
}
