import { Fragment } from "react";
import type { TimedScreening } from "@/lib/clash";
import { groupScreeningsByDay, type FilmGroup } from "@/lib/groupings";
import { groupScreeningsByTimeframe } from "@/lib/timeframe";
import { CINEMA_LABEL } from "@/lib/cinemas";
import { formatDayFriendly, formatDayDate } from "@/lib/date";

interface Props {
  group: FilmGroup;
  selectedKeys: Set<string>;
  partnersOf: Set<string>;
  gapForPartner: Map<string, number>;
  keyOf: (s: TimedScreening) => string;
  onSelect: (s: TimedScreening) => void;
  showCinema: boolean;
}

export default function FilmCard({
  group,
  selectedKeys,
  partnersOf,
  gapForPartner,
  keyOf,
  onSelect,
  showCinema,
}: Props) {
  // Only worth a day sub-header when the film's currently-visible screenings actually span more
  // than one day — with a single day in view (e.g. one Day filter chip active) it would just
  // repeat what the filter chip already says.
  const dayGroups = groupScreeningsByDay(group.screenings);
  const showDayHeaders = dayGroups.length > 1;

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
    const gapMins = gapForPartner.get(k);
    // Once a plan is underway, pills that wouldn't fit (not selected, not a valid next pick) fade
    // out — a film can have screenings all over the day and only some of them are still viable.
    const dimPill = selectedKeys.size > 0 && !isSelected && !isPartner;
    return (
      <div
        key={k}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(s)}
        onKeyDown={(e) => handleKeyDown(e, s)}
        className={`border-4 border-border rounded-btn px-3 py-2 flex items-center gap-2 font-bold transition-transform ${
          isSelected
            ? "cursor-pointer bg-accent text-fg translate-x-[3px] translate-y-[3px]"
            : dimPill
              ? "cursor-not-allowed bg-surface text-fg pill-crossed-out translate-x-[3px] translate-y-[3px]"
              : "cursor-pointer bg-surface text-fg shadow-btn-secondary active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        } ${dimPill ? "opacity-40" : ""}`}
      >
        {showCinema && (
          <span className="text-xs font-bold uppercase tracking-widest">{CINEMA_LABEL[s.cinema] ?? s.cinemaName}</span>
        )}
        <span className="font-bold">{s.time}</span>
        {isPartner && gapMins !== undefined && <span className="text-xs font-bold text-accent-ink">+{gapMins}min</span>}
      </div>
    );
  }

  function renderScreeningsRow(screenings: TimedScreening[]) {
    const timeframeGroups = groupScreeningsByTimeframe(screenings);
    return (
      <div className="flex flex-wrap items-center gap-4">
        {timeframeGroups.map((tg) => (
          <Fragment key={tg.timeframe.id}>
            <span className="text-xs font-bold uppercase text-dim tracking-widest">{tg.timeframe.label}</span>
            {tg.screenings.map(renderPill)}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-surface border-4 border-border rounded-card p-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
        <span className="text-2xl md:text-3xl font-black uppercase tracking-tight">{group.filmTitle}</span>
        {group.year && <span className="text-sm text-dim">({group.year})</span>}
        {group.cert && <span className="text-xs border border-current px-1">{group.cert}</span>}
        {group.durationMins !== undefined && (
          <span className="text-xs text-dim">
            {group.durationMins}min{group.durationEstimated ? " (est.)" : ""}
          </span>
        )}
        {group.letterboxdUrl && (
          <a
            href={group.letterboxdUrl}
            target="_blank"
            rel="noreferrer"
            className="no-print underline underline-offset-2 text-sm"
          >
            Letterboxd
          </a>
        )}
      </div>
      {showDayHeaders ? (
        <div className="flex flex-col gap-6">
          {dayGroups.map((dg) => (
            <div key={dg.date}>
              <p className="text-xs font-bold uppercase text-dim tracking-widest mb-3">
                {formatDayFriendly(dg.date)} · {formatDayDate(dg.date)}
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
