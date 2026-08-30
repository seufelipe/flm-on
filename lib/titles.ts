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

// Trims surrounding parens / dash / colon / space off a captured annotation match so the bare
// phrase is left: " (4K Restoration)" → "4K Restoration", ": 25th Anniversary" → "25th Anniversary".
function bareAnnotation(match: string): string {
  return match.replace(/^[\s:()–—-]+/, "").replace(/[\s:()–—-]+$/, "").trim();
}

// Strips the trailing annotation(s) and also reports what was removed (lower-cased, for use as a
// pre-filled `film-labels.json` label — see scripts/fetch-batch.ts / CLAUDE.md #11).
function stripTrailingAnnotations(
  title: string,
  patterns: string[],
): { title: string; annotation?: string } {
  if (!patterns.length) return { title };
  const body = patterns.join("|");
  // A trailing "(…)" whose contents are entirely annotation text (plus connective filler).
  const parenthetical = new RegExp(`\\s*\\((?:${body}|[\\s,&]|and)+\\)\\s*$`, "i");
  // A trailing annotation with no parens, optionally after a dash or colon:
  // "Film - 4K Restoration", "Film: 25th Anniversary".
  const tail = new RegExp(`\\s*(?:[-–—:]\\s*)?(?:${body})\\s*$`, "i");

  let out = title.trim();
  const removed: string[] = [];
  let prev: string;
  do {
    prev = out;
    for (const re of [parenthetical, tail]) {
      const m = out.match(re);
      if (m) {
        removed.unshift(bareAnnotation(m[0]));
        out = out.replace(re, "").trim();
      }
    }
    // A lone trailing separator left behind once the annotation after it is gone
    // ("The Fast and the Furious:" → "The Fast and the Furious").
    out = out.replace(/\s*[-–—:]\s*$/, "").trim();
  } while (out !== prev && out.length > 0);

  if (!out.length) return { title: title.trim() };
  const annotation = removed.join(" ").trim().toLowerCase();
  return { title: out, annotation: annotation || undefined };
}

function cleanTitleParts(raw: string, overrides: TitleOverrides): { title: string; annotation?: string } {
  const trimmed = raw.trim();
  if (trimmed in overrides.corrections) {
    return { title: overrides.corrections[trimmed] };
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

  const { title: stripped, annotation } = stripTrailingAnnotations(title, overrides.stripAnnotations ?? []);
  return { title: stripped || trimmed, annotation };
}

// Cinema listings sometimes prefix a title with a programme strand, e.g.
// "ARCHIVE AT LUNCHTIME: Some Film" — that's not part of the actual film title — or append a
// re-release annotation like "(4K Restoration)".
export function cleanFilmTitle(raw: string, overrides: TitleOverrides): string {
  return cleanTitleParts(raw, overrides).title;
}

// The trailing annotation `cleanFilmTitle` removes ("25th anniversary", "4k restoration"), lower-
// cased — scripts/fetch-batch.ts pre-fills it as the film's editorial label for review.
export function titleAnnotation(raw: string, overrides: TitleOverrides): string | undefined {
  return cleanTitleParts(raw, overrides).annotation;
}

// Whether two titles are effectively the same — case, whitespace, punctuation and
// parentheticals ignored. Used to decide whether an original-language title is worth showing
// next to the display title (FilmCard) or is just the same thing.
export function titlesEquivalent(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return norm(a) === norm(b);
}
