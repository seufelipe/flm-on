import { promises as fs } from "fs";
import path from "path";
import { refreshShowtimesForRange } from "@/lib/aggregate";
import { upcomingDays } from "@/lib/date";
import type { Screening } from "@/lib/scrapers/types";
import { displayScreeningTags } from "@/lib/screeningTags";
import { displayFilmFormats } from "@/lib/formats";
import { displayLanguage, hasNonEnglishLanguage } from "@/lib/languages";
import { loadHiddenFilms } from "@/lib/hidden";
import { loadLanguageOverrides } from "@/lib/languageOverrides";

const STAGING_FILE = path.join(process.cwd(), "data", "staging-batch.json");
const LABELS_FILE = path.join(process.cwd(), "data", "film-labels.json");

// Cineworld's "Big Screen Classics" strand doesn't get a ☻ mark (lib/screeningTags.ts) — instead
// its films get a curated `classic!` label pre-filled here for the user to review.
const BIG_SCREEN_CLASSICS_TAG = "big screen classics";
const CLASSIC_LABEL = "classic!";
// Which stripped title annotations are worth pre-filling as a label — a re-release / event note,
// not a recurring-strand month/year marker.
const LABELWORTHY_ANNOTATION = /\b(?:anniversary|restoration)\b/i;

interface FilmSummary {
  filmTitle: string;
  year?: number;
  letterboxdUrl?: string;
  titleVariants: Set<string>;
}

// Keyed case/whitespace-insensitively to match lib/groupings.ts's groupByFilm — otherwise the
// same film scraped in different casing by each cinema (IFI titles are often ALL CAPS, Light
// House's aren't) would misleadingly look like two separate "unique" films in this report.
function summarizeFilms(screenings: Screening[]): FilmSummary[] {
  const seen = new Map<string, FilmSummary>();
  for (const s of screenings) {
    const key = s.filmTitle.trim().toLowerCase();
    let entry = seen.get(key);
    if (!entry) {
      entry = { filmTitle: s.filmTitle, year: s.year, letterboxdUrl: s.letterboxdUrl, titleVariants: new Set() };
      seen.set(key, entry);
    }
    entry.titleVariants.add(s.filmTitle);
    entry.year = entry.year ?? s.year;
    entry.letterboxdUrl = entry.letterboxdUrl ?? s.letterboxdUrl;
  }
  return Array.from(seen.values()).sort((a, b) => a.filmTitle.localeCompare(b.filmTitle));
}

async function main() {
  // Run this on a Thursday for a full 7-day week — on any other day it caps at the upcoming
  // Thursday, matching the boundary of the current cinema programme (see lib/date.ts).
  const days = upcomingDays();

  console.log(`Fetching ${days[0]} .. ${days[days.length - 1]} (${days.length} days)...\n`);
  const { screenings, errors, titleAnnotations } = await refreshShowtimesForRange(days);

  const hidden = await loadHiddenFilms();
  if (hidden.titleSubstrings.length > 0) {
    console.log(`Hidden films (data/hidden-films.json): ${hidden.titleSubstrings.join(", ")}\n`);
  }

  const generatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(STAGING_FILE), { recursive: true });
  await fs.writeFile(STAGING_FILE, JSON.stringify({ generatedAt, days, screenings }, null, 2), "utf-8");

  if (errors.length > 0) {
    console.log("Errors:");
    for (const e of errors) console.log(`  ${e.cinema}: ${e.message}`);
    console.log();
  }

  const films = summarizeFilms(screenings);
  console.log(`${films.length} unique films, ${screenings.length} screenings:\n`);
  for (const f of films) {
    const letterboxd = f.letterboxdUrl ?? "NOT FOUND";
    const variants = Array.from(f.titleVariants);
    const titleLabel = variants.length > 1 ? `${variants.join(" / ")} [CASING DIFFERS]` : variants[0];
    console.log(`- ${titleLabel}${f.year ? ` (${f.year})` : ""} — Letterboxd: ${letterboxd}`);
  }

  // Curated editorial tags (data/film-labels.json) — not part of the published showtimes,
  // read straight at build time. List every film's exact key so a label can be pasted in
  // during this review without guessing the apostrophe/casing.
  let labels: Record<string, string> = {};
  try {
    labels = JSON.parse(await fs.readFile(LABELS_FILE, "utf-8"));
  } catch {
    labels = {};
  }

  // Pre-fill labels for films that don't have one yet, then write data/film-labels.json back
  // (sorted) — the user reviews the diff before committing. Two sources, most specific first:
  //   - a stripped trailing annotation ("25th Anniversary", "4K Restoration") → that phrase
  //   - Big Screen Classics (Cineworld strand) with no annotation → "classic!"
  const prefill: Record<string, string> = {};
  for (const [key, annotation] of Object.entries(titleAnnotations)) {
    if (!(key in labels) && LABELWORTHY_ANNOTATION.test(annotation)) prefill[key] = annotation;
  }
  for (const s of screenings) {
    const key = s.filmTitle.trim().toLowerCase();
    if (key in labels || key in prefill) continue;
    if ((s.screeningTags ?? []).some((t) => t.trim().toLowerCase() === BIG_SCREEN_CLASSICS_TAG)) {
      prefill[key] = CLASSIC_LABEL;
    }
  }
  if (Object.keys(prefill).length > 0) {
    Object.assign(labels, prefill);
    const sorted = Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(LABELS_FILE, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
    console.log("\nPre-filled data/film-labels.json (review the diff):");
    for (const [key, value] of Object.entries(prefill).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${key}  →  ${value}`);
    }
  }

  console.log("\nLabels (edit data/film-labels.json — read at build, no re-fetch needed):\n");
  for (const f of films) {
    const key = f.filmTitle.trim().toLowerCase();
    console.log(`  ${key}  →  ${labels[key] ?? "—"}`);
  }

  // Resolved original language per film (Letterboxd "Primary Language", folded into
  // screeningTags by lib/aggregate.ts). Spot a wrong value and pin it in
  // data/language-overrides.json (title → language, or null to force unmarked).
  const langOverrides = await loadLanguageOverrides();
  const langByFilm = new Map<string, string>();
  for (const s of screenings) {
    const key = s.filmTitle.trim().toLowerCase();
    const lang = displayLanguage(s.screeningTags)?.language;
    if (lang && !langByFilm.has(key)) langByFilm.set(key, lang);
  }
  console.log("\nLanguages (non-English films — override in data/language-overrides.json):\n");
  const nonEnglish = films.filter((f) => langByFilm.has(f.filmTitle.trim().toLowerCase()));
  if (nonEnglish.length === 0) {
    console.log("  none");
  } else {
    for (const f of nonEnglish) {
      const key = f.filmTitle.trim().toLowerCase();
      const over = key in langOverrides ? `  [override: ${langOverrides[key] ?? "unmarked"}]` : "";
      console.log(`  ${key}  →  ${langByFilm.get(key)}${over}`);
    }
  }

  // Per-session descriptors the cinema attaches to a specific showtime (Light House's
  // em.additional — "Parent and Baby", "Dubbed", "Subtitled"). Only a subset surfaces in the UI
  // (see lib/screeningTags.ts); this lists every tagged session so a new/unexpected value shows up.
  const tagged = screenings
    .filter((s) => s.screeningTags?.length)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  console.log(`\nSpecial screenings (${tagged.length}):\n`);
  if (tagged.length === 0) {
    console.log("  none");
  } else {
    for (const s of tagged) {
      console.log(`  ${s.date} ${s.time}  ${s.cinemaName}  ${s.filmTitle}  →  ${s.screeningTags!.join(", ")}`);
    }
  }

  // Any raw screeningTag that no display module recognises — catches a new Cineworld strand
  // (ScreenX, a new Showtime.Event.*) or a new Light House em.additional value in one place.
  const unrecognised = new Map<string, Set<string>>();
  for (const s of screenings) {
    for (const tag of s.screeningTags ?? []) {
      const known =
        displayScreeningTags([tag]).length > 0 ||
        displayFilmFormats([tag]).length > 0 ||
        displayLanguage([tag]) !== null;
      if (!known) {
        if (!unrecognised.has(tag)) unrecognised.set(tag, new Set());
        unrecognised.get(tag)!.add(s.cinemaName);
      }
    }
  }
  console.log(`\nUnrecognised screening tags (${unrecognised.size}):\n`);
  if (unrecognised.size === 0) {
    console.log("  none");
  } else {
    for (const [tag, cinemas] of unrecognised) {
      console.log(`  ${tag}  (${Array.from(cinemas).join(", ")})`);
    }
  }

  // Cineworld is scraped in full (CLAUDE.md #16); its ordinary wide-release showings carry no
  // surfaced tag/format/language and no editorial label, so the "Specials, etc" Highlights lens
  // hides them in the UI. List them here (per-film counts) so the multiplex firehose stays
  // visible for review — a mistitled blockbuster, or one worth a label, shows up.
  const cineworldOrdinary = new Map<string, number>();
  for (const s of screenings) {
    if (s.cinema !== "cineworld") continue;
    const key = s.filmTitle.trim().toLowerCase();
    const isHighlight =
      displayScreeningTags(s.screeningTags).length > 0 ||
      displayFilmFormats(s.screeningTags).length > 0 ||
      hasNonEnglishLanguage(s.screeningTags) ||
      key in labels;
    if (!isHighlight) cineworldOrdinary.set(s.filmTitle, (cineworldOrdinary.get(s.filmTitle) ?? 0) + 1);
  }
  const ordinaryTotal = Array.from(cineworldOrdinary.values()).reduce((n, c) => n + c, 0);
  console.log(
    `\nCineworld — ordinary screenings (${ordinaryTotal} across ${cineworldOrdinary.size} films — hidden by the "Specials, etc" lens):\n`,
  );
  if (cineworldOrdinary.size === 0) {
    console.log("  none");
  } else {
    for (const [title, count] of Array.from(cineworldOrdinary).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${title}  (${count})`);
    }
  }

  console.log(`\nWrote ${STAGING_FILE}`);
  console.log("Review the report above, then run `npm run fetch:confirm` to publish.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
