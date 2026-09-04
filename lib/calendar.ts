import type { TimedScreening } from "./clash";
import { minutesToTime } from "./clash";
import { CINEMA_ADDRESS } from "./cinemas";
import { addDaysISO } from "./date";

// The plan, as one iCalendar file: a VEVENT per picked screening, imported into whichever calendar
// the OS picker chooses. See CLAUDE.md decision #21.
//
// This is an export, not a sync — .ics import can add and update but never delete, so a film you
// take back out of the plan stays in the calendar until you remove it there. What it *can* do is
// avoid duplicating: each UID is a stable hash of the screening's bookingUrl, so exporting again
// after adding a film updates the events already there rather than piling up a second copy.
//
// Pure and DOM-free on purpose (the browser side lives in the component) — that's what makes it
// testable, which is the whole grain of this codebase.

const PRODID = "-//FLM ON//Dublin cinema plan//EN";

// Times are emitted as Europe/Dublin local with a TZID, which needs the zone defined in the file.
// Nothing in this repo computes a UTC offset and this avoids having to: the EU DST rules are
// fixed, so a static block with two RRULEs is correct in any year. The alternative — floating
// times with no zone at all — is shorter but silently wrong the moment the device leaves Irish
// time, which for a travel-shaped app is exactly the wrong failure.
const TZID = "Europe/Dublin";
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:STANDARD",
  "DTSTART:19701025T020000",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:GMT",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:19700329T010000",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:IST",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

// `now` is injected so DTSTAMP is deterministic under test; nothing else in here reads the clock.
export function planToICS(items: TimedScreening[], now: Date = new Date()): string {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
    ...items.flatMap((s) => vevent(s, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export const ICS_FILENAME = "flm-on-plan.ics";
export const ICS_MIME = "text/calendar";

// What, where, when — and nothing else. No DESCRIPTION and no URL (user's call): the film's own
// details are what the app is for, and by the time an event is sitting in your calendar you've
// already booked and already know what you're going to see.
function vevent(s: TimedScreening, stamp: string): string[] {
  // The end date can't be reused from `s.date`: startMins/endMins are absolute ordinal minutes
  // (lib/clash.ts), so a 23:30 film with a 2h runtime genuinely ends on the following date.
  const dayShift = Math.floor(s.endMins / 1440) - Math.floor(s.startMins / 1440);
  return [
    "BEGIN:VEVENT",
    `UID:${uidFor(s)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${TZID}:${localStamp(s.date, s.time)}`,
    `DTEND;TZID=${TZID}:${localStamp(addDaysISO(s.date, dayShift), minutesToTime(s.endMins))}`,
    `SUMMARY:${escapeText(s.filmTitle)}`,
    `LOCATION:${escapeText(CINEMA_ADDRESS[s.cinema] ?? s.cinemaName)}`,
    "END:VEVENT",
  ];
}

// A screening's identity is its bookingUrl (decision #6) — but Light House's, as scraped, carry a
// literal newline mid-query-string, so the raw value's exact bytes are an accident. Strip
// whitespace before hashing or the "stable UID" promise rests on that accident.
function uidFor(s: TimedScreening): string {
  return `${fnv1a(s.bookingUrl.replace(/\s+/g, ""))}@flm.on`;
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function localStamp(dateISO: string, time: string): string {
  return `${dateISO.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 caps a content line at 75 octets, continuing with CRLF + a single space. Measured in
// UTF-8 bytes, not characters — film titles here carry accents and non-Latin scripts routinely, so
// a naive length check would emit over-long lines for exactly the titles most worth getting right.
//
// Breaks never land inside an escape pair. Unfolding is a purely textual step that happens before
// parsing, so a `\` and its comma landing on separate lines is legal and round-trips — but it's a
// well-known way to trip a parser that unfolds and parses in one pass, and keeping the pair
// together costs nothing.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const unit of splitUnits(line)) {
    const size = encoder.encode(unit).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // the continuation line's leading space costs one of the 75
    }
    current += unit;
    bytes += size;
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
}

// Code points, except that a backslash takes the character it escapes with it. (Iterating a string
// with for..of already keeps surrogate pairs whole.)
function splitUnits(line: string): string[] {
  const chars = [...line];
  const units: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "\\" && i + 1 < chars.length) units.push(chars[i] + chars[++i]);
    else units.push(chars[i]);
  }
  return units;
}
