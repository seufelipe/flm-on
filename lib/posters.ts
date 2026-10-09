import { promises as fs } from "fs";
import path from "path";

// Film posters (FilmCard's thumbnail). The image is Letterboxd's — the matched page's JSON-LD
// poster (lib/letterboxd.ts `parsePoster`) — but the site never hotlinks it: the weekly fetch
// downloads one small local copy into public/posters/, committed with the week's data, so the
// static export serves it itself and a CDN URL change can't silently break a card.
//
// Named after the Letterboxd slug, so a re-pinned link (a new slug) gets a fresh file and the
// same film in later weeks reuses the one already on disk. `fetch:confirm` prunes whatever the
// published week and the Next-week preview no longer reference.

const POSTERS_DIR = path.join(process.cwd(), "public", "posters");
// 2× the card's largest rendering (80×120 at `sm:` and up) — 2:3, Letterboxd's own poster ratio.
const WIDTH = 160;
const HEIGHT = 240;
const USER_AGENT = "flm-personal-cinema-app/1.0 (+personal showtime planner)";

// The site-relative path a screening carries in `poster` — no leading slash, so FilmCard can put
// the deploy's basePath in front of it.
export function posterPath(letterboxdUrl: string): string | undefined {
  const slug = letterboxdUrl.match(/letterboxd\.com\/film\/([^/]+)/)?.[1];
  return slug ? `posters/${slug}.webp` : undefined;
}

// Downloads `remoteUrl` once and returns the local site-relative path, or undefined if it
// couldn't be fetched (the card then just shows no poster — the batch report lists those).
export async function ensurePoster(
  letterboxdUrl: string,
  remoteUrl: string,
): Promise<string | undefined> {
  const rel = posterPath(letterboxdUrl);
  if (!rel) return undefined;
  const file = path.join(process.cwd(), "public", rel);
  try {
    await fs.access(file);
    return rel;
  } catch {
    // not downloaded yet
  }
  try {
    const res = await fetch(remoteUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return undefined;
    const sharp = (await import("sharp")).default;
    const image = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    await fs.mkdir(POSTERS_DIR, { recursive: true });
    await fs.writeFile(file, image);
    return rel;
  } catch {
    return undefined;
  }
}

// Deletes every poster no longer referenced — called by `fetch:confirm` with the paths in the
// just-published showtimes.json plus upcoming.json. Returns the names it removed.
export async function prunePosters(keep: Set<string>): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(POSTERS_DIR);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of names) {
    if (keep.has(`posters/${name}`)) continue;
    await fs.unlink(path.join(POSTERS_DIR, name));
    removed.push(name);
  }
  return removed;
}
