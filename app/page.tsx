import { promises as fs } from "fs";
import path from "path";
import type { Screening } from "@/lib/scrapers/types";
import ScreeningBrowser from "@/components/ScreeningBrowser";

const DATA_FILE = path.join(process.cwd(), "data", "showtimes.json");

interface ShowtimesData {
  generatedAt: string;
  days: string[];
  screenings: Screening[];
}

async function loadShowtimes(): Promise<ShowtimesData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ShowtimesData;
  } catch {
    return { generatedAt: "", days: [], screenings: [] };
  }
}

export default async function Home() {
  const { generatedAt, days, screenings } = await loadShowtimes();

  return (
    <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
      <header className="mb-8 border-b-4 border-border pb-4">
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">FLM ON</h1>
        <p className="font-bold text-dim uppercase text-sm tracking-widest">
          See what&rsquo;s on, make a plan. Updated every Thursday morning
        </p>
      </header>

      <ScreeningBrowser screenings={screenings} days={days} />

      <div className="no-print flex items-center justify-between mt-16 pt-4 border-t-2 border-border gap-4">
        <p className="text-xs text-dim">
          {generatedAt ? `Data as of ${new Date(generatedAt).toLocaleDateString("en-IE")}` : "No data yet"}
        </p>
      </div>
    </main>
  );
}
