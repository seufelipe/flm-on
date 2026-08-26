export type Timeframe = "early" | "mid" | "late";

export interface TimeframeDef {
  id: Timeframe;
  label: string;
  startMins: number;
  endMins: number;
}

export const TIMEFRAMES: TimeframeDef[] = [
  { id: "early", label: "Early", startMins: 8 * 60, endMins: 13 * 60 },
  { id: "mid", label: "Mid", startMins: 13 * 60, endMins: 16 * 60 },
  { id: "late", label: "Late", startMins: 16 * 60, endMins: 23 * 60 },
];

export function timeframeForTime(time: string): Timeframe {
  const [h, m] = time.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins < TIMEFRAMES[0].startMins) return TIMEFRAMES[0].id;
  const last = TIMEFRAMES[TIMEFRAMES.length - 1];
  if (mins >= last.endMins) return last.id;
  const match = TIMEFRAMES.find((t) => mins >= t.startMins && mins < t.endMins);
  return match?.id ?? last.id;
}

function formatClockMins(mins: number): string {
  const hours = Math.floor(mins / 60) % 24;
  const minutes = mins % 60;
  const period = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}${period}`;
}

export function formatTimeframeRange(tf: TimeframeDef): string {
  return `${formatClockMins(tf.startMins)}–${formatClockMins(tf.endMins)}`;
}

// Buckets a film's screenings under Early/Mid/Late, same buckets as the timeframe filter, so a
// film card's showtimes read as labelled clusters instead of one flat chronological row — empty
// buckets (a day with nothing early, say) are dropped rather than shown as a label with no pills.
export function groupScreeningsByTimeframe<T extends { time: string }>(
  screenings: T[],
): { timeframe: TimeframeDef; screenings: T[] }[] {
  return TIMEFRAMES.map((timeframe) => ({
    timeframe,
    screenings: screenings.filter((s) => timeframeForTime(s.time) === timeframe.id),
  })).filter((group) => group.screenings.length > 0);
}
