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

export function formatDayDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", timeZone: "UTC" }).format(dt);
}
