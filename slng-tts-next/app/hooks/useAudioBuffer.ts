import { useCallback, useRef } from "react";

export function useAudioBuffer() {
  const chunksRef = useRef<Uint8Array[]>([]);
  const bytesTotalRef = useRef(0);
  const audioEndSeenRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    chunksRef.current = [];
    bytesTotalRef.current = 0;
    audioEndSeenRef.current = false;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const appendChunk = useCallback((bytes: Uint8Array) => {
    chunksRef.current.push(bytes);
    bytesTotalRef.current += bytes.byteLength;
  }, []);

  const flush = useCallback((): Uint8Array | null => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) return null;

    const combined = new Uint8Array(bytesTotalRef.current);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    chunksRef.current = [];
    bytesTotalRef.current = 0;
    audioEndSeenRef.current = false;

    return combined;
  }, []);

  const scheduleFlush = useCallback(
    (onFlush: (bytes: Uint8Array) => void, force = false) => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        if (audioEndSeenRef.current || force) {
          const combined = flush();
          if (combined) onFlush(combined);
        }
      }, 200);
    },
    [flush]
  );

  const markAudioEnd = useCallback(() => {
    audioEndSeenRef.current = true;
  }, []);

  return { appendChunk, flush, reset, scheduleFlush, markAudioEnd };
}
