import { promises as fs } from "fs";
import path from "path";
import type { Screening } from "./scrapers/types";

// Both cinemas' programs change roughly weekly (Thursdays), so there's no need to re-scrape
// more often than this — "Refresh now" in the UI covers the rare case of wanting fresher data.
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const CACHE_FILE = path.join(process.cwd(), "data", "cache.json");

interface CacheEntry {
  screenings: Screening[];
  fetchedAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

function key(cinemaId: string, date: string): string {
  return `${cinemaId}:${date}`;
}

export function getFresh(cinemaId: string, date: string): CacheEntry | undefined {
  const entry = memoryCache.get(key(cinemaId, date));
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return undefined;
  return entry;
}

export function set(cinemaId: string, date: string, screenings: Screening[]): void {
  memoryCache.set(key(cinemaId, date), { screenings, fetchedAt: Date.now() });
}

export function invalidate(cinemaId: string, date: string): void {
  memoryCache.delete(key(cinemaId, date));
}

export async function persistToFile(): Promise<void> {
  const entries: Record<string, CacheEntry> = {};
  for (const [k, v] of memoryCache.entries()) {
    entries[k] = v;
  }
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export async function loadFallbackFromFile(cinemaId: string, date: string): Promise<CacheEntry | undefined> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    return parsed[key(cinemaId, date)];
  } catch {
    return undefined;
  }
}
