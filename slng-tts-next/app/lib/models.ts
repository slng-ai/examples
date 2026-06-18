import { modelGroups, voicesByModel } from "./models.generated";

export type ModelOption = {
  value: string;
  label: string;
  wsOnly?: boolean; // true = no REST endpoint, WebSocket streaming only
};

export type ModelGroup = {
  label: string;
  options: ModelOption[];
};

export type VoiceOption = {
  value: string;
  label: string;
};

export type VoiceGroup = {
  label: string;
  options: VoiceOption[];
};

export type PromptSuggestion = {
  label: string;
  prompt: string;
  model?: string;
  voice?: string;
};

// Model list and per-model voices are generated from the SLNG catalog API.
// Run `npm run sync-models` from the repo root to refresh.
export { modelGroups, voicesByModel };

// Fallback when the catalog reports no voices for a model (e.g. the provider
// uses a single default voice or exposes voices only via the `speaker` field).
const DEFAULT_VOICE_GROUPS: VoiceGroup[] = [
  { label: "Default", options: [{ value: "default", label: "Default voice" }] },
];

/**
 * Docs URL for a model's voices, by provider. Kept hand-maintained because the
 * catalog API does not expose per-provider voice documentation links.
 */
function voicesDocsUrl(model: string): string {
  if (model.includes("rime") || model.includes("arcana")) {
    return "https://docs.slng.ai/voices/rime-arcana";
  }
  if (model.includes("deepgram") || model.includes("aura")) {
    return "https://docs.slng.ai/voices/deepgram-aura";
  }
  return "https://docs.slng.ai/voices";
}

/**
 * Returns the voice groups appropriate for the given model (from the catalog),
 * and the docs URL for that provider's voices.
 */
export function getVoicesForModel(model: string): {
  groups: VoiceGroup[];
  docsUrl: string;
} {
  const groups = voicesByModel[model];
  return {
    groups: groups && groups.length > 0 ? groups : DEFAULT_VOICE_GROUPS,
    docsUrl: voicesDocsUrl(model),
  };
}

/**
 * Returns the default voice for a given model.
 */
export function getDefaultVoiceForModel(model: string): string {
  const { groups } = getVoicesForModel(model);
  return groups[0]?.options[0]?.value ?? "";
}

export const promptSuggestions: PromptSuggestion[] = [
  {
    label: "Octopus facts",
    prompt:
      "The octopus has three hearts, nine brains, and blue blood. Two of its hearts pump blood to the gills, while the third pumps it to the rest of the body. When an octopus swims, the heart that delivers blood to the body actually stops beating, which is why these creatures prefer crawling to swimming — it’s less exhausting.",
    model: "slng/deepgram/aura:2-en",
    voice: "aura-2-thalia-en",
  },
  {
    label: "The Great Emu War",
    prompt:
      "In 1932, Australia lost a war against emus. The Royal Australian Artillery was deployed with Lewis guns to cull the emu population in Western Australia. Despite firing thousands of rounds, the emus proved surprisingly resilient and elusive. The military withdrew after a few weeks, and the emus were declared the winners of what became known as the Great Emu War.",
    model: "slng/deepgram/aura:2-en",
    voice: "aura-2-apollo-en",
  },
  {
    label: "Immortal honey",
    prompt:
      "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over three thousand years old and still perfectly edible. Honey’s longevity comes from its low moisture content and acidic pH, which create an inhospitable environment for bacteria and microorganisms.",
    model: "slng/deepgram/aura:2-en",
    voice: "aura-2-andromeda-en",
  },
  {
    label: "Paella autentica",
    prompt:
      "Una pregunta para un amigo: la paella valenciana original no lleva ni pollo ni camarones. Se prepara con conejo, judias verdes, garrofon y caracoles. El azafran le da su color dorado caracteristico. Cada region de Espana tiene su propia version, pero los valencianos insisten en que solo la suya es autentica.",
    model: "slng/deepgram/aura:2-es",
    voice: "aura-2-nestor-es",
  },
  {
    label: "Pirate tale",
    prompt:
      "Arrr matey! Gather round and hear the tale of Blackbeard, the most fearsome pirate to ever sail the seven seas. Edward Teach, as he was known before taking to piracy, would weave slow-burning fuses into his enormous black beard before battle, wreathing his face in smoke and flame. His terrifying appearance alone was often enough to make merchant ships surrender without a fight.",
    model: "slng/deepgram/aura:2-en",
    voice: "aura-2-arcas-en",
  },
];

export const BRIDGES_BASE_URL = "wss://api.slng.ai/v1/bridges/unmute/tts/";
export const DIRECT_WS_BASE_URL = "wss://api.slng.ai/v1/tts/";
export const REST_BASE_URL = "https://api.slng.ai/v1/bridges/unmute/tts/";

// Preferred starting model/voice. Falls back to the first available option so
// the selector always has a valid value even as the catalog changes.
const PREFERRED_MODEL = "slng/deepgram/aura:2-en";
const allModelValues = modelGroups.flatMap((g) => g.options.map((o) => o.value));

export const DEFAULT_MODEL: string = allModelValues.includes(PREFERRED_MODEL)
  ? PREFERRED_MODEL
  : allModelValues[0] ?? "";
export const DEFAULT_VOICE: string = getDefaultVoiceForModel(DEFAULT_MODEL);

export function isWsOnlyModel(model: string): boolean {
  return modelGroups
    .flatMap((g) => g.options)
    .some((o) => o.value === model && o.wsOnly);
}

export function isKugelModel(model: string): boolean {
  return model.startsWith("kugelaudio/");
}

export function getWsUrl(model: string, useDirect: boolean): string {
  if (useDirect) return DIRECT_WS_BASE_URL + model;
  return BRIDGES_BASE_URL + model;
}

export function getDefaultInitPayload(model: string, voice: string): string {
  if (isKugelModel(model)) {
    return JSON.stringify(
      {
        type: "init",
        model,
        voice,
        config: { cfg_scale: 2, sample_rate: 24000, speed: 1 },
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      type: "init",
      model,
      voice,
      config: { sample_rate: 24000, encoding: "linear16" },
    },
    null,
    2
  );
}
