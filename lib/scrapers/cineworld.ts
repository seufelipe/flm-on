import { addDaysISO } from "@/lib/date";
import { mapWithConcurrency } from "@/lib/concurrency";
import { isLanguageName } from "@/lib/languages";
import { titlesEquivalent } from "@/lib/titles";
import type { CinemaAdapter, Screening } from "./types";

// Cineworld Dublin (Parnell St) — a 16-screen multiplex, scraped in full like Light House / IFI.
// `normaliseTags` still maps the cinema's raw tag tokens onto the shared `screeningTags` vocab
// and drops the ordinary projection / premium-auditorium / audio-description tokens
// (`IGNORED_TAGS`), so an ordinary wide-release showing simply carries no tags. Hiding that
// ordinary programme is the job of the UI's "Specials, etc" Highlights lens (CLAUDE.md
// decisions #14, #16), not this adapter — nothing is dropped at scrape time.
//
// Source: cineworld.ie is a Gatsby site backed by a public, unauthenticated JSON API. robots.txt
// is empty. Two calls cover a batch window:
//   GET /api/gatsby-source-boxofficeapi/schedule?from=&to=&theaters={"id":"X07A4","timeZone":…}
//     → { X07A4: { schedule: { <movieId>: { <YYYY-MM-DD>: [ showtime … ] } } } }
//   GET /api/gatsby-source-boxofficeapi/movies?basic=false&castingLimit=1&ids=…&ids=…
//     → [ { id, title, runtime (SECONDS), certificate, release, releases[] … } ]
// The `scheduledMovies` endpoint (movieId→dates) isn't needed — the schedule call already
// returns only movies that play in the window.

const THEATER_ID = "X07A4";
const API_BASE = "https://www.cineworld.ie/api/gatsby-source-boxofficeapi";
const MOVIE_BASE = "https://www.cineworld.ie/movies";
const USER_AGENT = "flm-personal-cinema-app/1.0 (+personal showtime planner)";

// Cineworld's day boundary for the schedule range is 03:00 local (so a 00:30 show counts as the
// previous day). Match that.
const DAY_START_HHMMSS = "T03:00:00";

// ---- raw API shapes (only the fields used) ------------------------------------------------

interface RawTicketing {
  provider: string;
  urls: string[];
}
interface RawShowtime {
  id: string;
  startsAt: string; // local ISO, e.g. "2026-08-30T16:05:00"
  tags?: string[];
  data?: { ticketing?: RawTicketing[] };
}
export interface CineworldSchedule {
  [theaterId: string]: {
    schedule?: Record<string, Record<string, RawShowtime[]>>;
  };
}
export interface CineworldMovie {
  id: string;
  title?: string;
  originalTitle?: string;
  locale?: { title?: string };
  runtime?: number; // SECONDS
  certificate?: string;
  release?: string;
  releases?: { releasedAt?: string; rating?: { certificate?: string } }[];
}

// ---- tag normalisation ------------------------------------------------------------------------

// Raw Cineworld tags that carry no display meaning — dropped in `normaliseTags` so an ordinary
// showing ends up with an empty tag list. `4dx` / `screenx` / `superscreen` are premium
// auditoriums we deliberately don't surface yet (CLAUDE.md decision #15).
const IGNORED_TAGS = new Set([
  "format.projection.digital",
  "format.projection.laser",
  "format.projection.35mm", // handled by lib/formats.ts if it ever appears; not an "ordinary" drop
  "auditorium.experience.4dx",
  "auditorium.experience.screenx",
  "auditorium.experience.superscreen",
  "showtime.accessibility.audiodescription",
]);

// "BigScreenClassics" → "Big Screen Classics"; "Tamil" → "Tamil".
function splitCamel(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

// Raw tags → the shared normalised labels the display modules read (lib/formats.ts,
// lib/screeningTags.ts, lib/languages.ts). Unknown `Showtime.Event.*` / `Localization.Language.*`
// (and anything else not explicitly ignored) are kept verbatim so a new strand still surfaces in
// the batch report before it's given a proper label.
export function normaliseTags(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of raw) {
    const lower = tag.trim().toLowerCase();
    if (!lower || IGNORED_TAGS.has(lower)) continue;
    const last = tag.split(".").pop() ?? tag;
    const label = lower === "format.projection.imax" ? "IMAX" : splitCamel(last);
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

// ---- parsing --------------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function releaseYear(movie: CineworldMovie): number | undefined {
  const iso = movie.release ?? movie.releases?.find((r) => r.releasedAt)?.releasedAt;
  if (!iso) return undefined;
  const year = new Date(iso).getUTCFullYear();
  return Number.isFinite(year) ? year : undefined;
}

function cert(movie: CineworldMovie): string | undefined {
  const raw = movie.certificate ?? movie.releases?.find((r) => r.rating?.certificate)?.rating?.certificate;
  return raw ? raw.toUpperCase() : undefined;
}

// Cineworld sometimes lists IMAX as a *separate movie* — "The Odyssey: The IMAX Experience" —
// rather than a tag on the base film. Strip that suffix (and let a synthesised "IMAX" tag carry
// the format) so groupByFilm merges it back onto the base film's card. Also strip a trailing
// "(Tamil)" that just duplicates the language tag.
function cleanScheduleTitle(raw: string): { title: string; imaxFromTitle: boolean } {
  let title = raw.trim();
  let imaxFromTitle = false;

  const imaxSuffix = /\s*[-:–—]\s*the imax experience\s*$/i;
  if (imaxSuffix.test(title)) {
    title = title.replace(imaxSuffix, "").trim();
    imaxFromTitle = true;
  }

  const trailingParen = title.match(/\(([^()]+)\)\s*$/);
  if (trailingParen && isLanguageName(trailingParen[1])) {
    title = title.slice(0, trailingParen.index).trim();
  }

  return { title: title || raw.trim(), imaxFromTitle };
}

function bookingUrlOf(showtime: RawShowtime): string | undefined {
  const tickets = showtime.data?.ticketing ?? [];
  const preferred = tickets.find((t) => t.provider === "default") ?? tickets[0];
  return preferred?.urls?.[0]?.trim() || undefined;
}

// Pure — takes the two raw API payloads and the requested dates, returns every bookable session.
export function parseCineworldSchedule(
  scheduleJson: CineworldSchedule,
  movies: CineworldMovie[],
  days: string[],
): Screening[] {
  const wanted = new Set(days);
  const byId = new Map(movies.map((m) => [m.id, m]));
  const screenings: Screening[] = [];

  const schedule = scheduleJson?.[THEATER_ID]?.schedule ?? {};
  for (const [movieId, perDate] of Object.entries(schedule)) {
    const movie = byId.get(movieId);
    const rawTitle = movie?.title || movie?.locale?.title || movie?.originalTitle;
    if (!rawTitle) continue;

    const { title, imaxFromTitle } = cleanScheduleTitle(rawTitle);
    const durationSecs = movie?.runtime;
    const durationMins = durationSecs ? Math.round(durationSecs / 60) : undefined;
    const year = movie ? releaseYear(movie) : undefined;
    const certificate = movie ? cert(movie) : undefined;
    const filmPageUrl = `${MOVIE_BASE}/${movieId}-${slugify(rawTitle)}/`;
    // Carry the original-language title only when it's genuinely a different title
    // (De Gaulle → "La Bataille de Gaulle …"), not just the English title again.
    const originalTitle =
      movie?.originalTitle && !titlesEquivalent(movie.originalTitle, rawTitle)
        ? movie.originalTitle
        : undefined;

    for (const [date, showtimes] of Object.entries(perDate)) {
      if (!wanted.has(date)) continue;
      for (const showtime of showtimes) {
        const rawTags = imaxFromTitle ? [...(showtime.tags ?? []), "IMAX"] : showtime.tags;

        const bookingUrl = bookingUrlOf(showtime);
        const time = showtime.startsAt?.slice(11, 16);
        if (!bookingUrl || !time || !/^\d{2}:\d{2}$/.test(time)) continue;

        const tags = normaliseTags(rawTags);
        screenings.push({
          cinema: "cineworld",
          cinemaName: "Cineworld Dublin",
          filmTitle: title,
          originalTitle,
          cert: certificate,
          durationMins,
          year,
          date,
          time,
          bookingUrl,
          filmPageUrl,
          screeningTags: tags.length ? tags : undefined,
        });
      }
    }
  }

  return screenings;
}

// ---- adapter -------------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}

function scheduleUrl(days: string[]): string {
  const sorted = [...days].sort();
  const from = `${sorted[0]}${DAY_START_HHMMSS}`;
  const to = `${addDaysISO(sorted[sorted.length - 1], 1)}${DAY_START_HHMMSS}`;
  const theaters = encodeURIComponent(JSON.stringify({ id: THEATER_ID, timeZone: "Europe/Dublin" }));
  return `${API_BASE}/schedule?from=${from}&to=${to}&theaters=${theaters}`;
}

function moviesUrl(ids: string[]): string {
  return `${API_BASE}/movies?basic=false&castingLimit=1&${ids.map((id) => `ids=${id}`).join("&")}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// The two raw API payloads for a date range.
export async function fetchCineworldRaw(
  days: string[],
): Promise<{ scheduleJson: CineworldSchedule; movies: CineworldMovie[] }> {
  const scheduleJson = await fetchJson<CineworldSchedule>(scheduleUrl(days));
  const movieIds = Object.keys(scheduleJson?.[THEATER_ID]?.schedule ?? {});
  if (movieIds.length === 0) return { scheduleJson, movies: [] };

  // The site chunks the movies call at ~25 ids; stay under that.
  const movieChunks = await mapWithConcurrency(chunk(movieIds, 30), 4, (ids) =>
    fetchJson<CineworldMovie[]>(moviesUrl(ids)),
  );
  return { scheduleJson, movies: movieChunks.flat() };
}

export const cineworldAdapter: CinemaAdapter = {
  id: "cineworld",
  name: "Cineworld Dublin",
  async fetchScreenings({ days }) {
    if (days.length === 0) return { screenings: [] };

    try {
      const { scheduleJson, movies } = await fetchCineworldRaw(days);
      return { screenings: parseCineworldSchedule(scheduleJson, movies, days) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { screenings: [], error: message };
    }
  },
};
