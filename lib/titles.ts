import { promises as fs } from "fs";
import path from "path";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "title-overrides.json");

export interface TitleOverrides {
  stripPrefixes: string[];
  // Prefixes that name a strand the session belongs to, not just packaging: stripped like
  // `stripPrefixes`, and the value becomes a screening tag on that session (lib/aggregate.ts) —
  // "IFI Documentary Festival 2026: Acting" → title "Acting", tag "IFI Documentary Festival".
  // Per session, because the prefix is: the same film at another cinema isn't in the strand.
  // CLAUDE.md decision #27.
  strandPrefixes?: Record<string, string>;
  // The same at the other end: a regex source (case-insensitive) for a trailing piece of the title
  // that names something about the session, mapped to the tag it becomes — IFI's "+ Q&A" →
  // "In-Person QandA", the tag Light House sends for the same thing. Stripped, and the tag goes on
  // that session only (lib/aggregate.ts).
  strandSuffixes?: Record<string, string>;
  // Prefixes that carry context worth showing — an occasion ("Black History Month:"), who's
  // presenting ("Emmy Shigeta & Jack Reynor Present:"). Stripped from the title like
  // `stripPrefixes`, but the cinema's own words (colon dropped, never reworded) are kept on that
  // session as `context`, and the card shows them as a kicker above the title. Per session, for
  // the same reason as `strandPrefixes`. CLAUDE.md decision #29.
  contextPrefixes?: string[];
  // Regex sources (case-insensitive) for trailing annotations a cinema appends to a title but
  // that aren't part of the film's name — "4K Restoration", "75th Anniversary", etc. Matched at
  // the end of the title, optionally wrapped in `(...)` or preceded by a dash.
  stripAnnotations?: string[];
  corrections: Record<string, string>;
}

const EMPTY_OVERRIDES: TitleOverrides = {
  stripPrefixes: [],
  strandPrefixes: {},
  strandSuffixes: {},
  contextPrefixes: [],
  stripAnnotations: [],
  corrections: {},
};

let cached: TitleOverrides | undefined;

export async function loadTitleOverrides(): Promise<TitleOverrides> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<TitleOverrides>;
    cached = {
      stripPrefixes: parsed.stripPrefixes ?? [],
      strandPrefixes: parsed.strandPrefixes ?? {},
      strandSuffixes: parsed.strandSuffixes ?? {},
      contextPrefixes: parsed.contextPrefixes ?? [],
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

// Removes a leading `strandPrefixes` entry, reporting the strand it names. Runs before everything
// else in `cleanTitleParts`, so the remainder still gets corrections / stripPrefixes / annotations
// exactly as an unprefixed title would.
function splitStrandPrefix(raw: string, overrides: TitleOverrides): { rest: string; strand?: string } {
  const trimmed = raw.trim();
  for (const [prefix, strand] of Object.entries(overrides.strandPrefixes ?? {})) {
    if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const rest = trimmed.slice(prefix.length).replace(/^[\s:]+/, "").trim();
    if (rest) return { rest, strand };
  }
  return { rest: trimmed };
}

function cleanTitleParts(
  raw: string,
  overrides: TitleOverrides,
): { title: string; annotation?: string; strands: string[]; context?: string } {
  const { rest: trimmed, strand } = splitStrandPrefix(raw, overrides);
  const { rest, strand: suffixStrand } = splitStrandSuffix(trimmed, overrides);
  return {
    ...cleanUnprefixed(rest, overrides),
    strands: [strand, suffixStrand].filter((s): s is string => Boolean(s)),
  };
}

// Removes a trailing `strandSuffixes` match ("Bourdieu + Q+A" → "Bourdieu"), reporting the tag it
// maps to. Runs before the prefixes and annotations, so what's left cleans like any other title.
function splitStrandSuffix(title: string, overrides: TitleOverrides): { rest: string; strand?: string } {
  for (const [source, strand] of Object.entries(overrides.strandSuffixes ?? {})) {
    const rest = title.replace(new RegExp(`\\s*(?:${source})\\s*$`, "i"), "").trim();
    if (rest && rest !== title) return { rest, strand };
  }
  return { rest: title };
}

function cleanUnprefixed(
  trimmed: string,
  overrides: TitleOverrides,
): { title: string; annotation?: string; context?: string } {
  if (trimmed in overrides.corrections) {
    return { title: overrides.corrections[trimmed] };
  }

  let title = trimmed;
  let context: string | undefined;
  const contextPrefixes = new Set((overrides.contextPrefixes ?? []).map((p) => p.toLowerCase()));
  // Repeated until none matches: prefixes stack ("From the Vaults: IFI & ESB & DFOH: More Power
  // to Ye!"), and one pass would leave the inner one on the title.
  let matched = true;
  while (matched) {
    matched = false;
    for (const prefix of [...overrides.stripPrefixes, ...(overrides.contextPrefixes ?? [])]) {
      if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
        const stripped = title.slice(prefix.length).replace(/^[\s:]+/, "").trim();
        if (stripped) {
          // The cinema's own words for it, as they appear in this title — not the override's.
          if (contextPrefixes.has(prefix.toLowerCase())) {
            context ??= title.slice(0, prefix.length).replace(/[\s:]+$/, "").trim();
          }
          title = stripped;
          matched = true;
          break;
        }
      }
    }
  }

  const { title: stripped, annotation } = stripTrailingAnnotations(title, overrides.stripAnnotations ?? []);
  return { title: stripped || trimmed, annotation, context };
}

// Cinema listings sometimes prefix a title with a programme strand, e.g.
// "ARCHIVE AT LUNCHTIME: Some Film" — that's not part of the actual film title — or append a
// re-release annotation like "(4K Restoration)".
export function cleanFilmTitle(raw: string, overrides: TitleOverrides): string {
  return cleanTitleParts(raw, overrides).title;
}

// The `contextPrefixes` entry this raw title carried, in the cinema's own words — kept on the
// session by lib/aggregate.ts and shown above the title (decision #29).
export function titleContext(raw: string, overrides: TitleOverrides): string | undefined {
  return cleanTitleParts(raw, overrides).context;
}

// The trailing annotation `cleanFilmTitle` removes ("25th anniversary", "4k restoration"), lower-
// cased — scripts/fetch-batch.ts pre-fills it as the film's editorial label for review.
export function titleAnnotation(raw: string, overrides: TitleOverrides): string | undefined {
  return cleanTitleParts(raw, overrides).annotation;
}

// The strands a `strandPrefixes` / `strandSuffixes` entry named on this raw title — attached to
// the session as screening tags by lib/aggregate.ts.
export function titleStrands(raw: string, overrides: TitleOverrides): string[] {
  return cleanTitleParts(raw, overrides).strands;
}

// Whether `candidate` is just `title` behind a strand label — "Members' Preview: Heart of the
// Beast" for "Heart of the Beast". Cineworld files a preview as its own movie record and puts the
// label in `originalTitle`, which is no original-language title at all; without this check it
// reads as one on the card. Only the text after the first colon is compared, so a title that
// has colons of its own ("Oasis: Don't Look Back In Anger") still matches.
export function isLabelledTitle(candidate: string, title: string): boolean {
  const colon = candidate.indexOf(":");
  return colon > 0 && titlesEquivalent(candidate.slice(colon + 1), title);
}

// Whether two titles are effectively the same — case, whitespace, ASCII punctuation and
// parentheticals ignored. Accented Latin and non-Latin scripts (U+00C0+) are kept, so a
// native-script original title ("기생충") doesn't collapse to "" and read as equal to an English
// display title. Used to decide whether an original-language title is worth showing on the card.
export function titlesEquivalent(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      // General Punctuation (U+2000–206F): curly quotes, en/em dashes, ellipsis… These fall in
      // the "kept" U+00C0+ range but are punctuation, not script — so "Don't" (curly) would
      // otherwise not match "Don't" (ASCII). Flatten them before the class strip below.
      .replace(/[\u2000-\u206f]/g, " ")
      .replace(/[^0-9a-zÀ-￿]+/g, " ")
      .trim();
  return norm(a) === norm(b);
}
