import * as cheerio from "cheerio";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { CinemaAdapter, Screening } from "./types";

const WHATSON_URL = "https://ifi.ie/whatson/now-showing-coming-soon/";
const SHOP_BASE = "https://shop.ifi.ie";
const USER_AGENT = "flm-personal-cinema-app/1.0 (+personal showtime planner)";

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

// Event pages label dates like "Sunday 23 Aug" with no year — resolve to the nearest
// occurrence on or after `refISO`.
export function resolveDateLabel(label: string, refISO: string): string | undefined {
  const match = label.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  if (!month) return undefined;
  const refYear = Number(refISO.slice(0, 4));
  for (const year of [refYear, refYear + 1]) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso >= refISO) return iso;
  }
  return `${refYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface EventListing {
  title: string;
  eventUrl: string;
}

interface EventSchedule {
  durationMins?: number;
  sessions: { date: string; time: string; bookingUrl: string }[];
}

export function parseWhatsonPage(html: string): EventListing[] {
  const $ = cheerio.load(html);
  const listings = new Map<string, EventListing>();

  $(".showtoday ul li").each((_, el) => {
    const link = $(el).find("p strong a").first();
    const title = link.text().trim();
    const href = (link.attr("href") ?? "").trim();
    if (title && href && !listings.has(href)) {
      listings.set(href, { title, eventUrl: href });
    }
  });

  return Array.from(listings.values());
}

// A film's own event page reveals its multi-day forward schedule (~5 days) plus run time —
// unrestricted by robots.txt, unlike the whatson page which only shows "today".
export function parseEventPage(html: string, refISO: string): EventSchedule {
  const $ = cheerio.load(html);

  const runTimeText = $(".eventItemDetail p").first().text();
  const runTimeMatch = runTimeText.match(/Run Time:\s*(\d+)\s*mins?/i);
  const durationMins = runTimeMatch ? Number(runTimeMatch[1]) : undefined;

  const sessions: EventSchedule["sessions"] = [];
  let currentDate: string | undefined;
  $(".date, .times").each((_, el) => {
    const $el = $(el);
    if ($el.hasClass("date")) {
      currentDate = resolveDateLabel($el.text().trim(), refISO);
    } else if (currentDate) {
      $el.find('a[href^="/performance/"]').each((_, a) => {
        const $a = $(a);
        const href = ($a.attr("href") ?? "").trim();
        const time = $a.find(".time").text().trim();
        if (href && time && currentDate) {
          sessions.push({ date: currentDate, time, bookingUrl: `${SHOP_BASE}${href}` });
        }
      });
    }
  });

  return { durationMins, sessions };
}

// Note: the whatson page only lists films screening *today*, so a film whose run starts a few
// days from now without a screening today would be missed entirely — a known gap accepted in
// planning, since IFI doesn't expose a single "full week" listing outside per-event pages.
export const ifiAdapter: CinemaAdapter = {
  id: "ifi",
  name: "IFI",
  async fetchScreenings({ days }) {
    try {
      const html = await fetchHtml(WHATSON_URL);
      const listings = parseWhatsonPage(html);
      if (listings.length === 0) {
        return { screenings: [] };
      }

      const refISO = days.slice().sort()[0] ?? days[0];
      const schedules = await mapWithConcurrency(listings, 4, async (entry) => {
        const eventHtml = await fetchHtml(entry.eventUrl);
        return parseEventPage(eventHtml, refISO);
      });

      const screenings: Screening[] = listings.flatMap((entry, i) =>
        schedules[i].sessions
          .filter((s) => days.includes(s.date))
          .map((s) => ({
            cinema: "ifi" as const,
            cinemaName: "IFI",
            filmTitle: entry.title,
            durationMins: schedules[i].durationMins,
            date: s.date,
            time: s.time,
            bookingUrl: s.bookingUrl,
          })),
      );

      return { screenings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { screenings: [], error: message };
    }
  },
};
