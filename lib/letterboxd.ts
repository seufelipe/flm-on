import { promises as fs } from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "letterboxd-cache.json");
const OVERRIDES_FILE = path.join(process.cwd(), "data", "letterboxd-overrides.json");
const USER_AGENT = "flm-personal-cinema-app/1.0 (+personal showtime planner)";

// Letterboxd's own search endpoint sits behind a Cloudflare bot challenge (verified: a plain
// GET to /search/films/... returns 403 with `cf-mitigated: challenge`, even with a full browser
// UA). Individual film pages (/film/{slug}/) are NOT behind that challenge and aren't disallowed
// by robots.txt's `User-agent: *` block (only sorting/filter/listing paths are). So instead of
// searching, we guess the slug from the title (Letterboxd's own convention: lowercase, hyphenated,
// punctuation stripped) and optionally a `-{year}` suffix for disambiguation, then fetch that page
// directly. Verified against ~15 real titles including disambiguated duplicates (dune-2021 vs
// bare dune, true-grit-2010 vs bare true-grit) — works reliably. From that one page we read the
// `og:title` year (format "Title (YYYY)") — used both to confirm the match and, since cinema
// listings mis-report years, as the film's real year — AND the "Primary Language" field, which
// marks every non-English film (see lib/languages.ts, CLAUDE.md decision #17).
// Cinema listings often append annotations like "(4K Restoration)" or "(Subtitled)" that
// aren't part of the actual film title and would break slug matching if left in.
function cleanTitleForMatching(title: string): string {
  let cleaned = title.trim();
  while (/\s*\([^)]*\)\s*$/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, "").trim();
  }
  return cleaned || title.trim();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Letterboxd's film-detail page carries the language in its "Details" panel (present in the
// server HTML, just `hidden="until-found"`): a single-language film gets `<h3><span>Language`,
// a multi-language one gets `<h3><span>Primary Language` plus a separate `Spoken Languages`.
// We take the first `/films/language/…` anchor under either header. English (and the
// silent-film placeholders) return undefined — only a *non-English* language is worth marking.
export function parsePrimaryLanguage(html: string): string | undefined {
  const match = html.match(
    /<h3><span>(?:Primary Language|Language)<\/span><\/h3>\s*<div[^>]*>\s*<a[^>]*\/films\/language\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  );
  if (!match) return undefined;
  const name = match[1].trim();
  const lower = name.toLowerCase();
  if (!name || lower === "english" || lower === "no spoken language" || lower === "no language") {
    return undefined;
  }
  return name;
}

// Letterboxd lists a film's genres as `/films/genre/{slug}/` anchors in the Details panel (the
// browse nav only ever links the genres this film is in, so a bare substring test is safe). We
// only care whether it's animation: an animated non-English film often screens in an
// English-dubbed version, so lib/aggregate.ts must not assume subtitles for it (decision #17).
export function parseIsAnimated(html: string): boolean {
  return /\/films\/genre\/animation\//i.test(html);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Letterboxd puts the director(s) in a Twitter card meta pair in the page head —
// `<meta name="twitter:label1" content="Directed by">` + a matching `twitter:data1` holding the
// name(s), comma-joined for a co-directed film ("Daniel Scheinert, Daniel Kwan"). The label
// index isn't always 1, so match "Directed by" to its number first, then read that `data{n}`.
export function parseDirector(html: string): string | undefined {
  const label = html.match(/<meta name="twitter:label(\d)" content="Directed by"\s*\/?>/i);
  if (!label) return undefined;
  const data = html.match(
    new RegExp(`<meta name="twitter:data${label[1]}" content="([^"]*)"`, "i"),
  );
  if (!data) return undefined;
  const name = decodeEntities(data[1]).trim();
  return name || undefined;
}

// Letterboxd shows the film's original title (often in its native script) as
// `<h2 class="originalname" lang="…">…</h2>` in the masthead — only when it differs from the
// primary display name (English films / films whose display title *is* the original get none).
export function parseOriginalTitle(html: string): string | undefined {
  const match = html.match(/<h2 class="originalname"[^>]*>([\s\S]*?)<\/h2>/);
  if (!match) return undefined;
  const text = decodeEntities(match[1].replace(/<[^>]+>/g, "")).trim();
  return text || undefined;
}

async function fetchFilmPage(
  slug: string,
): Promise<{ ok: boolean; year?: number; language?: string; originalTitle?: string; director?: string; animated?: boolean }> {
  try {
    const res = await fetch(`https://letterboxd.com/film/${slug}/`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return { ok: false };
    const html = await res.text();
    const yearMatch = html.match(/<meta property="og:title" content="[^"]*\((\d{4})\)"/);
    return {
      ok: true,
      year: yearMatch ? Number(yearMatch[1]) : undefined,
      language: parsePrimaryLanguage(html),
      originalTitle: parseOriginalTitle(html),
      director: parseDirector(html),
      animated: parseIsAnimated(html),
    };
  } catch {
    return { ok: false };
  }
}

function slugFromUrl(url: string): string | undefined {
  return url.match(/letterboxd\.com\/film\/([^/]+)/)?.[1];
}

export interface LetterboxdMatch {
  url?: string;
  // The year from the resolved Letterboxd page's `og:title` — treated as the source of truth for
  // a film's year, since cinema listings are unreliable (IFI tags everything with the season year,
  // Light House stamps re-releases with the current year).
  year?: number;
  // The page's "Primary Language" — set only when it isn't English (lib/aggregate.ts folds it
  // into the screening's `screeningTags` so lib/languages.ts surfaces it).
  language?: string;
  // The page's original-language title (native script), when it differs from the display name —
  // shown dimmed before the title on the card (lib/aggregate.ts, FilmCard).
  originalTitle?: string;
  // The page's director(s), comma-joined for a co-directed film — shown next to the runtime on
  // the card's meta line (lib/aggregate.ts, FilmCard).
  director?: string;
  // Whether Letterboxd files the film under "Animation" — lib/aggregate.ts uses this to decide
  // whether to assume a non-English session is subtitled (decision #17). Not shown in the UI.
  animated?: boolean;
}

// A cache entry is the resolved URL plus what's read off that page (year, primary language,
// original title). Legacy entries were a bare URL string (or null), or `{ url, year }` / `{ url,
// year, language }` with fields missing; all migrate on read and re-resolve once to backfill.
// A `null` for a field means "resolved, none"; a missing key means "not checked yet".
type CacheEntry = {
  url: string | null;
  year: number | null;
  language?: string | null;
  originalTitle?: string | null;
  director?: string | null;
  animated?: boolean | null;
};
type LetterboxdCache = Record<string, CacheEntry | string | null>;
type LetterboxdOverrides = Record<string, string | null>;

function normaliseEntry(raw: CacheEntry | string | null): CacheEntry | null {
  if (raw === null) return null;
  if (typeof raw === "string") return { url: raw, year: null };
  return raw;
}

function entryToMatch(entry: CacheEntry): LetterboxdMatch {
  return {
    url: entry.url ?? undefined,
    year: entry.year ?? undefined,
    language: entry.language ?? undefined,
    originalTitle: entry.originalTitle ?? undefined,
    director: entry.director ?? undefined,
    animated: entry.animated ?? undefined,
  };
}

// True once an entry has been fully resolved against a real page — year, language and original
// title all recorded. A `year: null` (page had no `og:title` year) or a missing `language` /
// `originalTitle` / `director` / `animated` key forces a re-resolve.
function isResolved(entry: CacheEntry): boolean {
  return (
    entry.year !== null &&
    entry.language !== undefined &&
    entry.originalTitle !== undefined &&
    entry.director !== undefined &&
    entry.animated !== undefined
  );
}

let memoryCache: LetterboxdCache | undefined;
let memoryOverrides: LetterboxdOverrides | undefined;

function cacheKey(title: string, year?: number): string {
  return `${title}|${year ?? ""}`;
}

async function loadCache(): Promise<LetterboxdCache> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    memoryCache = JSON.parse(raw) as LetterboxdCache;
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}

async function saveCache(cache: LetterboxdCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

// Manual corrections for titles the automatic slug-guessing gets wrong (or that shouldn't have a
// link at all, via a `null` entry) — checked before the cache/auto-resolve, so a fix persists
// across every future weekly batch instead of needing to be re-applied each time.
async function loadOverrides(): Promise<LetterboxdOverrides> {
  if (memoryOverrides) return memoryOverrides;
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
    memoryOverrides = JSON.parse(raw) as LetterboxdOverrides;
  } catch {
    memoryOverrides = {};
  }
  return memoryOverrides;
}

export async function resolveLetterboxd(title: string, year?: number): Promise<LetterboxdMatch> {
  const key = cacheKey(title, year);
  const overrides = await loadOverrides();
  const cache = await loadCache();

  const cached = normaliseEntry(cache[key] ?? null);

  if (key in overrides) {
    const url = overrides[key] ?? undefined;
    if (!url) return {};
    // Reuse the cached result only if it belongs to this exact override URL and is fully resolved.
    if (cached && cached.url === url && isResolved(cached)) {
      return entryToMatch(cached);
    }
    const slug = slugFromUrl(url);
    const page = slug ? await fetchFilmPage(slug) : undefined;
    const entry: CacheEntry = {
      url,
      year: page?.year ?? null,
      language: page?.language ?? null,
      originalTitle: page?.originalTitle ?? null,
      director: page?.director ?? null,
      animated: page?.animated ?? null,
    };
    cache[key] = entry;
    await saveCache(cache);
    return entryToMatch(entry);
  }

  if (key in cache && cached !== null && isResolved(cached)) {
    return entryToMatch(cached);
  }
  if (key in cache && cached === null) {
    return {};
  }

  const baseSlug = slugify(cleanTitleForMatching(title));
  const candidates = year ? [`${baseSlug}-${year}`, baseSlug] : [baseSlug];

  let match: LetterboxdMatch = {};
  for (const slug of candidates) {
    const page = await fetchFilmPage(slug);
    if (!page.ok) continue;
    if (year && page.year && Math.abs(page.year - year) > 1) continue;
    match = {
      url: `https://letterboxd.com/film/${slug}/`,
      year: page.year,
      language: page.language,
      originalTitle: page.originalTitle,
      director: page.director,
      animated: page.animated,
    };
    break;
  }

  cache[key] = match.url
    ? {
        url: match.url,
        year: match.year ?? null,
        language: match.language ?? null,
        originalTitle: match.originalTitle ?? null,
        director: match.director ?? null,
        animated: match.animated ?? null,
      }
    : null;
  await saveCache(cache);
  return match;
}
