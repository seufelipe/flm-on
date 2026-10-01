---
paths:
  - "lib/plan.ts"
  - "lib/clash.ts"
  - "lib/startingPoints.ts"
  - "lib/calendar.ts"
  - "lib/date.ts"
  - "lib/cinemas.ts"
  - "components/PlanPanel.tsx"
  - "components/PlanRow.tsx"
  - "components/DayPlan.tsx"
  - "components/PlanButton.tsx"
  - "components/ScreeningBrowser.tsx"
---

# The plan, its suggestions, the grace period and the calendar export

Split out of the root `CLAUDE.md` so it loads only with the code it covers. Same discipline: the rule lives here, the reasoning in the named `docs/decisions/` file — update both in the same commit.

## Map

- `lib/clash.ts` — **absolute-ordinal minutes** (`toOrdinalMinutes`), so gap maths is a plain
  subtraction across days (#5). `itineraryTransitions` (gap / overlap / too-tight / `crossDay`,
  no max cap) and the one suggestion engine `planAdditions`, read two ways: `fittingAdditions`
  (`bookingUrl → tightness`, for the card pills) and `bestAdditionPerSlot` (one tightest fit per
  open slot, for the plan's ghost rows).
- `lib/startingPoints.ts` — what an **empty** plan offers: one screening per timeframe, specials
  first, each film only once (#5).
- `lib/calendar.ts` — `planToICS`, pure and DOM-free; the browser half is
  `ScreeningBrowser.exportPlan` (#21).

## Plan-row gotchas

- `PlanRow` / `GhostRow` carry no affordance glyph (#7) and **no tooltip** — `screeningTooltip`
  goes on the `aria-label` only (a tooltip per row flickered, and the mobile sheet can't open one).
  Don't add one back without asking.
- A ghost row **replaces the real transition label of its slot**: you see the two gaps you'd have,
  not the one you have.

## Decisions

5. **A plan can span the week; it persists** (`lib/plan.ts`, `flm-on:plan` localStorage;
   `lib/clash.ts`; `lib/startingPoints.ts`). Any number of screenings across any number of days,
   surviving reloads — coming back to it is the point of week-planning.
   Reasoning: `docs/decisions/plan.md`.
   - **The plan resolves against reality, the suggestions against your preferences.**
     `dayPlanItems` / `effectiveSelectedKeys` read `timedAll`, **not** `preferred`, so muting a
     cinema or flipping the Highlights lens never prunes a confirmed pick; only the day passing,
     the session starting (plus the grace, #20) or the screening leaving `showtimes.json` does.
     Get this wrong and `toggleSelected` writes the pruned set back — the pick is gone for good.
   - **Times are absolute-ordinal minutes** (`toOrdinalMinutes`), so every gap calc is
     multi-day-correct and a past-midnight end doesn't wrap. A day boundary is `crossDay`,
     rendered as the next day's header, never as a gap.
   - **Suggestions are one mechanism and they live inside the plan** — one dashed ghost per open
     slot (`planAdditions` → `bestAdditionPerSlot`), taken with the same gesture as tapping a
     pill. **Never suggest a film already in the plan on *any* day**, nor one taken back out this
     session (`dismissed`); `Clear` also silences the empty-plan seeds (`planCleared`). Both are
     ephemeral — a persisted "never show me this" with no UI to review or undo it is a trap.
   - **An empty plan has no slots, so it seeds instead** (`startingPoints`): one ghost per
     timeframe, specials first, no heading over them. On "This week" each names its own day.
   - Tapping a showtime just adds it — the Day filter does **not** snap to it.
   - None of the suggestion muting feeds the card-pill "wouldn't fit" fade, and that fade only
     applies on days the plan already touches.

20. **A screening lingers ten minutes past its start time** (`GRACE_MINUTES` + `screeningCutoff`,
    `lib/date.ts`). Every "is this still on?" test compares against that cutoff rather than the
    wall clock, so it governs the plan too (#5). You can still walk into a film ten minutes late,
    and a session disappearing out from under a plan you're halfway through is a worse failure
    than one you can no longer quite make. It **crosses midnight rather than clamping**, so a
    late-night screening gets the same grace as any other; the accepted consequence is that
    yesterday can stay a visible day chip for those few minutes. `now` is fixed at mount.
    Details: `docs/decisions/plan.md`.

21. **The plan exports to a calendar as one `.ics` file** (`lib/calendar.ts` `planToICS`; the
    button at the foot of `PlanPanel`, the browser half in `ScreeningBrowser.exportPlan`). One
    file for the whole plan, one ordinary VEVENT per pick; it does not create an "FLM ON"
    calendar. Reasoning: `docs/decisions/plan.md`.
    - **It's an export, not a sync.** Import can add and update but never delete, so a film taken
      out of the plan stays in the calendar. What it does avoid is duplicating: each `UID` is a
      stable FNV-1a hash of the `bookingUrl` — whitespace stripped, because Light House's carry a
      literal newline mid-query-string — keyed on the URL alone so a moved session *updates* its
      event. That asymmetry is the button's tooltip and, spelled out in full, its `aria-label`:
      the one tooltip whose text is nowhere else in the UI.
    - **Times are `TZID=Europe/Dublin` with a static `VTIMEZONE`**, never floating — a floating
      time is silently wrong the moment the device leaves Irish time. `DTEND` derives from
      `endMins`, never from `s.date`, so a late film ends on the next date.
    - **`LOCATION` is `CINEMA_ADDRESS` (`lib/cinemas.ts`) and its exact shape is load-bearing** — a
      calendar geocodes it as a *place lookup* and only draws a map when that resolves. Registered
      venue name on its own first line, then the canonical postal address ending in the country.
      Don't tidy the line break away, and don't substitute `CINEMA_LABEL`.
    - **The event is what / where / when and nothing else** — `SUMMARY`, `DTSTART`, `DTEND`,
      `LOCATION`. No `URL`, no `DESCRIPTION`: by the time an event is in your calendar you've
      booked and you know what you're seeing.
    - It reads `dayPlanItems`, so it inherits #5 — muting a cinema never drops a confirmed film
      from the file.
    - **Built in the browser** (Web Share first, blob + `<a download>` fallback), because
      `output: "export"` plus a `basePath` that differs between local and CI rules out a route.
      The generator is pure and lives in `lib/`, which is why it has tests.
