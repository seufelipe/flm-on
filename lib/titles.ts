import { promises as fs } from "fs";
import path from "path";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "title-overrides.json");

export interface TitleOverrides {
  stripPrefixes: string[];
  corrections: Record<string, string>;
}

const EMPTY_OVERRIDES: TitleOverrides = { stripPrefixes: [], corrections: {} };

let cached: TitleOverrides | undefined;

export async function loadTitleOverrides(): Promise<TitleOverrides> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
    cached = JSON.parse(raw) as TitleOverrides;
  } catch {
    cached = EMPTY_OVERRIDES;
  }
  return cached;
}

// Cinema listings sometimes prefix a title with a programme strand, e.g.
// "ARCHIVE AT LUNCHTIME: Some Film" — that's not part of the actual film title.
export function cleanFilmTitle(raw: string, overrides: TitleOverrides): string {
  const trimmed = raw.trim();
  if (trimmed in overrides.corrections) {
    return overrides.corrections[trimmed];
  }

  for (const prefix of overrides.stripPrefixes) {
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      const stripped = trimmed.slice(prefix.length).replace(/^[\s:]+/, "").trim();
      if (stripped) return stripped;
    }
  }

  return trimmed;
}
