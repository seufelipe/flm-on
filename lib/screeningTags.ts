// Per-session descriptors (Screening.screeningTags) come from the cinema verbatim — "Parent and
// Baby", "Cinema Book Club", "Dubbed", "Subtitled", "Open Captioned", "35mm"… Only a small set
// is worth surfacing: the special-audience / curated-event screenings. Format notes (subtitled
// vs dubbed, captions, print gauge) are captured in the data but deliberately not shown — to
// add one, give it an entry below.
//
// No `symbol` here: every surfaced strand wears the same mark, so it belongs to the renderer,
// not the data. It's <SpecialsMark> (lucide's FaceGrinning) in components/ScreeningTags.tsx — one
// component for the pill, the card sticker and the "Specials, etc" lens. See decision #13.

// `label` is the lowercase form shown in the sticker; `title` + `description` fill the tooltip
// (and the sticker's accessible name). Descriptions started as Light House's own `data-tooltip`
// text and have since been rewritten to one house style: **one ` — ` per string**, the
// title/description separator, and no second em-dash inside a description. A pill can show a
// strand and a format at once (lib/screeningTooltip.ts joins them with ` · `), so a description
// that spends its own dashes leaves the reader parsing four or five of them in a row, each
// meaning something different. Keep them under ~90 characters for the same reason: the tooltip
// is `max-w-[16rem]`, and past that it stops being a glance.
interface KnownTag {
  label: string;
  title: string;
  description: string;
  // Whether this tag renders a visible <SpecialsMark> / marquee sticker. Default true. A
  // `false` tag still counts as a surfaced special (Highlights filter, tooltip) but shows no mark
  // — for Mystery Matinee, whose card already has its own redacted treatment, so it's noise.
  mark?: boolean;
}

// Raw tags we recognise and deliberately do NOT surface. They're excluded from `KNOWN` on
// purpose, and listed here so `scripts/fetch-batch.ts` doesn't report them as "unrecognised"
// every week — the report's job is to catch a *new* strand, and a tag we've already decided
// about isn't news.
//
// "Big Screen Classics" (Cineworld) is here because, unlike every other strand in `KNOWN`, it
// changes nothing about the screening: Parent & Baby turns the sound down, Relaxed dims the
// lights, Silver Screen pours the tea, Movies for Juniors cuts the price. Big Screen Classics is
// only a statement about which film was picked — and Cineworld is the sole cinema that labels
// that, so an identical re-release at the IFI or Light House carried no mark and the tag read as
// a difference between the films rather than between the cinemas' marketing. The film-selection
// value is real, but `data/film-labels.json` already carries it as a human-reviewed editorial
// label ("40th anniversary"), which `fetch:batch` still pre-fills from this very tag. Curated
// beats automatic here, so the label is the only surface it gets. User's call.
const UNSURFACED = new Set(["big screen classics"]);

// Whether a raw tag is one we've deliberately chosen not to surface (as opposed to one we've
// never seen). Only `scripts/fetch-batch.ts` cares — it keeps the weekly report honest.
export function isUnsurfacedTag(tag: string): boolean {
  return UNSURFACED.has(tag.trim().toLowerCase());
}

const KNOWN: Record<string, KnownTag> = {
  "parent and baby": {
    label: "parent & baby",
    title: "Parent & Baby",
    description: "The volume is turned down and the lights kept low for the baby's comfort.",
  },
  relaxed: {
    label: "relaxed",
    title: "Relaxed screening",
    description: "Lower sound, dimmed lights, and freedom to move about or make noise.",
  },
  "autism friendly": {
    label: "relaxed",
    title: "Relaxed screening",
    description: "Lower sound, dimmed lights, and freedom to move about or make noise.",
  },
  "cinema book club": {
    label: "cinema book club",
    title: "Cinema Book Club",
    description: "A monthly book-club pick, with a group chat after the screening.",
  },
  "silver screen": {
    label: "silver screen",
    title: "Silver Screen",
    description: "A matinee for over-65s, with free tea or coffee and a short introduction.",
  },
  // Cineworld strands (Showtime.Event.* — see lib/scrapers/cineworld.ts). "Big Screen Classics"
  // is deliberately absent; see UNSURFACED above.
  "movies for juniors": {
    label: "movies for juniors",
    title: "Movies for Juniors",
    description: "A cut-price weekend-morning screening of a recent family film.",
  },
  // The IFI's recurring strand where the film is kept secret until the lights go down. Not a
  // scraped descriptor — lib/mystery.ts detects it from the title and ScreeningBrowser attaches
  // this tag so it flows through the same mark / sticker / Highlights path as the rest.
  "mystery matinee": {
    label: "mystery matinee",
    title: "Mystery Matinee",
    description: "The film isn't announced until it starts.",
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
