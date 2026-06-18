"use client";

import { useEffect, useRef } from "react";

type WaveformCanvasProps = {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
};

export function WaveformCanvas({
  analyserNode,
  isActive,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
    }

    function drawIdle() {
      resizeCanvas();
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.width;
      const h = canvas!.height;

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "rgba(202, 201, 196, 0.6)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }

    function drawWaveform() {
      if (!analyserNode) return;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.width;
      const h = canvas!.height;

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2.5 * dpr;
      ctx.strokeStyle = "#fbe566";
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      animIdRef.current = requestAnimationFrame(drawWaveform);
    }

    if (isActive && analyserNode) {
      resizeCanvas();
      drawWaveform();
    } else {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      drawIdle();
    }

    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [analyserNode, isActive]);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-secondary">
      <canvas ref={canvasRef} className="block h-20 w-full" />
    </div>
  );
}
