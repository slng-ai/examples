import { bufferToBase64 } from "./audio-utils";

export type InitConfigInput = {
  sampleRate: number;
  language: string;
  encoding: string;
  enablePartials: boolean;
};

export type WireProtocol = {
  // Identifier used by UI to pick code samples / docs.
  name: "default" | "soniox-direct" | "sarvam";
  // Returns the init message object, or null to skip init entirely.
  buildInitMessage: (input: InitConfigInput) => Record<string, unknown> | null;
  // Optional: rewrite the WS URL (e.g. append query params).
  buildUrl?: (baseUrl: string, input: InitConfigInput) => string;
  // Optional: wrap a PCM16 chunk before sending. Default: raw binary.
  wrapAudio?: (pcm: ArrayBuffer, input: InitConfigInput) => string | ArrayBuffer;
  // Optional: mid-stream finalize signal. Default: {"type":"finalize"}.
  finalizeText?: string;
  // Optional raw text frame sent before closing the socket.
  closeText?: string;
};

const DEFAULT_PROTOCOL: WireProtocol = {
  name: "default",
  buildInitMessage: ({ sampleRate, language, encoding, enablePartials }) => {
    const c: Record<string, unknown> = {
      encoding,
      sample_rate: sampleRate,
      language,
    };
    if (enablePartials) c.enable_partial_transcripts = true;
    return { type: "init", config: c };
  },
};

const SONIOX_DIRECT_PROTOCOL: WireProtocol = {
  name: "soniox-direct",
  buildInitMessage: ({ sampleRate, language, enablePartials }) => ({
    model: "stt-rt-v4",
    audio_format: "pcm_s16le",
    sample_rate: sampleRate,
    num_channels: 1,
    language_hints: [language],
    enable_endpoint_detection: true,
    max_endpoint_delay_ms: 500,
    enable_partial_results: enablePartials,
  }),
  closeText: "",
};

const SARVAM_PROTOCOL: WireProtocol = {
  name: "sarvam",
  buildInitMessage: () => null,
  buildUrl: (baseUrl, { sampleRate, language }) => {
    const params = new URLSearchParams({
      "language-code": language || "unknown",
      mode: "transcribe",
      sample_rate: String(sampleRate),
      input_audio_codec: "linear16",
      vad_signals: "true",
    });
    return `${baseUrl}?${params.toString()}`;
  },
  wrapAudio: (pcm, { sampleRate }) =>
    JSON.stringify({
      audio: {
        data: bufferToBase64(pcm),
        sample_rate: sampleRate,
        encoding: "linear16",
      },
    }),
  finalizeText: JSON.stringify({ type: "flush" }),
};

type ProtocolOverride = {
  modelPrefix: string;
  directOnly?: boolean;
  protocol: WireProtocol;
};

const PROTOCOL_OVERRIDES: ProtocolOverride[] = [
  {
    modelPrefix: "soniox/",
    directOnly: true,
    protocol: SONIOX_DIRECT_PROTOCOL,
  },
  {
    modelPrefix: "sarvam/",
    directOnly: true,
    protocol: SARVAM_PROTOCOL,
  },
];

export function getProtocol(model: string, useDirectUrl: boolean): WireProtocol {
  for (const o of PROTOCOL_OVERRIDES) {
    if (model.startsWith(o.modelPrefix) && (!o.directOnly || useDirectUrl)) {
      return o.protocol;
    }
  }
  return DEFAULT_PROTOCOL;
}
