import * as cheerio from "cheerio";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { CinemaAdapter, ProgrammeFilm, Screening } from "./types";

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

type DayScreening = { isProgramme?: boolean } & Pick<
  Screening,
  | "filmTitle"
  | "cert"
  | "durationMins"
  | "year"
  | "date"
  | "time"
  | "bookingUrl"
  | "filmPageUrl"
  | "screeningTags"
>;

// IFI marks a session with small SVG icons (`svg[data-icon="…"]`) inside each booking link.
// Map the ones worth carrying into `screeningTags`; ignore the ubiquitous `wheelchair` and the
// `runtime` clock. "70mm" surfaces as a film format (lib/formats.ts); "Open Captioned" is
// carried for parity with Light House but not currently shown (lib/screeningTags.ts).
const ICON_TAGS: Record<string, string> = {
  "70mm": "70mm",
  "open-captioned": "Open Captioned",
};

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

    // A shorts programme names "Various" where a film names its director — the one signal on the
    // listing that the card is several films. Their titles are only on the film page.
    const isProgramme = $card
      .find(".tags .tag")
      .toArray()
      .some((t) => /^various$/i.test($(t).text().trim()));

    // The "Learn more" CTA points at the cinema's own film page, e.g. `/films/tony?date=…`.
    const ctaHref = $card.find('.screening-card__ctas a[href*="/films/"]').attr("href") ?? "";
    const slugMatch = ctaHref.match(/\/films\/([^/?#]+)/);
    const filmPageUrl = slugMatch ? `${SITE_BASE}/films/${slugMatch[1]}` : undefined;

    $card.find("a.screening-card__screening").each((_, a) => {
      const $a = $(a);
      const bookingUrl = ($a.attr("href") ?? "").trim();
      const time = $a.find(".screening-card__time").text().trim();
      if (!bookingUrl || !time) return;

      const iconTags = Array.from(
        new Set(
          $a
            .find("svg[data-icon]")
            .toArray()
            .map((svg) => ICON_TAGS[$(svg).attr("data-icon") ?? ""])
            .filter((t): t is string => Boolean(t)),
        ),
      );

      screenings.push({
        filmTitle,
        cert,
        durationMins,
        year,
        date,
        time,
        bookingUrl,
        filmPageUrl,
        screeningTags: iconTags.length ? iconTags : undefined,
        ...(isProgramme && { isProgramme }),
      });
    });
  });

  return screenings;
}

// The films in a shorts programme, from its film page's synopsis: IFI lists them as
// `<br>`-separated "Title – Director" lines, sometimes under "Programme includes:", sometimes
// straight after the blurb. A line counts when it has exactly one spaced dash and is short —
// a prose sentence can use dashes too ("the rituals – sacred and everyday – that…"). The
// longest run of consecutive such lines is the list; a lone match isn't one. Returns [] when
// nothing parses, which the batch report flags rather than hiding (CLAUDE.md decision #28).
export function parseProgrammeFilms(html: string): ProgrammeFilm[] {
  const $ = cheerio.load(html);
  const lines = ($(".film-info__synopsis").html() ?? "")
    .split(/<br\s*\/?>|<\/p>/i)
    .map((chunk) => cheerio.load(chunk).text().replace(/\s+/g, " ").trim());

  const parse = (line: string): ProgrammeFilm | undefined => {
    if (line.length > 100) return undefined;
    const parts = line.split(/\s[–—-]\s/);
    if (parts.length !== 2) return undefined;
    const title = parts[0].trim();
    const director = parts[1].replace(/\.$/, "").trim();
    return title && director ? { title, director } : undefined;
  };

  let best: ProgrammeFilm[] = [];
  let run: ProgrammeFilm[] = [];
  for (const line of lines) {
    const film = line ? parse(line) : undefined;
    if (film) run.push(film);
    else if (line) run = [];
    if (run.length > best.length) best = [...run];
  }
  return best.length >= 2 ? best : [];
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

      // One extra request per distinct programme page. A failed page leaves that programme with
      // an empty list rather than failing the whole cinema.
      const programmePages = Array.from(
        new Set(perDay.flat().flatMap((s) => (s.isProgramme && s.filmPageUrl ? [s.filmPageUrl] : []))),
      );
      const programmes = new Map(
        await mapWithConcurrency(programmePages, 4, async (url): Promise<[string, ProgrammeFilm[]]> => {
          try {
            return [url, parseProgrammeFilms(await fetchHtml(url))];
          } catch {
            return [url, []];
          }
        }),
      );

      const screenings: Screening[] = perDay.flat().map(({ isProgramme, ...s }) => ({
        cinema: "ifi" as const,
        cinemaName: "IFI",
        ...s,
        ...(isProgramme && { programme: [...(programmes.get(s.filmPageUrl ?? "") ?? [])] }),
      }));

      return { screenings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { screenings: [], error: message };
    }
  },
};
