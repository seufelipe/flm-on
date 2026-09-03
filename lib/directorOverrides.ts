import { promises as fs } from "fs";
import path from "path";

const OVERRIDES_FILE = path.join(process.cwd(), "data", "director-overrides.json");

// Manual per-film director corrections, checked before Letterboxd's parsed "Directed by" value.
// Keyed by the cleaned film title lower-cased (`filmTitle.trim().toLowerCase()` — same as
// data/film-labels.json). Letterboxd's meta only carries the primary director, so a co-directed
// film (City of God — Fernando Meirelles & Kátia Lund) needs the full credit pinned here.
export type DirectorOverrides = Record<string, string>;

let cached: DirectorOverrides | undefined;

export async function loadDirectorOverrides(): Promise<DirectorOverrides> {
  if (cached) return cached;
  try {
    cached = JSON.parse(await fs.readFile(OVERRIDES_FILE, "utf-8")) as DirectorOverrides;
  } catch {
    cached = {};
  }
  return cached;
}

export function directorOverrideFor(title: string, overrides: DirectorOverrides): string | undefined {
  return overrides[title.trim().toLowerCase()];
}
