import type { WireProtocol } from "./protocols";
import { modelGroups, languagesByModel, languageOptions } from "./models.generated";

export type ModelOption = {
  value: string;
  label: string;
};

export type ModelGroup = {
  label: string;
  options: ModelOption[];
};

export type LanguageOption = {
  value: string;
  label: string;
};

// Model list and per-model languages are generated from the SLNG catalog API.
// Run `npm run sync-models` from the repo root to refresh.
export { modelGroups, languageOptions };

export const BRIDGES_BASE_URL = "wss://api.slng.ai/v1/bridges/unmute/stt/";
export const DIRECT_WS_BASE_URL = "wss://api.slng.ai/v1/stt/";
export const HTTP_BASE_URL = "https://api.slng.ai/v1/stt/";

// Preferred starting model. Falls back to the first available option so the
// selector always has a valid value even as the catalog changes.
const PREFERRED_MODEL = "slng/deepgram/nova:3-en";
const allModelValues = modelGroups.flatMap((g) => g.options.map((o) => o.value));

export const DEFAULT_MODEL: string = allModelValues.includes(PREFERRED_MODEL)
  ? PREFERRED_MODEL
  : allModelValues[0] ?? "";

export function getWsUrl(model: string, useDirect: boolean): string {
  if (useDirect) return DIRECT_WS_BASE_URL + model;
  return BRIDGES_BASE_URL + model;
}

export function getDefaultInitPayload(
  model: string,
  config: { sampleRate: number; language: string; encoding: string; enablePartials: boolean },
  protocol: WireProtocol
): string {
  const msg = protocol.buildInitMessage(config);
  return msg === null ? "" : JSON.stringify(msg, null, 2);
}

// Sarvam's direct WebSocket protocol expects BCP-47 language codes (e.g. hi-IN)
// rather than the plain codes the catalog returns, so this list stays curated.
export const sarvamLanguageOptions: LanguageOption[] = [
  { value: "unknown", label: "Auto-detect" },
  { value: "hi-IN", label: "Hindi (India)" },
  { value: "en-IN", label: "English (India)" },
  { value: "bn-IN", label: "Bengali (India)" },
  { value: "gu-IN", label: "Gujarati (India)" },
  { value: "kn-IN", label: "Kannada (India)" },
  { value: "ml-IN", label: "Malayalam (India)" },
  { value: "mr-IN", label: "Marathi (India)" },
  { value: "od-IN", label: "Odia (India)" },
  { value: "pa-IN", label: "Punjabi (India)" },
  { value: "ta-IN", label: "Tamil (India)" },
  { value: "te-IN", label: "Telugu (India)" },
  { value: "ur-IN", label: "Urdu (India)" },
];

export function getLanguageOptions(model: string): LanguageOption[] {
  if (model.startsWith("sarvam/")) return sarvamLanguageOptions;
  const langs = languagesByModel[model];
  return langs && langs.length > 0 ? langs : languageOptions;
}
