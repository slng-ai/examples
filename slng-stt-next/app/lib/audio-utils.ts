/**
 * Convert Float32 audio samples to Int16 PCM bytes.
 */
export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Base64-encode an ArrayBuffer. Chunks the conversion to avoid
 * `String.fromCharCode(...)` call-stack overflow on long buffers.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Convert Int16 PCM bytes to Float32 samples (for Web Audio playback).
 */
export function pcmToFloat32(pcmBytes: Uint8Array): Float32Array {
  const int16 = new Int16Array(
    pcmBytes.buffer,
    pcmBytes.byteOffset,
    pcmBytes.byteLength / 2
  );
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

/**
 * Decode an audio file (mp3, wav, etc.) to raw Float32 PCM using Web Audio API,
 * then resample to the target sample rate.
 */
export async function decodeAudioFile(
  file: File,
  targetSampleRate: number
): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const offlineCtx = new OfflineAudioContext(1, 1, targetSampleRate);
  const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

  // Resample to target rate
  const offlineResample = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );
  const source = offlineResample.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineResample.destination);
  source.start(0);

  const resampled = await offlineResample.startRendering();
  return resampled.getChannelData(0);
}
