import * as cheerio from "cheerio";
import { todayISO, daysBetweenISO } from "@/lib/date";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { CinemaAdapter, Screening } from "./types";

const BASE_URL = "https://www.lighthousecinema.ie";
const USER_AGENT = "flm-personal-cinema-app/1.0 (+personal showtime planner)";

// The day-tabs on /films run from 0 (today) to 9 (nine days out) — confirmed by driving the
// site and watching which /ajax/films-by-day/{n} requests it fires per tab.
const MAX_DAY_OFFSET = 9;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function parseCertDuration(text: string): { cert?: string; durationMins?: number } {
  const match = text.trim().match(/^(\S+)\s*\/\s*(\d+)\s*Mins?$/i);
  if (!match) return {};
  return { cert: match[1], durationMins: Number(match[2]) };
}

// The film detail page exposes "Released: DD-Mon-YYYY" — only the year is used.
export function parseReleaseYear(html: string): number | undefined {
  const $ = cheerio.load(html);
  const releasedText = $("div.details strong")
    .filter((_, el) => $(el).text().trim() === "Released:")
    .first()
    .next("span")
    .text()
    .trim();
  const match = releasedText.match(/(\d{4})$/);
  return match ? Number(match[1]) : undefined;
}

async function fetchReleaseYear(slug: string): Promise<number | undefined> {
  try {
    const html = await fetchHtml(`${BASE_URL}/film/${slug}`);
    return parseReleaseYear(html);
  } catch {
    return undefined;
  }
}

interface ParsedFilm {
  title: string;
  slug: string;
  cert?: string;
  durationMins?: number;
  times: { time: string; bookingUrl: string }[];
}

function parseFilmElements($: cheerio.CheerioAPI, filmElements: ReturnType<cheerio.CheerioAPI>): ParsedFilm[] {
  const films: ParsedFilm[] = [];

  filmElements.each((_, el) => {
    const $el = $(el);
    const titleLink = $el.find("h3 a").first();
    const title = titleLink.text().trim();
    const href = (titleLink.attr("href") ?? "").trim();
    const slugMatch = href.match(/\/film\/([^/?#]+)/);
    if (!title || !slugMatch) return;

    const { cert, durationMins } = parseCertDuration($el.find(".shortened-aside").text());

    const times: { time: string; bookingUrl: string }[] = [];
    $el.find(".times .picktime .time a").each((_, timeEl) => {
      const $time = $(timeEl);
      const time = $time.text().trim();
      const bookingUrl = ($time.attr("href") ?? "").trim();
      if (time && bookingUrl) times.push({ time, bookingUrl });
    });

    if (times.length > 0) {
      films.push({ title, slug: slugMatch[1], cert, durationMins, times });
    }
  });

  return films;
}

// The main /films page's first tab (data-name="0") is today, pre-rendered in the static HTML.
export function parseFilmsPage(html: string): ParsedFilm[] {
  const $ = cheerio.load(html);
  return parseFilmElements($, $('.tab[data-name="0"] div.film'));
}

// The other day-tabs are empty placeholders in the static page, populated client-side by
// GET /ajax/films-by-day/{n}. That response is an HTML fragment of the same `div.film` markup,
// just without the outer `.tab` wrapper.
export function parseFilmsFragment(html: string): ParsedFilm[] {
  const $ = cheerio.load(html);
  return parseFilmElements($, $("div.film"));
}

async function fetchDayOffset(offset: number): Promise<ParsedFilm[]> {
  if (offset === 0) {
    return parseFilmsPage(await fetchHtml(`${BASE_URL}/films`));
  }
  return parseFilmsFragment(await fetchHtml(`${BASE_URL}/ajax/films-by-day/${offset}`));
}

// Light House's robots.txt disallows /ajax/* (which /ajax/films-by-day/{n} falls under) — the
// only way to get anything beyond today's screenings. Revisited with the user for the public
// release's weekly-batch model (see CLAUDE.md decision #1): this now runs as a single deliberate
// fetch once a week from a manual script, not continuous per-visitor scraping, so we fetch it
// anyway rather than staying stuck on today-only data.
export const lighthouseAdapter: CinemaAdapter = {
  id: "lighthouse",
  name: "Light House Cinema",
  async fetchScreenings({ days }) {
    const today = todayISO();
    const requested = days
      .map((date) => ({ date, offset: daysBetweenISO(today, date) }))
      .filter((d) => d.offset >= 0 && d.offset <= MAX_DAY_OFFSET);

    if (requested.length === 0) {
      return { screenings: [] };
    }

    try {
      const perDay = await mapWithConcurrency(requested, 4, async ({ date, offset }) => ({
        date,
        films: await fetchDayOffset(offset),
      }));

      const allFilms = perDay.flatMap((d) => d.films.map((film) => ({ ...film, date: d.date })));
      if (allFilms.length === 0) {
        return { screenings: [] };
      }

      const uniqueSlugs = Array.from(new Set(allFilms.map((f) => f.slug)));
      const years = await mapWithConcurrency(uniqueSlugs, 4, fetchReleaseYear);
      const yearBySlug = new Map(uniqueSlugs.map((slug, i) => [slug, years[i]]));

      const screenings: Screening[] = allFilms.flatMap((film) =>
        film.times.map((t) => ({
          cinema: "lighthouse" as const,
          cinemaName: "Light House Cinema",
          filmTitle: film.title,
          cert: film.cert,
          durationMins: film.durationMins,
          year: yearBySlug.get(film.slug),
          date: film.date,
          time: t.time,
          bookingUrl: t.bookingUrl,
          filmPageUrl: `${BASE_URL}/film/${film.slug}`,
        })),
      );

      return { screenings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { screenings: [], error: message };
    }
  },
};
