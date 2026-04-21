export type InitConfigInput = {
  sampleRate: number;
  language: string;
  encoding: string;
  enablePartials: boolean;
};

export type WireProtocol = {
  // Identifier used by UI to pick code samples / docs.
  name: "default" | "soniox-direct";
  // Returns the full init message object (caller JSON-stringifies it).
  buildInitMessage: (input: InitConfigInput) => Record<string, unknown>;
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
];

export function getProtocol(model: string, useDirectUrl: boolean): WireProtocol {
  for (const o of PROTOCOL_OVERRIDES) {
    if (model.startsWith(o.modelPrefix) && (!o.directOnly || useDirectUrl)) {
      return o.protocol;
    }
  }
  return DEFAULT_PROTOCOL;
}
