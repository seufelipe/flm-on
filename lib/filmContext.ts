import type { CinemaId } from "./scrapers/types";
import { CINEMA_LABEL } from "./cinemas";
import { formatWeekdayDate } from "./date";

// The kicker line(s) above a film card's title (decision #29): the context a cinema put in front
// of the title ("Black History Month", "Emmy Shigeta & Jack Reynor Present"), lifted off it by a
// `contextPrefixes` entry and kept per session.
//
// A prefix belongs to one cinema's listing, not to the film — Lesbian Lines is "International
// Lesbian Day:" at the IFI and plain at Light House. So when only some of a card's sessions carry
// a context, the kicker also says where and when ("IFI, Thu 8 Oct"); when they all do, the text
// alone. Past MAX_WHERE such sessions it drops the where-and-when rather than become a listing
// (the same cap as the sticker tooltips).

export interface FilmContext {
  text: string;
  where?: string;
}

const MAX_WHERE = 3;

export function filmContexts(
  sessions: { cinema: CinemaId; date: string; context?: string }[],
): FilmContext[] {
  const byText = new Map<string, { cinema: CinemaId; date: string }[]>();
  for (const s of sessions) {
    if (!s.context) continue;
    const list = byText.get(s.context) ?? [];
    list.push({ cinema: s.cinema, date: s.date });
    byText.set(s.context, list);
  }

  const out: FilmContext[] = [];
  for (const [text, carrying] of byText) {
    if (carrying.length === sessions.length) {
      out.push({ text });
      continue;
    }
    const places = Array.from(
      new Set(
        [...carrying]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s) => `${CINEMA_LABEL[s.cinema]}, ${formatWeekdayDate(s.date)}`),
      ),
    );
    out.push(places.length <= MAX_WHERE ? { text, where: places.join(" & ") } : { text });
  }
  return out;
}
