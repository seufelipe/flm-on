import { promises as fs } from "fs";
import path from "path";
import type { Screening } from "@/lib/scrapers/types";
import type { UpcomingFilm } from "@/lib/upcoming";
import ScreeningBrowser from "@/components/ScreeningBrowser";

const DATA_FILE = path.join(process.cwd(), "data", "showtimes.json");
const LABELS_FILE = path.join(process.cwd(), "data", "film-labels.json");
const UPCOMING_FILE = path.join(process.cwd(), "data", "upcoming.json");

interface ShowtimesData {
  generatedAt: string;
  days: string[];
  screenings: Screening[];
}

interface UpcomingData {
  week: { from: string; to: string } | null;
  films: UpcomingFilm[];
}

async function loadShowtimes(): Promise<ShowtimesData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ShowtimesData;
  } catch {
    return { generatedAt: "", days: [], screenings: [] };
  }
}

// Curated editorial tags, keyed by normalized film title. Read at build time (static export);
// editing data/film-labels.json + rebuilding is enough — no re-scrape. See CLAUDE.md #11.
async function loadFilmLabels(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(LABELS_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

// The still-unconfirmed "Next week" preview (CLAUDE.md decision #18). Written in place by
// fetch:batch, read straight at build time — same as the labels file above.
async function loadUpcoming(): Promise<UpcomingData> {
  try {
    const raw = await fs.readFile(UPCOMING_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UpcomingData>;
    return { week: parsed.week ?? null, films: parsed.films ?? [] };
  } catch {
    return { week: null, films: [] };
  }
}

export default async function Home() {
  const { generatedAt, days, screenings } = await loadShowtimes();
  const labels = await loadFilmLabels();
  const upcoming = await loadUpcoming();

  return (
    <main className="max-w-4xl lg:max-w-6xl mx-auto w-full px-4 py-8 flex-1">
      <ScreeningBrowser
        screenings={screenings}
        days={days}
        labels={labels}
        upcoming={upcoming.films}
        upcomingWeek={upcoming.week}
      />

      <div className="no-print flex items-center justify-between mt-16 pt-4 border-t-2 border-border gap-4">
        <p className="text-xs text-dim">
          {generatedAt ? `Data as of ${new Date(generatedAt).toLocaleDateString("en-IE")}` : "No data yet"}
        </p>
      </div>
    </main>
  );
}
