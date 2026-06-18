/**
 * Keeps the example apps' model/voice/language lists in sync with the SLNG
 * catalog API.
 *
 * Fetches every model from `GET /v1/catalog/models` (split by service type) and
 * regenerates `app/lib/models.generated.ts` in `slng-tts-next` and
 * `slng-stt-next`. The curated `app/lib/models.ts` in each app imports the
 * generated data and keeps the hand-maintained logic (helpers, base URLs,
 * prompt suggestions, wire protocols, Sarvam language list).
 *
 * Usage:
 *   tsx scripts/sync-models.ts            # write the generated files
 *   tsx scripts/sync-models.ts --check    # exit 1 if the committed files are stale
 *   tsx scripts/sync-models.ts --dry-run  # print what would change, write nothing
 *
 * Environment:
 *   SLNG_API_BASE_URL   Override the API base (default https://api.slng.ai)
 *   SLNG_API_KEY        Optional bearer token. Anonymous requests return the
 *                       public catalog, so a key is not required.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Config / CLI
// ---------------------------------------------------------------------------

const API_BASE = process.env.SLNG_API_BASE_URL ?? "https://api.slng.ai";
const API_KEY = process.env.SLNG_API_KEY;
const PAGE_SIZE = 100;

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const DRY_RUN = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// API types (subset of the gateway catalog schema we consume)
// ---------------------------------------------------------------------------

interface CatalogVoice {
  voice_id: string;
  name: string;
  gender?: string | null;
  language?: string | null;
  sort_order?: number | null;
  enabled?: boolean | null;
}

interface CatalogModel {
  code: string;
  name: string;
  service_type: "tts" | "stt";
  provider_code: string;
  provider: { name: string; code: string };
  streaming?: boolean | null;
  batch?: boolean | null;
  languages?: string[] | null;
  supported_protocols?: string[] | null;
  voices?: CatalogVoice[] | null;
}

interface ListResponse {
  items: CatalogModel[];
  meta: { page: number; page_size: number; total: number; pages: number };
}

// ---------------------------------------------------------------------------
// Generated-data shapes
// ---------------------------------------------------------------------------

type Option = { value: string; label: string; wsOnly?: boolean };
type Group = { label: string; options: Option[] };

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchAllModels(serviceType: "tts" | "stt"): Promise<CatalogModel[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const items: CatalogModel[] = [];
  let page = 1;
  let pages = 1;
  do {
    const url = `${API_BASE}/v1/catalog/models?service_type=${serviceType}&page=${page}&page_size=${PAGE_SIZE}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as ListResponse;
    items.push(...body.items);
    pages = body.meta.pages || 1;
    page += 1;
  } while (page <= pages);

  return items;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

// Display names for the language codes the catalog returns. Unknown codes fall
// back to the upper-cased code so nothing breaks when the catalog adds a language.
const LANGUAGE_NAMES: Record<string, string> = {
  af: "Afrikaans", am: "Amharic", ar: "Arabic", as: "Assamese", ay: "Aymara",
  az: "Azerbaijani", ba: "Bashkir", be: "Belarusian", bg: "Bulgarian", bm: "Bambara",
  bn: "Bengali", bs: "Bosnian", ca: "Catalan", co: "Corsican", cs: "Czech",
  cy: "Welsh", da: "Danish", de: "German", el: "Greek", en: "English",
  eo: "Esperanto", es: "Spanish", et: "Estonian", eu: "Basque", fa: "Persian",
  fi: "Finnish", fr: "French", ga: "Irish", gl: "Galician", gn: "Guarani",
  gu: "Gujarati", he: "Hebrew", hi: "Hindi", hr: "Croatian", hu: "Hungarian",
  hy: "Armenian", ia: "Interlingua", id: "Indonesian", is: "Icelandic", it: "Italian",
  ja: "Japanese", ka: "Georgian", kk: "Kazakh", kn: "Kannada", ko: "Korean",
  ku: "Kurdish", la: "Latin", lb: "Luxembourgish", lt: "Lithuanian", lv: "Latvian",
  mk: "Macedonian", ml: "Malayalam", mn: "Mongolian", mr: "Marathi", ms: "Malay",
  mt: "Maltese", my: "Burmese", ne: "Nepali", nl: "Dutch", no: "Norwegian",
  pa: "Punjabi", pl: "Polish", pt: "Portuguese", ro: "Romanian", ru: "Russian",
  sa: "Sanskrit", sk: "Slovak", sl: "Slovenian", so: "Somali", sq: "Albanian",
  sr: "Serbian", sv: "Swedish", sw: "Swahili", ta: "Tamil", te: "Telugu",
  th: "Thai", tl: "Tagalog", tr: "Turkish", ug: "Uyghur", uk: "Ukrainian",
  ur: "Urdu", vi: "Vietnamese", zh: "Chinese",
};

function languageName(code: string): string {
  if (LANGUAGE_NAMES[code]) return LANGUAGE_NAMES[code];
  // Handle BCP-47 regioned codes like "bn-IN" -> "Bengali (IN)".
  const [base, region] = code.split("-");
  if (region && LANGUAGE_NAMES[base]) return `${LANGUAGE_NAMES[base]} (${region})`;
  return code.toUpperCase();
}

// Prefer SLNG-hosted groups first, then alphabetical. Within that, the original
// hand-written list led with the model's own provider name.
function groupLabel(model: CatalogModel): string {
  const provider = model.provider?.name || model.provider_code;
  return model.code.startsWith("slng/") ? `SLNG / ${provider}` : provider;
}

// A model is WebSocket-only when it has no HTTPS (REST) endpoint.
function isWsOnly(model: CatalogModel): boolean {
  const protocols = model.supported_protocols ?? [];
  return !protocols.includes("https");
}

function sortGroups(groups: Group[]): Group[] {
  const rank = (label: string) => (label.startsWith("SLNG / ") ? 0 : 1);
  return groups.sort(
    (a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label)
  );
}

function buildModelGroups(models: CatalogModel[]): Group[] {
  const byLabel = new Map<string, Option[]>();
  for (const m of models) {
    const label = groupLabel(m);
    if (!byLabel.has(label)) byLabel.set(label, []);
    const opt: Option = { value: m.code, label: m.code };
    if (m.service_type === "tts" && isWsOnly(m)) opt.wsOnly = true;
    byLabel.get(label)!.push(opt);
  }
  const groups: Group[] = [];
  for (const [label, options] of byLabel) {
    options.sort((a, b) => a.value.localeCompare(b.value));
    groups.push({ label, options });
  }
  return sortGroups(groups);
}

// voicesByModel: per model code, voices grouped by language and sorted.
function buildVoicesByModel(models: CatalogModel[]): Record<string, Group[]> {
  const out: Record<string, Group[]> = {};
  for (const m of models) {
    const voices = (m.voices ?? []).filter((v) => v.enabled !== false);
    if (voices.length === 0) continue;

    const byLang = new Map<string, CatalogVoice[]>();
    for (const v of voices) {
      const lang = v.language || "";
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang)!.push(v);
    }

    const groups: Group[] = [];
    for (const [lang, vs] of [...byLang.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      vs.sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
      );
      groups.push({
        label: lang ? languageName(lang) : "Voices",
        options: vs.map((v) => ({
          value: v.voice_id,
          label: v.gender ? `${v.name} (${v.gender})` : v.name,
        })),
      });
    }
    out[m.code] = groups;
  }
  return out;
}

// languagesByModel + a union fallback, for the STT language selector.
function buildLanguages(models: CatalogModel[]): {
  byModel: Record<string, Option[]>;
  union: Option[];
} {
  const byModel: Record<string, Option[]> = {};
  const unionCodes = new Set<string>();
  for (const m of models) {
    const langs = m.languages ?? [];
    for (const l of langs) unionCodes.add(l);
    byModel[m.code] = langs.map((l) => ({ value: l, label: languageName(l) }));
  }
  const union = [...unionCodes]
    .sort((a, b) => languageName(a).localeCompare(languageName(b)))
    .map((l) => ({ value: l, label: languageName(l) }));
  return { byModel, union };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

const HEADER = (serviceType: string) =>
  `// AUTO-GENERATED by scripts/sync-models.ts — do not edit by hand.
// Source: GET ${API_BASE}/v1/catalog/models?service_type=${serviceType}
// Run \`npm run sync-models\` from the repo root to refresh.
`;

function renderTts(models: CatalogModel[]): string {
  const modelGroups = buildModelGroups(models);
  const voicesByModel = buildVoicesByModel(models);
  return `${HEADER("tts")}
import type { ModelGroup, VoiceGroup } from "./models";

export const modelGroups: ModelGroup[] = ${JSON.stringify(modelGroups, null, 2)};

export const voicesByModel: Record<string, VoiceGroup[]> = ${JSON.stringify(
    voicesByModel,
    null,
    2
  )};
`;
}

function renderStt(models: CatalogModel[]): string {
  const modelGroups = buildModelGroups(models);
  const { byModel, union } = buildLanguages(models);
  return `${HEADER("stt")}
import type { ModelGroup, LanguageOption } from "./models";

export const modelGroups: ModelGroup[] = ${JSON.stringify(modelGroups, null, 2)};

export const languagesByModel: Record<string, LanguageOption[]> = ${JSON.stringify(
    byModel,
    null,
    2
  )};

export const languageOptions: LanguageOption[] = ${JSON.stringify(union, null, 2)};
`;
}

// ---------------------------------------------------------------------------
// Write / check
// ---------------------------------------------------------------------------

let drift = false;

function emit(relPath: string, content: string) {
  const fullPath = resolve(REPO_ROOT, relPath);
  const current = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null;
  const unchanged = current === content;

  if (CHECK) {
    if (!unchanged) {
      drift = true;
      console.error(`✗ stale: ${relPath} (run \`npm run sync-models\`)`);
    } else {
      console.log(`✓ up to date: ${relPath}`);
    }
    return;
  }

  if (unchanged) {
    console.log(`= unchanged: ${relPath}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`~ would write: ${relPath}`);
    return;
  }

  writeFileSync(fullPath, content);
  console.log(`✓ wrote: ${relPath}`);
}

// The example apps demonstrate real-time streaming only, so batch-only models
// (streaming === false) are excluded from the selectors.
function dropBatchOnly(models: CatalogModel[]): CatalogModel[] {
  const kept: CatalogModel[] = [];
  for (const m of models) {
    if (m.streaming === false) {
      console.log(`  excluding batch-only model: ${m.code}`);
      continue;
    }
    kept.push(m);
  }
  return kept;
}

async function main() {
  console.log(`Fetching catalog from ${API_BASE}${API_KEY ? " (authenticated)" : " (anonymous)"}…`);
  const [ttsAll, sttAll] = await Promise.all([fetchAllModels("tts"), fetchAllModels("stt")]);
  const tts = dropBatchOnly(ttsAll);
  const stt = dropBatchOnly(sttAll);
  console.log(`Fetched ${ttsAll.length} TTS / ${sttAll.length} STT models; kept ${tts.length} / ${stt.length} after dropping batch-only.`);

  emit("slng-tts-next/app/lib/models.generated.ts", renderTts(tts));
  emit("slng-stt-next/app/lib/models.generated.ts", renderStt(stt));

  if (CHECK && drift) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
