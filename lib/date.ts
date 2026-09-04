const TIMEZONE = "Europe/Dublin";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// "HH:MM" 24h, zero-padded to match Screening.time — so it can be string-compared directly
// against a showtime without parsing either side into minutes.
export function nowTimeISO(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// How long a screening stays listed after it has started. You can still walk into a film ten
// minutes late (that's the trailers), and a session evaporating out from under a plan the moment
// its clock ticks over is a worse failure than one you can no longer quite make.
export const GRACE_MINUTES = 10;

// The "is this still on?" cutoff: the wall clock less the grace, in the same { date, time } shape
// as todayISO()/nowTimeISO() so it string-compares straight against a Screening. It crosses
// midnight rather than clamping (at 00:05 it reads yesterday 23:55), so a late-night screening
// gets the same grace as any other — which does mean yesterday can stay a visible day for those
// few minutes, correctly: that screening really is still joinable.
export function screeningCutoff(
  dateISO: string = todayISO(),
  timeISO: string = nowTimeISO(),
): { date: string; time: string } {
  const [h, m] = timeISO.split(":").map(Number);
  const mins = h * 60 + m - GRACE_MINUTES;
  if (mins >= 0) return { date: dateISO, time: formatMinutes(mins) };
  return { date: addDaysISO(dateISO, -1), time: formatMinutes(mins + 1440) };
}

function formatMinutes(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function daysBetweenISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

// 0=Sun..6=Sat, Thu=4. Returns 0 on Thursday itself.
export function daysUntilThursday(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (4 - dow + 7) % 7;
}

// Label for the day picker's trailing "come back" note — "Tomorrow" only when Thursday is
// literally the next day, "Thursday" otherwise (including today being Thursday itself, where
// the next batch is a week out, not tomorrow).
export function nextBatchLabel(fromISO: string = todayISO()): "Tomorrow" | "Thursday" {
  return daysUntilThursday(fromISO) === 1 ? "Tomorrow" : "Thursday";
}

// The days belonging to the current cinema-programme batch: from `from` up to *but excluding*
// the next Thursday (that Thursday starts the next batch) — except when `from` itself is a
// Thursday, which means a whole new batch is starting, so this returns the full week ahead.
export function upcomingDays(from: string = todayISO()): string[] {
  const count = daysUntilThursday(from);
  const length = count === 0 ? 7 : count;
  return Array.from({ length }, (_, i) => addDaysISO(from, i));
}

// The cinema-programme batch *after* the current one — next Thursday through the following
// Wednesday, seven days. This is the still-unconfirmed window the "Next week" tease previews
// (CLAUDE.md decision #18); it always starts on a Thursday (when the programmes turn over),
// whatever weekday it's computed on.
export function nextWeekDays(from: string = todayISO()): string[] {
  const current = upcomingDays(from);
  const start = addDaysISO(current[current.length - 1], 1);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}

// Compares against the real current date rather than a position within some array — a `days`
// array sourced from stale data (e.g. last week's committed showtimes.json, viewed a day or two
// after it was generated) must not mislabel its first entry "Today" just because it's at index 0.
export function formatDayFriendly(dateISO: string): string {
  const diff = daysBetweenISO(todayISO(), dateISO);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-IE", { weekday: "long", timeZone: "UTC" }).format(dt);
}

// Hand-rolled rather than Intl `month: "short"` — Node's CLDR abbreviates September as "Sept"
// while browsers still say "Sep", which hydration-mismatches this string on the day picker.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDayDate(dateISO: string): string {
  const [, m, d] = dateISO.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}
