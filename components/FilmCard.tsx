import { Fragment } from "react";
import FilmNotes from "@/components/FilmNotes";
import MysteryTitle from "@/components/MysteryTitle";
import { isMysteryFilm } from "@/lib/mystery";
import type { TimedScreening } from "@/lib/clash";
import { groupScreeningsByDay, type FilmGroup } from "@/lib/groupings";
import { groupScreeningsByTimeframe } from "@/lib/timeframe";
import { ScreeningTagMarks } from "@/components/ScreeningTags";
import { FilmFormatTag, FilmFormatMarks } from "@/components/FilmFormats";
import { LanguageTag, LanguageMarks } from "@/components/ScreeningLanguage";
import { screeningTagsTooltip } from "@/lib/screeningTags";
import { displayFilmFormats, filmFormatsTooltip } from "@/lib/formats";
import { displayLanguage, languageTooltip } from "@/lib/languages";
import { CINEMA_LABEL } from "@/lib/cinemas";
import { certColor } from "@/lib/certs";
import { formatDayFriendly, formatDayDate } from "@/lib/date";

interface Props {
  group: FilmGroup;
  selectedKeys: Set<string>;
  partnersOf: Set<string>;
  keyOf: (s: TimedScreening) => string;
  onSelect: (s: TimedScreening) => void;
  showCinema: boolean;
  daySpecified: boolean;
  label?: string;
  // One `{ label, url }` per cinema this film plays at — fixed to the film's full set of
  // screenings (respecting only the persisted preferences), NOT the Day/Cinema/Time filter bar,
  // so a film at both cinemas keeps both links even while browsing one. The session pills below
  // still follow the filter bar. Falls back to deriving from the visible screenings.
  cinemaLinks?: { label: string; url: string }[];
}

// Age cert styled after the official IFCO classification symbol — a colour-coded circle with a
// white label and a hard dark edge, thick dark border. Fixed circle size; the label shrinks for
// the 3-character certs ("12A", "15A") so the disc stays round. Unknown certs (no colour) fall
// back to a neutral fill. See lib/certs.ts for the palette.
function Cert({ cert }: { cert: string }) {
  const color = certColor(cert);
  return (
    <span
      className={`cert-badge inline-flex h-7 w-7 shrink-0 cursor-default items-center justify-center rounded-full border-2 border-border font-black uppercase leading-none text-white ${
        cert.length > 2 ? "text-[0.52rem] tracking-tight" : "text-xs"
      }`}
      style={{ background: color ?? "var(--color-dim)" }}
    >
      {cert}
    </span>
  );
}

// The Letterboxd mark — three overlapping brand-colour dots (orange / green / blue), standing in
// for the old "Letterboxd ↗" text link. The one deliberate exception to the ink + single-gold
// palette (decision #7): it's a third party's logo, so it wears their colours.
function LetterboxdLogo() {
  return (
    <svg viewBox="0 0 40 16" aria-hidden="true" className="h-3.5 w-auto shrink-0">
      <circle cx="8" cy="8" r="8" fill="#FF8000" />
      <circle cx="20" cy="8" r="8" fill="#00E054" />
      <circle cx="32" cy="8" r="8" fill="#40BCF4" />
    </svg>
  );
}

export default function FilmCard({
  group,
  selectedKeys,
  partnersOf,
  keyOf,
  onSelect,
  showCinema,
  daySpecified,
  label,
  cinemaLinks,
}: Props) {
  // Day sub-headers are redundant only when a specific Day chip is active — then every visible
  // screening is that day and the chip already says so. With "Any Day" in view, always show them,
  // even for a film with a single session, so you can tell when it's actually on.
  const dayGroups = groupScreeningsByDay(group.screenings);
  const showDayHeaders = !daySpecified || dayGroups.length > 1;

  // Prefer the caller's fixed set (every cinema the film plays at); otherwise derive from the
  // visible screenings — one link per cinema, in the order they first appear.
  const cinemaPageLinks =
    cinemaLinks ??
    Array.from(
      group.screenings
        .reduce((acc, s) => {
          if (s.filmPageUrl && !acc.has(s.cinema)) {
            acc.set(s.cinema, { label: CINEMA_LABEL[s.cinema] ?? s.cinemaName, url: s.filmPageUrl });
          }
          return acc;
        }, new Map<string, { label: string; url: string }>())
        .values(),
    );

  function handleKeyDown(e: React.KeyboardEvent, s: TimedScreening) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(s);
    }
  }

  function renderPill(s: TimedScreening) {
    const k = keyOf(s);
    const isSelected = selectedKeys.has(k);
    const isPartner = partnersOf.has(k);
    // Once a plan is underway, pills that wouldn't fit (not selected, not a valid next pick) fade
    // out — a film can have screenings all over the day and only some of them are still viable.
    const dimPill = selectedKeys.size > 0 && !isSelected && !isPartner;
    return (
      <div
        key={k}
        role="button"
        tabIndex={0}
        title={
          [
            screeningTagsTooltip(s.screeningTags),
            filmFormatsTooltip(s.screeningTags),
            languageTooltip(s.screeningTags),
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        onClick={() => onSelect(s)}
        onKeyDown={(e) => handleKeyDown(e, s)}
        className={`shrink-0 border-2 border-border rounded-btn px-3 py-2 flex items-center gap-2 font-bold transition-[translate,box-shadow] duration-100 ${
          isSelected
            ? "cursor-pointer bg-accent text-fg translate-x-[6px] translate-y-[6px]"
            : dimPill
              ? "cursor-default bg-surface text-fg pill-crossed-out translate-x-[6px] translate-y-[6px]"
              : "cursor-pointer bg-surface text-fg shadow-chip hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-chip-half active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
        } ${dimPill ? "opacity-40" : ""}`}
      >
        {showCinema && (
          <span className="text-xs font-bold uppercase tracking-widest">{CINEMA_LABEL[s.cinema] ?? s.cinemaName}</span>
        )}
        <span className="font-bold">{s.time}</span>
        <ScreeningTagMarks tags={s.screeningTags} />
        <FilmFormatMarks tags={s.screeningTags} />
        <LanguageMarks tags={s.screeningTags} />
      </div>
    );
  }

  function renderScreeningsRow(screenings: TimedScreening[]) {
    const timeframeGroups = groupScreeningsByTimeframe(screenings);
    // One non-wrapping row that scrolls sideways on overflow rather than stacking the pills onto
    // several lines (keeps each film card short on mobile). `-mx-8 px-8` cancels the card's `p-8`
    // so the strip is full-bleed — pills sit flush with the rest of the content at rest but scroll
    // right up to the card's inner edge, instead of stopping short inside a band of padding. The
    // vertical `pb-2.5 -mb-2.5` (added by `overflow-x-auto` also clipping the y-axis) keeps the
    // pills' chunky down-right shadow inside the scroll box without adding visual gap. `relative`
    // is load-bearing: the pills' `.sr-only` spans are `position:absolute`, so without a
    // positioned ancestor here their containing block would be the viewport and they'd escape
    // this row's clip — sitting out at their un-scrolled x-offset and giving the whole page a
    // phantom horizontal scroll.
    return (
      <div className="relative flex flex-nowrap items-center gap-4 overflow-x-auto scrollbar-none -mx-8 px-8 pb-2.5 -mb-2.5">
        {timeframeGroups.map((tg) => (
          <Fragment key={tg.timeframe.id}>
            <span className="shrink-0 text-xs font-bold uppercase text-dim tracking-widest">{tg.timeframe.label}</span>
            {tg.screenings.map(renderPill)}
          </Fragment>
        ))}
      </div>
    );
  }

  // The Mystery Matinee strand keeps the film secret until you're in the room — showing its year
  // or runtime would narrow the guess, so both are suppressed and the title is redacted.
  const isMystery = isMysteryFilm(group.filmTitle);

  // Descriptors across all of this film's visible sessions. The special-screening name(s) and
  // the curated editorial label are named together in one `<FilmNotes>` sticker after the title;
  // the individual pills carry only the bare ☻ mark.
  const sessionTags = Array.from(new Set(group.screenings.flatMap((s) => s.screeningTags ?? [])));
  const sessionFormats = displayFilmFormats(sessionTags);
  // Only the language name goes on the card (per-film); the subtitled/dubbed state is per-showtime
  // and lives on the pills, so it doesn't count towards showing the meta line.
  const sessionLanguage = displayLanguage(sessionTags)?.language;

  const hasMetaLine =
    group.cert !== undefined ||
    (group.durationMins !== undefined && !isMystery) ||
    group.letterboxdUrl !== undefined ||
    sessionFormats.length > 0 ||
    sessionLanguage !== undefined;

  return (
    <div className="bg-surface border-4 border-border rounded-card p-8">
      <div className="mb-16">
        {/* On narrow screens there isn't room for the title and the cinema chips on one line, so
            the chips stack above the title (order-1); from `md` up they sit top-right. */}
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
          <h3 className="order-2 md:order-1 text-2xl md:text-3xl tracking-tight">
            {isMystery ? (
              <MysteryTitle text={group.filmTitle} />
            ) : (
              // The only plain text that keeps the I-beam cursor — the film name is the thing
              // you actually want to select and copy. The year next to it stays on the arrow
              // cursor (globals.css default) so a drag-select grabs just the name.
              <span className="font-black uppercase cursor-text">{group.filmTitle}</span>
            )}
            {!isMystery && group.year !== undefined && (
              <span className="font-normal text-dim ml-3">{group.year}</span>
            )}
            <FilmNotes tags={sessionTags} label={label} />
          </h3>
          {cinemaPageLinks.length > 0 && (
            <div className="order-1 md:order-2 no-print flex flex-wrap gap-2 shrink-0 md:justify-end">
              {cinemaPageLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="border-2 border-dim rounded-btn bg-surface text-dim px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-transform active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {link.label} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
        {hasMetaLine && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {group.cert && <Cert cert={group.cert} />}
            {group.durationMins !== undefined && !isMystery && (
              <span className="text-xs text-dim">
                {group.durationMins}min{group.durationEstimated ? " (est.)" : ""}
              </span>
            )}
            <LanguageTag tags={sessionTags} />
            <FilmFormatTag tags={sessionTags} />
            {group.letterboxdUrl && (
              <a
                href={group.letterboxdUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="View on Letterboxd"
                title="Letterboxd"
                className="no-print inline-flex items-center transition-opacity hover:opacity-70"
              >
                <LetterboxdLogo />
              </a>
            )}
          </div>
        )}
      </div>
      {showDayHeaders ? (
        <div className="flex flex-col gap-6">
          {dayGroups.map((dg) => (
            <div key={dg.date}>
              <p className="text-xs font-bold uppercase text-dim tracking-widest mb-3">
                {formatDayFriendly(dg.date)}, {formatDayDate(dg.date)}
              </p>
              {renderScreeningsRow(dg.screenings)}
            </div>
          ))}
        </div>
      ) : (
        renderScreeningsRow(group.screenings)
      )}
    </div>
  );
}
