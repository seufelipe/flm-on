import { promises as fs } from "fs";
import path from "path";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "language-overrides.json");

// Manual per-film language corrections, checked before the Letterboxd "Primary Language" value.
// Keyed by the cleaned film title lower-cased (`filmTitle.trim().toLowerCase()` — same as
// data/film-labels.json). A string forces that language; `null` forces the film unmarked (an
// English film Letterboxd mislabels, or noise). Fixes wrong Letterboxd data and covers
// foreign-language titles that don't resolve on Letterboxd at all. See CLAUDE.md decision #17.
export type LanguageOverrides = Record<string, string | null>;

let cached: LanguageOverrides | undefined;

export async function loadLanguageOverrides(): Promise<LanguageOverrides> {
  if (cached) return cached;
  try {
    cached = JSON.parse(await fs.readFile(OVERRIDES_FILE, "utf-8")) as LanguageOverrides;
  } catch {
    cached = {};
  }
  return cached;
}

// `undefined` → no override; `null` → force unmarked; string → force this language.
export function languageOverrideFor(
  title: string,
  overrides: LanguageOverrides,
): string | null | undefined {
  const key = title.trim().toLowerCase();
  return key in overrides ? overrides[key] : undefined;
}
