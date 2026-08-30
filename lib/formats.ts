// Film-format descriptors — print gauge / large format (35mm, 70mm, IMAX). These ride the same
// per-session carrier as the special-screening tags (Screening.screeningTags, raw strings), but
// they're a separate concept with their own rendering: a small box on the film card sized to the
// format ("bigger format = taller"), and a bare ratio-shaped rectangle on each showtime pill.
// See lib/screeningTags.ts for the special-audience / curated-event side of the same field.
//
// Sources: Light House puts "35mm" in em.additional; IFI encodes "70mm" as an svg[data-icon]
// on each booking link (see lib/scrapers/ifi.ts); Cineworld tags an IMAX session
// `Format.Projection.Imax`, which lib/scrapers/cineworld.ts normalises to "IMAX" (it also files
// its ": The IMAX Experience" companion-movie showings under a synthesised "IMAX" tag).

export interface FilmFormat {
  id: string; // stable slug, also the de-dupe key
  label: string; // shown in the card box
  // width / height of the rendered box. All formats render at the same width, so a smaller
  // ratio is a taller box: 35mm (landscape) < 70mm (a touch taller) < IMAX (tallest).
  ratio: number;
  title: string; // tooltip heading
  description: string;
}

const FORMAT_35MM: FilmFormat = {
  id: "35mm",
  label: "35mm",
  ratio: 1.5,
  title: "35mm film",
  description: "Projected from a 35mm print rather than a digital file.",
};

const FORMAT_70MM: FilmFormat = {
  id: "70mm",
  label: "70mm",
  ratio: 1.2,
  title: "70mm film",
  description: "Projected from a large-format 70mm print — a bigger, sharper image than 35mm.",
};

const FORMAT_IMAX: FilmFormat = {
  id: "imax",
  label: "IMAX",
  ratio: 0.95,
  title: "IMAX",
  description: "Shown in IMAX — the largest frame and screen format.",
};

// Keyed by the normalized (`.trim().toLowerCase()`) raw tag. Aliases collapse onto one format.
const FORMATS: Record<string, FilmFormat> = {
  "35mm": FORMAT_35MM,
  "35 mm": FORMAT_35MM,
  "70mm": FORMAT_70MM,
  "70 mm": FORMAT_70MM,
  imax: FORMAT_IMAX,
  "imax 70mm": FORMAT_IMAX,
  "15/70": FORMAT_IMAX,
  "1570": FORMAT_IMAX,
  "format.projection.imax": FORMAT_IMAX,
};

// Maps raw tags to their format display form, dropping anything not a known format and
// de-duplicating by id. Mirrors displayScreeningTags in lib/screeningTags.ts.
export function displayFilmFormats(tags?: string[]): FilmFormat[] {
  if (!tags?.length) return [];
  const out: FilmFormat[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const format = FORMATS[tag.trim().toLowerCase()];
    if (!format || seen.has(format.id)) continue;
    seen.add(format.id);
    out.push(format);
  }
  return out;
}

// "<title> — <description>" for each format, joined if there's more than one. Merged into the
// hover `title` on the whole pill / plan-row button alongside screeningTagsTooltip.
export function filmFormatsTooltip(tags?: string[]): string | undefined {
  const display = displayFilmFormats(tags);
  if (display.length === 0) return undefined;
  return display.map((f) => `${f.title} — ${f.description}`).join(" · ");
}
