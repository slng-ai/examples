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

export const modelGroups: ModelGroup[] = [
  {
    label: "Deepgram",
    options: [{ value: "deepgram/aura:2", label: "deepgram/aura:2" }],
  },
  {
    label: "ElevenLabs",
    options: [
      { value: "elevenlabs/eleven:3", label: "elevenlabs/eleven:3" },
      { value: "elevenlabs/eleven-flash:2", label: "elevenlabs/eleven-flash:2" },
      { value: "elevenlabs/eleven-flash:2.5", label: "elevenlabs/eleven-flash:2.5" },
      { value: "elevenlabs/eleven-multilingual:2", label: "elevenlabs/eleven-multilingual:2" },
    ],
  },
  {
    label: "Sarvam",
    options: [{ value: "sarvam/bulbul:v3", label: "sarvam/bulbul:v3" }],
  },
  {
    label: "SLNG / Deepgram",
    options: [
      { value: "slng/deepgram/aura:2", label: "slng/deepgram/aura:2" },
      { value: "slng/deepgram/aura:2-en", label: "slng/deepgram/aura:2-en" },
      { value: "slng/deepgram/aura:2-es", label: "slng/deepgram/aura:2-es" },
    ],
  },
  {
    label: "SLNG / Rime",
    options: [
      { value: "slng/rime/arcana:3-en", label: "slng/rime/arcana:3-en" },
      { value: "slng/rime/arcana:3-es", label: "slng/rime/arcana:3-es" },
      { value: "slng/rime/arcana:3-fr", label: "slng/rime/arcana:3-fr" },
      { value: "slng/rime/arcana:3-hi", label: "slng/rime/arcana:3-hi" },
      { value: "slng/rime/arcana:ar", label: "slng/rime/arcana:ar" },
      { value: "slng/rime/arcana:de", label: "slng/rime/arcana:de" },
      { value: "slng/rime/arcana:en", label: "slng/rime/arcana:en" },
      { value: "slng/rime/arcana:es", label: "slng/rime/arcana:es" },
      { value: "slng/rime/arcana:fr", label: "slng/rime/arcana:fr" },
    ],
  },
  {
    label: "Canopy Labs",
    options: [{ value: "slng/canopylabs/orpheus:en", label: "slng/canopylabs/orpheus:en" }],
  },
  {
    label: "KugelAudio",
    options: [
      { value: "kugelaudio/kugel:1-turbo", label: "kugelaudio/kugel:1-turbo", wsOnly: true },
      { value: "kugelaudio/kugel:1", label: "kugelaudio/kugel:1", wsOnly: true },
    ],
  },
];

// ── Voice groups per provider ──

const deepgramAuraVoices: VoiceGroup[] = [
  {
    label: "English",
    options: [
      { value: "aura-2-thalia-en", label: "Thalia (feminine)" },
      { value: "aura-2-andromeda-en", label: "Andromeda (feminine)" },
      { value: "aura-2-helena-en", label: "Helena (feminine)" },
      { value: "aura-2-apollo-en", label: "Apollo (masculine)" },
      { value: "aura-2-arcas-en", label: "Arcas (masculine)" },
      { value: "aura-2-aries-en", label: "Aries (masculine)" },
    ],
  },
  {
    label: "Spanish",
    options: [
      { value: "aura-2-nestor-es", label: "Nestor (masculine)" },
      { value: "aura-2-valentina-es", label: "Valentina (feminine)" },
      { value: "aura-2-alvaro-es", label: "Alvaro (masculine)" },
      { value: "aura-2-carina-es", label: "Carina (feminine)" },
      { value: "aura-2-celeste-es", label: "Celeste (feminine)" },
      { value: "aura-2-diana-es", label: "Diana (feminine)" },
      { value: "aura-2-estrella-es", label: "Estrella (feminine)" },
      { value: "aura-2-hector-es", label: "Hector (masculine)" },
      { value: "aura-2-javier-es", label: "Javier (masculine)" },
      { value: "aura-2-leon-es", label: "Leon (masculine)" },
      { value: "aura-2-selena-es", label: "Selena (feminine)" },
      { value: "aura-2-sirio-es", label: "Sirio (masculine)" },
      { value: "aura-2-solana-es", label: "Solana (feminine)" },
    ],
  },
];

const rimeArcanaVoices: VoiceGroup[] = [
  {
    label: "English",
    options: [
      { value: "astra", label: "Astra (feminine)" },
      { value: "luna", label: "Luna (feminine)" },
      { value: "lyra", label: "Lyra (feminine)" },
      { value: "celeste", label: "Celeste (feminine)" },
      { value: "estelle", label: "Estelle (feminine)" },
      { value: "vashti", label: "Vashti (feminine)" },
      { value: "arcade", label: "Arcade (masculine)" },
      { value: "albion", label: "Albion (masculine)" },
      { value: "sirius", label: "Sirius (masculine)" },
      { value: "bond", label: "Bond (masculine)" },
      { value: "eliphas", label: "Eliphas (masculine)" },
    ],
  },
  {
    label: "Spanish",
    options: [
      { value: "aurelio", label: "Aurelio (masculine)" },
      { value: "celestino", label: "Celestino (masculine)" },
      { value: "lark", label: "Lark" },
      { value: "luz", label: "Luz (feminine)" },
      { value: "mar", label: "Mar" },
      { value: "nova", label: "Nova (feminine)" },
      { value: "pola", label: "Pola (feminine)" },
      { value: "seraphina", label: "Seraphina (feminine)" },
    ],
  },
  {
    label: "French",
    options: [
      { value: "amarante", label: "Amarante (feminine)" },
      { value: "aurelie", label: "Aurelie (feminine)" },
      { value: "destin", label: "Destin (masculine)" },
      { value: "morel_marianne", label: "Morel Marianne (feminine)" },
      { value: "solstice", label: "Solstice (feminine)" },
    ],
  },
  {
    label: "Hindi",
    options: [
      { value: "anaya", label: "Anaya (feminine)" },
      { value: "anil", label: "Anil (masculine)" },
      { value: "arya", label: "Arya (feminine)" },
    ],
  },
  {
    label: "German",
    options: [
      { value: "alfhild", label: "Alfhild (feminine)" },
      { value: "baldur", label: "Baldur (masculine)" },
      { value: "kumara", label: "Kumara" },
      { value: "liesel", label: "Liesel (feminine)" },
      { value: "lorelei", label: "Lorelei (feminine)" },
      { value: "runa", label: "Runa (feminine)" },
    ],
  },
  {
    label: "Arabic",
    options: [
      { value: "batin", label: "Batin (masculine)" },
      { value: "layla", label: "Layla (feminine)" },
      { value: "qadir", label: "Qadir (masculine)" },
      { value: "sakina", label: "Sakina (feminine)" },
    ],
  },
];

const elevenlabsVoices: VoiceGroup[] = [
  {
    label: "Default",
    options: [
      { value: "default", label: "Default voice" },
    ],
  },
];

const sarvamVoices: VoiceGroup[] = [
  {
    label: "Default",
    options: [
      { value: "default", label: "Default voice" },
    ],
  },
];

const canopyLabsVoices: VoiceGroup[] = [
  {
    label: "Default",
    options: [
      { value: "default", label: "Default voice" },
    ],
  },
];

const kugelAudioVoices: VoiceGroup[] = [
  {
    label: "Default",
    options: [{ value: "268", label: "Voice 268 (default)" }],
  },
];

/**
 * Returns the voice groups appropriate for the given model,
 * and the docs URL for that provider's voices.
 */
export function getVoicesForModel(model: string): {
  groups: VoiceGroup[];
  docsUrl: string;
} {
  if (model.includes("rime") || model.includes("arcana")) {
    return {
      groups: rimeArcanaVoices,
      docsUrl: "https://docs.slng.ai/voices/rime-arcana",
    };
  }
  if (model.includes("elevenlabs")) {
    return {
      groups: elevenlabsVoices,
      docsUrl: "https://docs.slng.ai/voices",
    };
  }
  if (model.includes("sarvam")) {
    return {
      groups: sarvamVoices,
      docsUrl: "https://docs.slng.ai/voices",
    };
  }
  if (model.includes("canopy") || model.includes("orpheus")) {
    return {
      groups: canopyLabsVoices,
      docsUrl: "https://docs.slng.ai/voices",
    };
  }
  if (model.includes("kugelaudio") || model.includes("kugel")) {
    return {
      groups: kugelAudioVoices,
      docsUrl: "https://docs.slng.ai/voices",
    };
  }
  // Default: Deepgram Aura
  return {
    groups: deepgramAuraVoices,
    docsUrl: "https://docs.slng.ai/voices/deepgram-aura",
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
      "The octopus has three hearts, nine brains, and blue blood. Two of its hearts pump blood to the gills, while the third pumps it to the rest of the body. When an octopus swims, the heart that delivers blood to the body actually stops beating, which is why these creatures prefer crawling to swimming \u2014 it\u2019s less exhausting.",
    model: "slng/deepgram/aura:2",
    voice: "aura-2-thalia-en",
  },
  {
    label: "The Great Emu War",
    prompt:
      "In 1932, Australia lost a war against emus. The Royal Australian Artillery was deployed with Lewis guns to cull the emu population in Western Australia. Despite firing thousands of rounds, the emus proved surprisingly resilient and elusive. The military withdrew after a few weeks, and the emus were declared the winners of what became known as the Great Emu War.",
    model: "slng/deepgram/aura:2",
    voice: "aura-2-apollo-en",
  },
  {
    label: "Immortal honey",
    prompt:
      "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over three thousand years old and still perfectly edible. Honey\u2019s longevity comes from its low moisture content and acidic pH, which create an inhospitable environment for bacteria and microorganisms.",
    model: "slng/deepgram/aura:2",
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
    model: "slng/deepgram/aura:2",
    voice: "aura-2-arcas-en",
  },
];

export const BRIDGES_BASE_URL = "wss://api.slng.ai/v1/bridges/unmute/tts/";
export const DIRECT_WS_BASE_URL = "wss://api.slng.ai/v1/tts/";
export const REST_BASE_URL = "https://api.slng.ai/v1/bridges/unmute/tts/";
export const DEFAULT_MODEL = "slng/deepgram/aura:2";
export const DEFAULT_VOICE = "aura-2-thalia-en";

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
