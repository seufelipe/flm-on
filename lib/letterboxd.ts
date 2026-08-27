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
// bare dune, true-grit-2010 vs bare true-grit) — works reliably. The resolved page's own
// `og:title` meta tag (format "Title (YYYY)") is used to confirm the year actually matches
// before accepting the link, which is the concrete way "use year to minimize mismatch" is
// implemented here.
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

async function fetchFilmPageYear(slug: string): Promise<{ ok: boolean; year?: number }> {
  try {
    const res = await fetch(`https://letterboxd.com/film/${slug}/`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return { ok: false };
    const html = await res.text();
    const match = html.match(/<meta property="og:title" content="[^"]*\((\d{4})\)"/);
    return { ok: true, year: match ? Number(match[1]) : undefined };
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
}

// A cache entry is the resolved URL plus the year read off that page. Legacy entries were a bare
// URL string (or null); those are migrated on read, and re-resolve to pick up a year.
type CacheEntry = { url: string | null; year: number | null };
type LetterboxdCache = Record<string, CacheEntry | string | null>;
type LetterboxdOverrides = Record<string, string | null>;

function normaliseEntry(raw: CacheEntry | string | null): CacheEntry | null {
  if (raw === null) return null;
  if (typeof raw === "string") return { url: raw, year: null };
  return raw;
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
    // Reuse the cached year only if it belongs to this exact override URL.
    if (cached && cached.url === url && cached.year !== null) {
      return { url, year: cached.year };
    }
    const slug = slugFromUrl(url);
    const resolvedYear = slug ? (await fetchFilmPageYear(slug)).year : undefined;
    cache[key] = { url, year: resolvedYear ?? null };
    await saveCache(cache);
    return { url, year: resolvedYear };
  }

  if (key in cache && cached !== null && cached.year !== null) {
    return { url: cached.url ?? undefined, year: cached.year ?? undefined };
  }
  if (key in cache && cached === null) {
    return {};
  }

  const baseSlug = slugify(cleanTitleForMatching(title));
  const candidates = year ? [`${baseSlug}-${year}`, baseSlug] : [baseSlug];

  let match: LetterboxdMatch = {};
  for (const slug of candidates) {
    const page = await fetchFilmPageYear(slug);
    if (!page.ok) continue;
    if (year && page.year && Math.abs(page.year - year) > 1) continue;
    match = { url: `https://letterboxd.com/film/${slug}/`, year: page.year };
    break;
  }

  cache[key] = match.url ? { url: match.url, year: match.year ?? null } : null;
  await saveCache(cache);
  return match;
}
