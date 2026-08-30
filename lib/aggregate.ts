import { adapters } from "./scrapers";
import type { Screening } from "./scrapers/types";
import * as cache from "./cache";
import { resolveLetterboxd, type LetterboxdMatch } from "./letterboxd";
import { cleanFilmTitle, titleAnnotation, titlesEquivalent, loadTitleOverrides } from "./titles";
import { loadHiddenFilms, isHiddenFilm } from "./hidden";
import { loadLanguageOverrides, languageOverrideFor } from "./languageOverrides";

export interface AdapterError {
  cinema: string;
  message: string;
}

export interface DayResult {
  screenings: Screening[];
  errors: AdapterError[];
  stale: boolean;
  fetchedAt?: number;
  // Trailing annotations `cleanFilmTitle` stripped, keyed by the cleaned title lower-cased —
  // scripts/fetch-batch.ts pre-fills these as editorial labels (decision #11). Not persisted.
  titleAnnotations: Record<string, string>;
}

async function getCinemaRange(
  adapter: (typeof adapters)[number],
  dates: string[],
): Promise<{ screenings: Screening[]; error?: string; stale: boolean; fetchedAt?: number }> {
  const fromCache = new Map<string, Screening[]>();
  const missing: string[] = [];
  let latestFetchedAt: number | undefined;

  for (const date of dates) {
    const fresh = cache.getFresh(adapter.id, date);
    if (fresh) {
      fromCache.set(date, fresh.screenings);
      if (!latestFetchedAt || fresh.fetchedAt > latestFetchedAt) latestFetchedAt = fresh.fetchedAt;
    } else {
      missing.push(date);
    }
  }

  if (missing.length === 0) {
    return { screenings: dates.flatMap((d) => fromCache.get(d) ?? []), stale: false, fetchedAt: latestFetchedAt };
  }

  try {
    const result = await adapter.fetchScreenings({ days: missing });
    if (result.error && result.screenings.length === 0) {
      const fallbacks = await Promise.all(missing.map((d) => cache.loadFallbackFromFile(adapter.id, d)));
      const anyFallback = fallbacks.some(Boolean);
      if (anyFallback) {
        missing.forEach((d, i) => {
          const fb = fallbacks[i];
          if (fb) {
            fromCache.set(d, fb.screenings);
            if (!latestFetchedAt || fb.fetchedAt > latestFetchedAt) latestFetchedAt = fb.fetchedAt;
          }
        });
        return { screenings: dates.flatMap((d) => fromCache.get(d) ?? []), error: result.error, stale: true, fetchedAt: latestFetchedAt };
      }
      return { screenings: dates.flatMap((d) => fromCache.get(d) ?? []), error: result.error, stale: false, fetchedAt: latestFetchedAt };
    }

    const now = Date.now();
    for (const date of missing) {
      // Cache an empty slice too — a cinema that never has data for a given date (e.g. Light
      // House beyond today) shouldn't be re-fetched on every single subsequent request.
      const slice = result.screenings.filter((s) => s.date === date);
      cache.set(adapter.id, date, slice);
      fromCache.set(date, slice);
    }
    return { screenings: dates.flatMap((d) => fromCache.get(d) ?? []), error: result.error, stale: false, fetchedAt: now };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const fallbacks = await Promise.all(missing.map((d) => cache.loadFallbackFromFile(adapter.id, d)));
    const anyFallback = fallbacks.some(Boolean);
    if (anyFallback) {
      missing.forEach((d, i) => {
        const fb = fallbacks[i];
        if (fb) {
          fromCache.set(d, fb.screenings);
          if (!latestFetchedAt || fb.fetchedAt > latestFetchedAt) latestFetchedAt = fb.fetchedAt;
        }
      });
      return { screenings: dates.flatMap((d) => fromCache.get(d) ?? []), error: message, stale: true, fetchedAt: latestFetchedAt };
    }
    return { screenings: dates.flatMap((d) => fromCache.get(d) ?? []), error: message, stale: false, fetchedAt: latestFetchedAt };
  }
}

// Resolves each film's Letterboxd page and — since cinema listings mis-report years (IFI tags
// everything with the current season, Light House stamps re-releases with this year) — adopts the
// year from the resolved Letterboxd page as the source of truth, keeping the scraped year only as
// a fallback for films with no match.
async function withLetterboxdLinks(screenings: Screening[]): Promise<Screening[]> {
  const languageOverrides = await loadLanguageOverrides();

  const unique = new Map<string, { title: string; year?: number }>();
  for (const s of screenings) {
    unique.set(`${s.filmTitle}|${s.year ?? ""}`, { title: s.filmTitle, year: s.year });
  }

  const resolved = new Map<string, LetterboxdMatch>();
  await Promise.all(
    Array.from(unique.entries()).map(async ([key, { title, year }]) => {
      resolved.set(key, await resolveLetterboxd(title, year));
    }),
  );

  return screenings.map((s) => {
    const match = resolved.get(`${s.filmTitle}|${s.year ?? ""}`);

    // Per-film original language: a manual override wins (a `null` override forces the film
    // unmarked), otherwise Letterboxd's "Primary Language" (only set when it isn't English).
    // Fold it into screeningTags — de-duped case-insensitively so a cinema's own per-session
    // language tag wins — where lib/languages.ts picks it up alongside the subtitled/dubbed tags.
    const override = languageOverrideFor(s.filmTitle, languageOverrides);
    const language = override === undefined ? match?.language : (override ?? undefined);
    let screeningTags = s.screeningTags;
    if (
      language &&
      !(screeningTags ?? []).some((t) => t.trim().toLowerCase() === language.toLowerCase())
    ) {
      screeningTags = [...(screeningTags ?? []), language];
    }

    return {
      ...s,
      screeningTags,
      letterboxdUrl: match?.url,
      year: match?.year ?? s.year,
    };
  });
}

export async function getShowtimesForRange(dates: string[]): Promise<DayResult> {
  const results = await Promise.all(adapters.map((a) => getCinemaRange(a, dates)));

  const titleOverrides = await loadTitleOverrides();
  const hiddenFilms = await loadHiddenFilms();
  const screenings = results
    .flatMap((r) => r.screenings)
    .map((s) => {
      const filmTitle = cleanFilmTitle(s.filmTitle, titleOverrides);
      // Drop the original title once the display title is cleaned/corrected to match it (an
      // annotation strip, or an override that lands on the same words).
      const originalTitle =
        s.originalTitle && !titlesEquivalent(s.originalTitle, filmTitle) ? s.originalTitle : undefined;
      return { ...s, filmTitle, originalTitle };
    })
    .filter((s) => !isHiddenFilm(s.filmTitle, hiddenFilms));

  // Trailing annotations (`(4K Restoration)`, `25th Anniversary`) stripped from raw titles,
  // keyed by the cleaned title — fed to the batch report's label pre-fill.
  const titleAnnotations: Record<string, string> = {};
  for (const r of results) {
    for (const s of r.screenings) {
      const cleaned = cleanFilmTitle(s.filmTitle, titleOverrides);
      if (isHiddenFilm(cleaned, hiddenFilms)) continue;
      const annotation = titleAnnotation(s.filmTitle, titleOverrides);
      if (annotation) titleAnnotations[cleaned.trim().toLowerCase()] ??= annotation;
    }
  }
  const errors: AdapterError[] = results
    .map((r, i) => (r.error ? { cinema: adapters[i].name, message: r.error } : undefined))
    .filter((e): e is AdapterError => Boolean(e));
  const stale = results.some((r) => r.stale);
  const fetchedAt = results.reduce<number | undefined>(
    (latest, r) => (r.fetchedAt && (!latest || r.fetchedAt > latest) ? r.fetchedAt : latest),
    undefined,
  );

  const withLinks = await withLetterboxdLinks(screenings);
  withLinks.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  if (!stale) {
    await cache.persistToFile();
  }

  return { screenings: withLinks, errors, stale, fetchedAt, titleAnnotations };
}

export async function refreshShowtimesForRange(dates: string[]): Promise<DayResult> {
  for (const a of adapters) {
    for (const date of dates) {
      cache.invalidate(a.id, date);
    }
  }
  return getShowtimesForRange(dates);
}
