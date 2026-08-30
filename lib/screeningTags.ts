// Per-session descriptors (Screening.screeningTags) come from the cinema verbatim — "Parent and
// Baby", "Cinema Book Club", "Dubbed", "Subtitled", "Open Captioned", "35mm"… Only a small set
// is worth surfacing: the special-audience / curated-event screenings. Format notes (subtitled
// vs dubbed, captions, print gauge) are captured in the data but deliberately not shown — to
// add one, give it an entry below.
//
// U+FE0E forces the text (monochrome) presentation of the smiley so it matches the flat ink UI
// rather than rendering as a colour emoji. The filled ☻ reads better at small sizes than the
// outline ☺.
const MARK = "☻︎";

// `label` is the lowercase form shown in the sticker; `title` + `description` fill the tooltip
// (and the sticker's accessible name). Descriptions are lightly cleaned-up versions of Light
// House's own `data-tooltip` text.
interface KnownTag {
  symbol: string;
  label: string;
  title: string;
  description: string;
  // Whether this tag renders a visible ☻ mark / marquee sticker. Default true. A `false` tag
  // still counts as a surfaced special (Highlights filter, tooltip) but shows no glyph — for
  // Mystery Matinee, whose card already has its own redacted treatment, so the badge is noise.
  mark?: boolean;
}

const KNOWN: Record<string, KnownTag> = {
  "parent and baby": {
    symbol: MARK,
    label: "parent & baby",
    title: "Parent & Baby",
    description: "The volume is turned down and the lights kept low for the baby's comfort.",
  },
  relaxed: {
    symbol: MARK,
    label: "relaxed",
    title: "Relaxed screening",
    description:
      "Lower sound, lights kept dim, and freedom to move around or make noise — for anyone who'd find a regular screening overwhelming.",
  },
  "autism friendly": {
    symbol: MARK,
    label: "relaxed",
    title: "Relaxed screening",
    description:
      "Lower sound, lights kept dim, and freedom to move around or make noise — for anyone who'd find a regular screening overwhelming.",
  },
  "cinema book club": {
    symbol: MARK,
    label: "cinema book club",
    title: "Cinema Book Club",
    description: "A monthly book-club pick, with a group chat after the screening.",
  },
  "silver screen": {
    symbol: MARK,
    label: "silver screen",
    title: "Silver Screen",
    description:
      "A matinee for over-65s, with complimentary tea or coffee, a short introduction and a chat.",
  },
  // Cineworld strands (Showtime.Event.* — see lib/scrapers/cineworld.ts).
  // Big Screen Classics gets no ☻ mark or sticker (mark: false) — instead scripts/fetch-batch.ts
  // pre-fills a curated `classic!` label (data/film-labels.json) for these films, which the user
  // reviews. It still counts as a surfaced special so it's recognised (not "unrecognised") and
  // its films pass the Highlights filter.
  "big screen classics": {
    symbol: MARK,
    label: "big screen classics",
    title: "Big Screen Classics",
    description: "An older film brought back to the big screen for a limited run.",
    mark: false,
  },
  "movies for juniors": {
    symbol: MARK,
    label: "movies for juniors",
    title: "Movies for Juniors",
    description: "A cut-price weekend-morning screening of a recent family film, for kids and parents.",
  },
  // The IFI's recurring strand where the film is kept secret until the lights go down. Not a
  // scraped descriptor — lib/mystery.ts detects it from the title and ScreeningBrowser attaches
  // this tag so it flows through the same mark / sticker / Highlights path as the rest.
  "mystery matinee": {
    symbol: MARK,
    label: "mystery matinee",
    title: "Mystery Matinee",
    description: "The film isn't announced — you find out what you're watching once it starts.",
    mark: false,
  },
};

export type ScreeningTagDisplay = KnownTag;

// Maps raw tags to their display form, dropping anything not in KNOWN and de-duplicating by
// label (so "Relaxed" + "Autism Friendly" on one session collapse to a single "relaxed").
export function displayScreeningTags(tags?: string[]): ScreeningTagDisplay[] {
  if (!tags?.length) return [];
  const out: ScreeningTagDisplay[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const known = KNOWN[tag.trim().toLowerCase()];
    if (!known || seen.has(known.label)) continue;
    seen.add(known.label);
    out.push(known);
  }
  return out;
}

// "<name> — <description>" for the surfaced tags, joined if there's more than one. Used as the
// hover `title` on the whole pill / plan-row button and on the marquee sticker.
export function screeningTagsTooltip(tags?: string[]): string | undefined {
  const display = displayScreeningTags(tags);
  if (display.length === 0) return undefined;
  return display.map((t) => `${t.title} — ${t.description}`).join(" · ");
}
