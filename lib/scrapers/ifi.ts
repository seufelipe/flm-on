import * as cheerio from "cheerio";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { CinemaAdapter, Screening } from "./types";

const WHATSON_URL = "https://ifi.ie/whats-on";
const USER_AGENT = "flm-personal-cinema-app/1.0 (+personal showtime planner)";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function parseRuntime(text: string): number | undefined {
  const match = text.match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : undefined;
}

function parseCert(alt: string | undefined): string | undefined {
  if (!alt) return undefined;
  const cleaned = alt.replace(/\s*rating\s*$/i, "").trim().toUpperCase();
  // IFI also uses the age-rating slot for a non-classification "Club" badge (IFI Film Club) —
  // only keep values that look like an actual Irish film cert.
  return /^(G|PG|12A?|15A?|16|18)$/.test(cleaned) ? cleaned : undefined;
}

const SITE_BASE = "https://ifi.ie";

type DayScreening = Pick<
  Screening,
  "filmTitle" | "cert" | "durationMins" | "year" | "date" | "time" | "bookingUrl" | "filmPageUrl"
>;

// The redesigned /whats-on page (Astro, 2026) is date-scoped via `?date=YYYY-MM-DD` and renders
// every screening for that day inline as `article.screening-card` — no per-event page walk. Each
// day is one request, so a full week is one fetch per requested date. This also closes the old
// "listing only shows today" gap: a film whose run starts mid-week is now discovered directly.
export function parseWhatsonDay(html: string, date: string): DayScreening[] {
  const $ = cheerio.load(html);
  const screenings: DayScreening[] = [];

  $("article.screening-card").each((_, el) => {
    const $card = $(el);
    const filmTitle = $card.find(".screening-card__title").first().text().trim();
    if (!filmTitle) return;

    const durationMins = parseRuntime($card.find(".screening-card__runtime").text());
    const cert = parseCert($card.find(".age-rating img").attr("alt"));

    // The card's `.tags` block is `[year, director]` for a normal film; the shorts-programme
    // strands ("Archive at Lunchtime …") carry no year tag.
    let year: number | undefined;
    $card.find(".tags .tag").each((_, t) => {
      const m = $(t).text().trim().match(/^(19|20)\d{2}$/);
      if (m && year === undefined) year = Number(m[0]);
    });

    // The "Learn more" CTA points at the cinema's own film page, e.g. `/films/tony?date=…`.
    const ctaHref = $card.find('.screening-card__ctas a[href*="/films/"]').attr("href") ?? "";
    const slugMatch = ctaHref.match(/\/films\/([^/?#]+)/);
    const filmPageUrl = slugMatch ? `${SITE_BASE}/films/${slugMatch[1]}` : undefined;

    $card.find("a.screening-card__screening").each((_, a) => {
      const $a = $(a);
      const bookingUrl = ($a.attr("href") ?? "").trim();
      const time = $a.find(".screening-card__time").text().trim();
      if (bookingUrl && time) {
        screenings.push({ filmTitle, cert, durationMins, year, date, time, bookingUrl, filmPageUrl });
      }
    });
  });

  return screenings;
}

export const ifiAdapter: CinemaAdapter = {
  id: "ifi",
  name: "IFI",
  async fetchScreenings({ days }) {
    try {
      const perDay = await mapWithConcurrency(days, 4, async (date) => {
        const html = await fetchHtml(`${WHATSON_URL}?date=${date}`);
        return parseWhatsonDay(html, date);
      });

      const screenings: Screening[] = perDay.flat().map((s) => ({
        cinema: "ifi" as const,
        cinemaName: "IFI",
        ...s,
      }));

      return { screenings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { screenings: [], error: message };
    }
  },
};
