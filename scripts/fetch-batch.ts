import { promises as fs } from "fs";
import path from "path";
import { refreshShowtimesForRange } from "@/lib/aggregate";
import { upcomingDays } from "@/lib/date";
import type { Screening } from "@/lib/scrapers/types";

const STAGING_FILE = path.join(process.cwd(), "data", "staging-batch.json");

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
  const { screenings, errors } = await refreshShowtimesForRange(days);

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
    labels = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "film-labels.json"), "utf-8"));
  } catch {
    labels = {};
  }
  console.log("\nLabels (edit data/film-labels.json — read at build, no re-fetch needed):\n");
  for (const f of films) {
    const key = f.filmTitle.trim().toLowerCase();
    console.log(`  ${key}  →  ${labels[key] ?? "—"}`);
  }

  console.log(`\nWrote ${STAGING_FILE}`);
  console.log("Review the report above, then run `npm run fetch:confirm` to publish.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
