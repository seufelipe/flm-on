import { promises as fs } from "fs";
import path from "path";

const HIDDEN_FILE = path.join(process.cwd(), "data", "hidden-films.json");

// An editorial blocklist: films that must never appear on the site, from any cinema, regardless
// of how they're programmed. Matched as a case-insensitive substring against the *cleaned* film
// title (so "harry potter" catches "25 Years of Magic - Harry Potter and the Philosopher's
// Stone" and any future re-release). Applied in lib/aggregate.ts, before Letterboxd resolution,
// so a hidden film never reaches the staged/published showtimes at all.
export interface HiddenFilms {
  titleSubstrings: string[];
}

let cached: HiddenFilms | undefined;

export async function loadHiddenFilms(): Promise<HiddenFilms> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(HIDDEN_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<HiddenFilms>;
    cached = { titleSubstrings: (parsed.titleSubstrings ?? []).map((s) => s.toLowerCase()) };
  } catch {
    cached = { titleSubstrings: [] };
  }
  return cached;
}

export function isHiddenFilm(title: string, hidden: HiddenFilms): boolean {
  const t = title.trim().toLowerCase();
  return hidden.titleSubstrings.some((sub) => sub && t.includes(sub));
}
