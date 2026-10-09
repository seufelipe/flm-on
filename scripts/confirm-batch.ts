import { promises as fs } from "fs";
import path from "path";
import { prunePosters } from "@/lib/posters";

const STAGING_FILE = path.join(process.cwd(), "data", "staging-batch.json");
const FINAL_FILE = path.join(process.cwd(), "data", "showtimes.json");
const UPCOMING_FILE = path.join(process.cwd(), "data", "upcoming.json");

async function main() {
  let raw: string;
  try {
    raw = await fs.readFile(STAGING_FILE, "utf-8");
  } catch {
    console.error(`No staging batch found at ${STAGING_FILE} — run \`npm run fetch:batch\` first.`);
    process.exit(1);
    return;
  }

  // fail loudly on malformed staging data before touching the published file
  const staged = JSON.parse(raw) as { screenings: { poster?: string }[] };
  await fs.writeFile(FINAL_FILE, raw, "utf-8");
  console.log(`Wrote ${FINAL_FILE}`);

  // Keep only the posters something still shows — this week's cards and the (trimmed) Next-week
  // preview. lib/posters.ts; they're committed, so a stale one would ship forever otherwise.
  let upcoming: { films: { poster?: string }[] } = { films: [] };
  try {
    upcoming = JSON.parse(await fs.readFile(UPCOMING_FILE, "utf-8"));
  } catch {
    // no preview yet
  }
  const keep = new Set(
    [...staged.screenings, ...upcoming.films].flatMap((x) => (x.poster ? [x.poster] : [])),
  );
  const removed = await prunePosters(keep);
  if (removed.length) console.log(`Pruned ${removed.length} unused poster(s) from public/posters/`);
  console.log("Review the diff and commit/push it yourself when ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
