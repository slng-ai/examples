import type { WireProtocol } from "./protocols";

export type ModelOption = {
  value: string;
  label: string;
};

export type ModelGroup = {
  label: string;
  options: ModelOption[];
};

export const modelGroups: ModelGroup[] = [
  {
    label: "SLNG / Deepgram",
    options: [
      { value: "slng/deepgram/nova:3-en", label: "slng/deepgram/nova:3-en" },
      { value: "slng/deepgram/nova:3-es", label: "slng/deepgram/nova:3-es" },
      { value: "slng/deepgram/nova:3-hi", label: "slng/deepgram/nova:3-hi" },
      { value: "slng/deepgram/nova:3-multi", label: "slng/deepgram/nova:3-multi" },
    ],
  },
  {
    label: "SLNG / OpenAI",
    options: [
      { value: "slng/openai/whisper:large-v3", label: "slng/openai/whisper:large-v3" },
      { value: "slng/openai/whisper:large-v3-compressed", label: "slng/openai/whisper:large-v3-compressed" },
    ],
  },
  {
    label: "Deepgram",
    options: [
      { value: "deepgram/nova:2", label: "deepgram/nova:2" },
      { value: "deepgram/nova:3", label: "deepgram/nova:3" },
      { value: "deepgram/nova:3-medical", label: "deepgram/nova:3-medical" },
    ],
  },
  {
    label: "Sarvam",
    options: [
      { value: "sarvam/saaras:v3", label: "sarvam/saaras:v3" },
    ],
  },
  {
    label: "Soniox",
    options: [
      { value: "soniox/speech-ai:rt-v3", label: "soniox/speech-ai:rt-v3" },
    ],
  },
];

export const BRIDGES_BASE_URL = "wss://api.slng.ai/v1/bridges/unmute/stt/";
export const DIRECT_WS_BASE_URL = "wss://api.slng.ai/v1/stt/";
export const HTTP_BASE_URL = "https://api.slng.ai/v1/stt/";
export const DEFAULT_MODEL = "slng/deepgram/nova:3-en";

export function getWsUrl(model: string, useDirect: boolean): string {
  if (useDirect) return DIRECT_WS_BASE_URL + model;
  return BRIDGES_BASE_URL + model;
}

export function getDefaultInitPayload(
  model: string,
  config: { sampleRate: number; language: string; encoding: string; enablePartials: boolean },
  protocol: WireProtocol
): string {
  return JSON.stringify(protocol.buildInitMessage(config), null, 2);
}

export const languageOptions = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "hi", label: "Hindi" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "multi", label: "Multi-language (auto-detect)" },
];
