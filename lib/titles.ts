import { promises as fs } from "fs";
import path from "path";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "title-overrides.json");

export interface TitleOverrides {
  stripPrefixes: string[];
  // Regex sources (case-insensitive) for trailing annotations a cinema appends to a title but
  // that aren't part of the film's name — "4K Restoration", "75th Anniversary", etc. Matched at
  // the end of the title, optionally wrapped in `(...)` or preceded by a dash.
  stripAnnotations?: string[];
  corrections: Record<string, string>;
}

const EMPTY_OVERRIDES: TitleOverrides = { stripPrefixes: [], stripAnnotations: [], corrections: {} };

let cached: TitleOverrides | undefined;

export async function loadTitleOverrides(): Promise<TitleOverrides> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<TitleOverrides>;
    cached = {
      stripPrefixes: parsed.stripPrefixes ?? [],
      stripAnnotations: parsed.stripAnnotations ?? [],
      corrections: parsed.corrections ?? {},
    };
  } catch {
    cached = EMPTY_OVERRIDES;
  }
  return cached;
}

function stripTrailingAnnotations(title: string, patterns: string[]): string {
  if (!patterns.length) return title;
  const body = patterns.join("|");
  // A trailing "(…)" whose contents are entirely annotation text (plus connective filler).
  const parenthetical = new RegExp(`\\s*\\((?:${body}|[\\s,&]|and)+\\)\\s*$`, "i");
  // A trailing annotation with no parens, optionally after a dash: "Film - 4K Restoration".
  const tail = new RegExp(`\\s*(?:[-–—]\\s*)?(?:${body})\\s*$`, "i");

  let out = title.trim();
  let prev: string;
  do {
    prev = out;
    out = out.replace(parenthetical, "").trim();
    out = out.replace(tail, "").trim();
  } while (out !== prev && out.length > 0);

  return out.length ? out : title.trim();
}

// Cinema listings sometimes prefix a title with a programme strand, e.g.
// "ARCHIVE AT LUNCHTIME: Some Film" — that's not part of the actual film title — or append a
// re-release annotation like "(4K Restoration)".
export function cleanFilmTitle(raw: string, overrides: TitleOverrides): string {
  const trimmed = raw.trim();
  if (trimmed in overrides.corrections) {
    return overrides.corrections[trimmed];
  }

  let title = trimmed;
  for (const prefix of overrides.stripPrefixes) {
    if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
      const stripped = title.slice(prefix.length).replace(/^[\s:]+/, "").trim();
      if (stripped) {
        title = stripped;
        break;
      }
    }
  }

  title = stripTrailingAnnotations(title, overrides.stripAnnotations ?? []);

  return title || trimmed;
}
