# The plan, and what comes out of it

Decisions #5, #20 and #21 in full — the week-spanning saved plan, the ten-minute grace that
governs what counts as still on, and the calendar export. CLAUDE.md keeps the rules; this is
the reasoning behind them.

Verbatim from CLAUDE.md, which now carries only the rules. **Read this before changing
anything it covers, and update it in the same commit** — the same discipline CLAUDE.md and
the `fetch-films` skill are under.

---

## Decision #5 — A plan can span the week; it persists

**A plan can span the week; it persists.** `lib/plan.ts` (`flm-on:plan` localStorage, same
`useSyncExternalStore` shape as `lib/preferences.ts`) holds the picked `bookingUrl`s across as
many days as you like, surviving reloads and return visits — the point of week-planning is
coming back to it. Stale keys are filtered on read (`effectiveSelectedKeys`) and pruned on the
next write. **The plan resolves against reality, the suggestions against your preferences.**
`dayPlanItems` / `effectiveSelectedKeys` read `timedAll` (everything still ahead of us, before
the preferences narrow it), so muting a cinema — or flipping the Highlights lens — leaves a
confirmed film confirmed; only the day passing, the session starting (plus the ten-minute
grace — decision #20) or the screening leaving `showtimes.json` prunes a pick. That matters twice over: without it `toggleSelected` writes the
pruned set back and the pick is gone for good. Ghosts and seeds are the other way round and
read `preferred` — what to *offer* you next is exactly what a viewing preference should steer. Tapping a showtime just adds it — the Day filter does **not** snap to it (that
jump is disorienting across days now). The Day filter still **defaults to today** for
*browsing*. **Suggestions are one mechanism, and they live inside the plan**: once you've
picked something, each open slot on a day the plan touches offers one dashed ghost row — the
tightest-fitting candidate for that gap (`planAdditions` → `bestAdditionPerSlot` → `DayPlan`).
Taking one is a plain `toggleSelected`, so it's the same gesture as tapping a pill. **A film
already in the plan is never *suggested*, on any day** — `bestAdditionPerSlot` filters it out.
The looser same-day-only rule inside `planAdditions` stays, because it's also what fades the
card pills, and choosing to see a film twice in a week is legitimate; volunteering one you've
already committed to is just handing a decision back to you. Nor is a film you've **taken back
out** this session (`dismissed`, a `Set` of film keys in `ScreeningBrowser`): re-offering what
you just removed makes the removal look broken — the solid row simply goes dashed. **`Clear`
goes further**: it dismisses everything it threw away *and* silences the empty-state seeds
outright (`planCleared`) — having binned a whole plan you don't want three fresh films pushed
at you in its place. Slot ghosts are untouched by that, so building a new plan gets them back.
Both are ephemeral like the Highlights lens — a reload is a fresh slate, since a persisted "never show me this" list with no UI to review or
undo it would be a trap. **Suggestions only**: the film's pills stay live, and this never feeds
the "wouldn't fit" fade (it filters `additions` on the way into `bestAdditionPerSlot`, not
`planAdditions`), so the next-best candidate takes the slot rather than the slot going empty.
An **empty** plan has no slots, so it seeds itself instead: `lib/startingPoints.ts` offers one
ghost per timeframe (Early/Mid/Late), **specials first** — if the app volunteers something
unprompted it should be the 70mm print, not whichever wide release sorted first. Scoped to the
pinned day (which defaults to today); on "This week" it draws from the whole week, prefers a
distinct day per pick and each ghost names its own day. No heading over them. Like every plan tool it reads the full
`preferred` set, so the Time and Cinema filters don't narrow it. The old
pinned-day "Suggested double bills" list (`findCombos` / `ComboSuggestions` / `suggestionScopeDay`)
is **gone** — it was a second, differently-shaped suggestion surface that only existed before
your first pick, and a cross-day "pair" was never a plan anyway. Consequence, accepted: an
**empty** plan now gets no suggestions at all, just "Tap a showtime to start a plan."
The plan surface: a sticky `<PlanPanel>` in the desktop right rail, a floating
`<PlanButton>` + bottom sheet on mobile. `lib/clash.ts` uses an **absolute-ordinal minute**
model (`toOrdinalMinutes` = `daysBetweenISO(EPOCH, date)*1440 + toMinutes(time)`), so every
gap calc is multi-day-correct and past-midnight end times no longer wrap. `itineraryTransitions`
marks a day boundary as `crossDay` (rendered as a header, not "Overlaps 840min").
`planAdditions` is **within-day only** and allows the same film on a *different* day — so a
week-spanning plan only ever gets ghosts (and pill fades) on days it already touches. Both ends
count as slots, so a plan gets a ghost *before* its first film and *after* its last whenever
something actually fits there.
`FilmCard`'s "wouldn't fit" pill fade only applies on days the plan already touches (`planDates`
prop) — an untouched day is a fresh start.

---

## Decision #20 — A screening lingers ten minutes past its start time

**A screening lingers ten minutes past its start time** (`GRACE_MINUTES` + `screeningCutoff`
in `lib/date.ts`). Every "is this still on?" test in `ScreeningBrowser` — the
`upcomingScreenings` filter, `visibleDays`, the initial `activeDay`, the `usableTimeframes`
retirement — compares against that cutoff rather than the wall clock, so it also governs
the plan (`timedAll` derives from it, so a pick isn't pruned the instant its film starts —
decision #5). Why: you can still walk into a film ten minutes late, and a session
disappearing out from under a plan you're halfway through is a worse failure than one you
can no longer quite make.
- `screeningCutoff` returns the same `{ date, time }` shape as `todayISO()`/`nowTimeISO()`,
  so it string-compares straight against a `Screening` with no parsing. It **crosses
  midnight rather than clamping** (at 00:05 it reads yesterday 23:55) so a late-night
  screening gets the same grace as any other — the accepted consequence being that
  yesterday can stay a visible day chip for those few minutes, which is honest: that
  screening really is still joinable. `cutoffMinsToday` (what retires a finished timeframe)
  is measured from the start of *today* and so goes negative there, retiring nothing.
- `now` is still fixed at mount (not re-evaluated per render), so in practice a film leaves
  on the next load after the grace expires — the grace is also what keeps that staleness
  from ever reading as a film blinking out mid-glance.

---

## Decision #21 — The plan exports to a calendar as one `.ics` file

**The plan exports to a calendar as one `.ics` file** (`lib/calendar.ts`, `planToICS`; the
button at the foot of `PlanPanel`, the browser half in `ScreeningBrowser.exportPlan`). The plan
is the app's one piece of durable user state and it only existed inside the app; this is the
way out. **One file for the whole plan**, not one per day or per screening: the plan is framed
as a single week-spanning thing (decision #5), and an `.ics` holds many VEVENTs, so it imports
as one ordinary calendar event per pick — in its own slot, on its own day, in whichever
calendar the OS picker chooses. It does **not** create an "FLM ON" calendar.
- **It's an export, not a sync, and that asymmetry is the thing to know.** Import can add and
  update but never delete, so a film you take back out of the plan stays in the calendar until
  you remove it there. What it *can* avoid is duplicating: each `UID` is a stable FNV-1a hash
  of the screening's `bookingUrl`, so exporting again after adding a film updates the events
  already there. The caveat is the button's tooltip (`EXPORT_CAVEAT` in `PlanPanel`) — it
  can't fit in a label, and leaving it unsaid would make the first surprising re-import read
  as a bug. It's the one tooltip in the app whose text is nowhere else in the UI, so the
  button's `aria-label` spells it out in full rather than stopping at "Add to calendar":
  a tooltip is a hover/focus surface, and on a phone that label is the only way to it. Keying the `UID`
  on the `bookingUrl` alone (not the time) is deliberate: a cinema moving a session should
  *update* the event, not leave a stale one beside a new one. Light House's scraped
  `bookingUrl`s carry a literal newline mid-query-string, so whitespace is stripped before
  hashing — otherwise the "stable" id rests on an accident of the scrape.
- **Times are `TZID=Europe/Dublin` with a static `VTIMEZONE`**, not floating. Nothing in this
  repo computes a UTC offset and this avoids having to: the EU DST rules are fixed, so two
  `RRULE`s are correct in any year. Floating times are shorter but silently wrong the moment
  the device leaves Irish time. `DTEND` is derived from `endMins`, never from `s.date` — those
  are absolute ordinal minutes (`lib/clash.ts`), so a late film genuinely ends on the next date.
- **The export reads `dayPlanItems`**, so it inherits decision #5: your plan resolved against
  reality, not the preference-filtered view. Muting a cinema never silently drops a confirmed
  film out of the file.
- **The event is what / where / when and nothing else** (user's call) — `SUMMARY`, `DTSTART`,
  `DTEND`, `LOCATION`. No `URL` and no `DESCRIPTION`: the film's own details (director, year,
  cert, runtime, format / language / strand notes) are what the app itself is for, and by the
  time an event is sitting in your calendar you've booked and you know what you're seeing. The
  accepted consequence is that an event built on the `DEFAULT_DURATION_MINS` fallback no longer
  says its end time is a guess — nothing in the file marks an estimated runtime.
  `LOCATION` is `CINEMA_ADDRESS` (`lib/cinemas.ts`),
  and **its exact shape is load-bearing**: a calendar geocodes LOCATION as a *place lookup*
  rather than printing it, and only draws a map when that resolves. It needs the venue's
  registered name on its own first line, then the canonical postal address ending in the
  country — "Cineworld Cinemas", not the app's "Cineworld Dublin"; "Irish Film Institute
  (IFI)"; "6 Eustace St", not spelled out; no invented "Temple Bar" line. Written the obvious
  longhand way it silently resolved to nothing and every event showed no map. The name/address
  break is a real newline in the constant, escaped to `\n` on the way out. Don't tidy them onto
  one line and don't substitute `CINEMA_LABEL` — that's the app's short name, not the map's.

  ⚠️ An earlier version of this entry also described a `DESCRIPTION` carrying director/year,
  cert + runtime and the `screeningTags` notes, with "(estimated)" on a fallback runtime. That
  was **reversed** — `lib/calendar.ts` emits `SUMMARY` / `DTSTART` / `DTEND` / `LOCATION` and
  nothing else — and the paragraph survived the reversal by accident until it was caught in
  September 2026.
- **Built in the browser**, because `output: "export"` plus a `basePath` that differs between
  local and CI rules out any route. Web Share (`navigator.canShare({ files })`) first — installed
  to the home screen (decision #10) that's the difference between iOS offering Calendar directly
  and a file landing in Downloads — falling through to a blob + `<a download>` on desktop.
- **The button is the plan panel's one primary control** — the app's accent-fill + 2px border +
  `shadow-chip` hard-press language, sized to hug its label and centred, sitting inside the
  panel's scrolling body after the last row (you reach it by reaching the end of the plan). The
  accent is legitimate here rather than a decoration: decision #7 reserves it for actionable
  things, and this is the plan's payoff action. Deliberately **not full-width** — a gold slab
  spanning the panel sits too close to reading as one more plan row — and `Clear` stays a bare
  underlined text button, so the surface has exactly one primary. `mt-6` clears both the last
  row and the shadow's offset.
- The generator is pure and lives in `lib/`, which is the only reason it has tests
  (`test/calendar.test.ts`); the component half stays thin. Line folding is UTF-8-octet-aware
  and never splits an escape pair.
