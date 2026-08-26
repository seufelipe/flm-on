import { promises as fs } from "fs";
import path from "path";

const STAGING_FILE = path.join(process.cwd(), "data", "staging-batch.json");
const FINAL_FILE = path.join(process.cwd(), "data", "showtimes.json");

async function main() {
  let raw: string;
  try {
    raw = await fs.readFile(STAGING_FILE, "utf-8");
  } catch {
    console.error(`No staging batch found at ${STAGING_FILE} — run \`npm run fetch:batch\` first.`);
    process.exit(1);
    return;
  }

  JSON.parse(raw); // fail loudly on malformed staging data before touching the published file
  await fs.writeFile(FINAL_FILE, raw, "utf-8");
  console.log(`Wrote ${FINAL_FILE}`);
  console.log("Review the diff and commit/push it yourself when ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
