import { Fragment, type ReactNode } from "react";
import { type ItineraryTransition, type PlanAddition, type TimedScreening } from "@/lib/clash";
import { PlanRow, GhostRow } from "@/components/PlanRow";
import { formatDayFriendly, formatDayDate } from "@/lib/date";

interface Props {
  // Chronologically sorted (date then time — the ordinal model in lib/clash.ts), may span days.
  items: TimedScreening[];
  // itineraryTransitions(items) — transitions[i] is the step from items[i] to items[i+1].
  transitions: ItineraryTransition[];
  // At most one "choose this next" suggestion per open slot (bestAdditionPerSlot). Each is drawn
  // as a dashed ghost row at the position it would take.
  suggestions: PlanAddition[];
  onRemove: (s: TimedScreening) => void;
  onAdd: (s: TimedScreening) => void;
  // Clicking a day header filters the film list to that day.
  onPickDay: (date: string) => void;
  keyOf: (s: TimedScreening) => string;
}

function transitionLabel(t: ItineraryTransition): string {
  if (t.overlap) return `Overlaps ${Math.abs(t.gapMins)}min`;
  if (t.tooTight) return `Only ${t.gapMins}min`;
  return `${t.gapMins}min`;
}

// Rough door-to-door span of a single day in the plan: that day's first start to its last end.
// Rounded to 5 min and shown with a ~ prefix.
function formatSpan(mins: number): string {
  const rounded = Math.round(mins / 5) * 5;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// The step between two rows. Warned (accent) only for a real transition that overlaps or is too
// tight — a suggestion's gaps are fits by construction.
function GapLabel({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 pl-1 text-xs font-bold uppercase tracking-wide ${
        warn ? "text-accent-ink" : "text-dim"
      }`}
    >
      <span aria-hidden="true">&darr;</span>
      {children}
    </div>
  );
}

// The plan, grouped into a section per day. A plan can span the whole week (CLAUDE.md decision
// #5); each day gets its own header + span, and the step between two days is drawn as the next
// day's header, not a gap ("Overlaps 840min" would be nonsense). Within a day the transitions
// between consecutive screenings show as before, flagged when they overlap / are too tight.
//
// Each open slot may also carry one dashed ghost row — a suggested next pick, sitting where it
// would actually go. A ghost *replaces* the real transition label of its slot: instead of the one
// gap you have now, you see the two gaps you'd have if you took it.
export default function DayPlan({ items, transitions, suggestions, onRemove, onAdd, onPickDay, keyOf }: Props) {
  const groups: { date: string; rows: { s: TimedScreening; transition: ItineraryTransition | null }[] }[] = [];
  items.forEach((s, idx) => {
    const transition = idx > 0 ? transitions[idx - 1] : null;
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.rows.push({ s, transition });
    else groups.push({ date: s.date, rows: [{ s, transition }] });
  });

  // Slot key mirrors bestAdditionPerSlot: the plan item a suggestion would follow, or "start" for
  // one that would go before the day's first film.
  const bySlot = new Map(suggestions.map((a) => [`${a.screening.date}:${a.afterKey ?? "start"}`, a]));
  const ghostAfter = (s: TimedScreening) => bySlot.get(`${s.date}:${keyOf(s)}`);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const spanMins =
          Math.max(...group.rows.map((r) => r.s.endMins)) -
          Math.min(...group.rows.map((r) => r.s.startMins));
        const leadGhost = bySlot.get(`${group.date}:start`);
        return (
          <div key={group.date} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => onPickDay(group.date)}
                className="font-black uppercase text-sm tracking-tight cursor-pointer text-left"
              >
                {formatDayFriendly(group.date)}
                <span className="ml-1.5 font-bold text-dim">{formatDayDate(group.date)}</span>
              </button>
              <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-dim">
                {group.rows.length} {group.rows.length === 1 ? "film" : "films"} · ~{formatSpan(spanMins)}
              </span>
            </div>
            {leadGhost && (
              <>
                <GhostRow s={leadGhost.screening} onAdd={onAdd} />
                <GapLabel>{leadGhost.gapAfter}min</GapLabel>
              </>
            )}
            {group.rows.map(({ s, transition }, i) => {
              // A ghost sitting between the previous row and this one owns that step: its
              // `gapAfter` is the label leading into this row, in place of the real transition.
              const previousGhost = i > 0 ? ghostAfter(group.rows[i - 1].s) : undefined;
              const ghost = ghostAfter(s);
              return (
                <Fragment key={keyOf(s)}>
                  {i > 0 &&
                    (previousGhost ? (
                      <GapLabel>{previousGhost.gapAfter}min</GapLabel>
                    ) : (
                      transition &&
                      !transition.crossDay && (
                        <GapLabel warn={transition.overlap || transition.tooTight}>
                          {transitionLabel(transition)}
                        </GapLabel>
                      )
                    ))}
                  <PlanRow s={s} onRemove={onRemove} />
                  {ghost && (
                    <>
                      <GapLabel>{ghost.gapBefore}min</GapLabel>
                      <GhostRow s={ghost.screening} onAdd={onAdd} />
                    </>
                  )}
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
